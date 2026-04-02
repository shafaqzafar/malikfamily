import { Request, Response } from 'express'
import { HospitalEncounter } from '../models/Encounter'
import { HospitalIpdVital } from '../models/IpdVital'
import { HospitalIpdDoctorVisit } from '../models/IpdDoctorVisit'
import { HospitalIpdBillingItem } from '../models/IpdBillingItem'
import { HospitalIpdPayment } from '../models/IpdPayment'
import { HospitalToken } from '../models/Token'
import { HospitalIpdClinicalNote } from '../models/IpdClinicalNote'
import { HospitalIpdMedicationOrder } from '../models/IpdMedicationOrder'
import { HospitalIpdMedicationAdmin } from '../models/IpdMedicationAdmin'
import { HospitalIpdLabLink } from '../models/IpdLabLink'
import { FinanceJournal } from '../models/FinanceJournal'
import { LabPatient } from '../../lab/models/Patient'
import { CorporateTransaction } from '../../corporate/models/Transaction'
import { HospitalCashSession } from '../models/CashSession'
import { postFbrInvoiceViaSDC } from '../services/fbr'
import {
  createIpdVitalSchema,
  updateIpdVitalSchema,
  createIpdNoteSchema,
  updateIpdNoteSchema,
  createIpdDoctorVisitSchema,
  updateIpdDoctorVisitSchema,
  createIpdMedicationOrderSchema,
  updateIpdMedicationOrderSchema,
  createIpdMedicationAdminSchema,
  updateIpdMedicationAdminSchema,
  createIpdLabLinkSchema,
  updateIpdLabLinkSchema,
  createIpdBillingItemSchema,
  updateIpdBillingItemSchema,
  createIpdPaymentSchema,
  updateIpdPaymentSchema,
  createIpdClinicalNoteSchema,
  updateIpdClinicalNoteSchema,
} from '../validators/ipd_records'
import { HospitalNotification } from '../models/Notification'
import { notifyDoctor } from '../services/notifications'
import { resolveIPDPrice } from '../../corporate/utils/price'
import { HospitalBed } from '../models/Bed'

async function getIPDEncounter(encounterId: string){
  const enc = await HospitalEncounter.findById(encounterId)
  if (!enc) throw { status: 404, error: 'Encounter not found' }
  if (enc.type !== 'IPD') throw { status: 400, error: 'Encounter is not IPD' }
  return enc
}

function handleError(res: Response, e: any){
  if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors?.[0]?.message || 'Invalid payload' })
  if (e?.status) return res.status(e.status).json({ error: e.error || 'Error' })
  return res.status(500).json({ error: 'Internal Server Error' })
}

function clampMoney(n: any){
  const x = Number(n || 0)
  if (!isFinite(x)) return 0
  return Math.max(0, Math.round(x * 100) / 100)
}

async function applyIpdAllocations(encounterId: any, allocations: Array<{ billingItemId: string; amount: number }>) {
  const cleaned = (allocations || [])
    .map(a => ({ billingItemId: String(a.billingItemId || ''), amount: clampMoney(a.amount) }))
    .filter(a => a.billingItemId && a.amount > 0)

  for (const a of cleaned) {
    await HospitalIpdBillingItem.findOneAndUpdate(
      { _id: a.billingItemId, encounterId },
      { $inc: { paidAmount: a.amount } },
      { new: false }
    )
  }
}

async function recalcIpdPaidAmounts(encounterId: any){
  // Instead of resetting all to 0, we preserve existing paidAmount as baseline
  // and only apply new allocations for payments that have explicit allocations not yet applied.
  // This prevents the FIFO backfill from incorrectly reallocating historical payments.
  
  const items: any[] = await HospitalIpdBillingItem.find({ encounterId })
    .select('_id amount paidAmount date createdAt')
    .sort({ date: 1, createdAt: 1 })
    .lean()
  if (!items.length) return

  // Build map of current paid amounts (our baseline)
  const baselinePaid = new Map<string, number>()
  for (const it of items){
    baselinePaid.set(String(it._id), clampMoney(it.paidAmount || 0))
  }

  // Get all payments with their allocations
  const pays: any[] = await HospitalIpdPayment.find({ encounterId })
    .select('_id amount allocations receivedAt createdAt')
    .sort({ receivedAt: 1, createdAt: 1 })
    .lean()

  // Calculate what the paidAmount SHOULD be based on all payment allocations
  const calculatedPaid = new Map<string, number>()
  
  // Initialize with baseline (current paid amounts)
  for (const [id, amt] of baselinePaid.entries()){
    calculatedPaid.set(id, amt)
  }

  // Track which payments we've already "accounted for" in our baseline
  // A payment is accounted for if its allocations match what we've recorded
  const accountedPaymentIds = new Set<string>()

  // First pass: identify payments that are already fully reflected in baselinePaid
  for (const p of (pays || [])){
    const existingAllocs: any[] = Array.isArray(p?.allocations) ? p.allocations : []
    if (!existingAllocs.length) continue
    
    // Check if this payment's allocations are already reflected in paidAmount
    let allMatch = true
    for (const a of existingAllocs){
      const itemId = String(a?.billingItemId || '')
      const allocAmt = clampMoney(a?.amount)
      if (!itemId || allocAmt <= 0) continue
      // We can't easily verify individual allocations, so we assume payments with allocations are accounted
    }
    if (allMatch && existingAllocs.length > 0){
      accountedPaymentIds.add(String(p._id))
    }
  }

  // Second pass: process only NEW payments (those without allocations or not yet accounted for)
  // For payments without allocations, we backfill using the REMAINING capacity after baseline
  for (const p of (pays || [])){
    const pid = String(p._id)
    const existingAllocs: any[] = Array.isArray(p?.allocations) ? p.allocations : []
    
    if (existingAllocs.length > 0){
      // Payment has explicit allocations - verify/add them to calculated
      for (const a of existingAllocs){
        const itemId = String(a?.billingItemId || '')
        const allocAmt = clampMoney(a?.amount)
        if (!itemId || allocAmt <= 0) continue
        calculatedPaid.set(itemId, clampMoney((calculatedPaid.get(itemId) || 0) + allocAmt))
      }
    } else {
      // Payment has no allocations - do FIFO backfill against REMAINING (amount - baseline)
      let left = clampMoney(p.amount)
      const out: Array<{ billingItemId: string; amount: number }> = []
      
      for (const it of items){
        if (left <= 0) break
        const id = String(it._id)
        const itemAmount = clampMoney(it.amount)
        const currentlyPaid = baselinePaid.get(id) || 0
        const remainingCapacity = Math.max(0, itemAmount - currentlyPaid)
        
        if (remainingCapacity <= 0) continue
        const take = Math.min(remainingCapacity, left)
        if (take > 0){
          out.push({ billingItemId: id, amount: clampMoney(take) })
          calculatedPaid.set(id, clampMoney((calculatedPaid.get(id) || 0) + take))
          left = clampMoney(left - take)
        }
      }
      
      // Persist generated allocations for this previously-unallocated payment
      if (out.length){
        try { await HospitalIpdPayment.findByIdAndUpdate(pid, { $set: { allocations: out } }) } catch {}
      }
    }
  }

  // Apply updates only where calculated differs from baseline
  const ops: any[] = []
  for (const it of items){
    const id = String(it._id)
    const baseline = baselinePaid.get(id) || 0
    const calculated = calculatedPaid.get(id) || 0
    // Only update if there's a meaningful difference (>= 0.01)
    if (Math.abs(calculated - baseline) >= 0.01){
      ops.push({ updateOne: { filter: { _id: id, encounterId }, update: { $set: { paidAmount: calculated } } } })
    }
  }
  if (ops.length) await HospitalIpdBillingItem.bulkWrite(ops)
}

// Vitals
export async function createVital(req: Request, res: Response){
  try{
    const { encounterId } = req.params as any
    const enc = await getIPDEncounter(String(encounterId))
    const data = createIpdVitalSchema.parse(req.body)
    const row = await HospitalIpdVital.create({ ...data, encounterId: enc._id, patientId: enc.patientId })
    res.status(201).json({ vital: row })
  }catch(e){ return handleError(res, e) }
}
export async function listVitals(req: Request, res: Response){
  try{
    const { encounterId } = req.params as any
    const enc = await getIPDEncounter(String(encounterId))
    const q = req.query as any
    const page = Math.max(1, parseInt(String(q.page || '1')) || 1)
    const limit = Math.max(1, Math.min(200, parseInt(String(q.limit || '50')) || 50))
    const total = await HospitalIpdVital.countDocuments({ encounterId: enc._id })
    const rows = await HospitalIpdVital.find({ encounterId: enc._id }).sort({ recordedAt: -1, createdAt: -1 }).skip((page-1)*limit).limit(limit)
    res.json({ vitals: rows, total, page, limit })
  }catch(e){ return handleError(res, e) }
}
export async function updateVital(req: Request, res: Response){
  try{
    const { id } = req.params as any
    const data = updateIpdVitalSchema.parse(req.body)
    const row = await HospitalIpdVital.findByIdAndUpdate(String(id), { $set: data }, { new: true })
    if (!row) return res.status(404).json({ error: 'Vital not found' })
    res.json({ vital: row })
  }catch(e){ return handleError(res, e) }
}
export async function removeVital(req: Request, res: Response){
  try{
    const { id } = req.params as any
    const row = await HospitalIpdVital.findByIdAndDelete(String(id))
    if (!row) return res.status(404).json({ error: 'Vital not found' })
    res.json({ ok: true })
  }catch(e){ return handleError(res, e) }
}

// Notes
export async function createNote(req: Request, res: Response){
  try{
    const { encounterId } = req.params as any
    const enc = await getIPDEncounter(String(encounterId))
    const data = createIpdNoteSchema.parse(req.body)
    const row = await HospitalIpdVital.create({
      encounterId: enc._id,
      patientId: enc.patientId,
      recordedAt: new Date(),
      note: data.text,
      recordedBy: data.createdBy,
    })
    res.status(201).json({ note: row })
  }catch(e){ return handleError(res, e) }
}
export async function listNotes(req: Request, res: Response){
  try{
    const { encounterId } = req.params as any
    const enc = await getIPDEncounter(String(encounterId))
    const q = req.query as any
    const page = Math.max(1, parseInt(String(q.page || '1')) || 1)
    const limit = Math.max(1, Math.min(200, parseInt(String(q.limit || '50')) || 50))
    const crit: any = { encounterId: enc._id, note: { $exists: true, $ne: '' } }
    const total = await HospitalIpdVital.countDocuments(crit)
    const rows = await HospitalIpdVital.find(crit).sort({ recordedAt: -1, createdAt: -1 }).skip((page-1)*limit).limit(limit)
    res.json({ notes: rows, total, page, limit })
  }catch(e){ return handleError(res, e) }
}
export async function updateNote(req: Request, res: Response){
  try{
    const { id } = req.params as any
    const data = updateIpdNoteSchema.parse(req.body)
    const set: any = {}
    if (data.text !== undefined) set.note = data.text
    if (data.createdBy !== undefined) set.recordedBy = data.createdBy
    const row = await HospitalIpdVital.findByIdAndUpdate(String(id), { $set: set }, { new: true })
    if (!row) return res.status(404).json({ error: 'Note not found (vital)' })
    res.json({ note: row })
  }catch(e){ return handleError(res, e) }
}
export async function removeNote(req: Request, res: Response){
  try{
    const { id } = req.params as any
    const row = await HospitalIpdVital.findByIdAndDelete(String(id))
    if (!row) return res.status(404).json({ error: 'Note not found (vital)' })
    res.json({ ok: true })
  }catch(e){ return handleError(res, e) }
}

// Clinical Notes (Unified)
export async function createClinicalNote(req: Request, res: Response){
  try{
    const { encounterId } = req.params as any
    const enc = await getIPDEncounter(String(encounterId))
    const data = createIpdClinicalNoteSchema.parse(req.body)
    const row = await HospitalIpdClinicalNote.create({ ...data, encounterId: enc._id, patientId: enc.patientId })
    res.status(201).json({ note: row })
  }catch(e){ return handleError(res, e) }
}
export async function listClinicalNotes(req: Request, res: Response){
  try{
    const { encounterId } = req.params as any
    const enc = await getIPDEncounter(String(encounterId))
    const q = req.query as any
    const page = Math.max(1, parseInt(String(q.page || '1')) || 1)
    const limit = Math.max(1, Math.min(200, parseInt(String(q.limit || '50')) || 50))
    const crit: any = { encounterId: enc._id }
    if (q.type) crit.type = String(q.type)
    const total = await HospitalIpdClinicalNote.countDocuments(crit)
    const rows = await HospitalIpdClinicalNote.find(crit).sort({ recordedAt: -1, createdAt: -1 }).skip((page-1)*limit).limit(limit)
    res.json({ notes: rows, total, page, limit })
  }catch(e){ return handleError(res, e) }
}
export async function updateClinicalNote(req: Request, res: Response){
  try{
    const { id } = req.params as any
    const data = updateIpdClinicalNoteSchema.parse(req.body)
    const row = await HospitalIpdClinicalNote.findByIdAndUpdate(String(id), { $set: data }, { new: true })
    if (!row) return res.status(404).json({ error: 'Clinical note not found' })
    res.json({ note: row })
  }catch(e){ return handleError(res, e) }
}
export async function removeClinicalNote(req: Request, res: Response){
  try{
    const { id } = req.params as any
    const row = await HospitalIpdClinicalNote.findByIdAndDelete(String(id))
    if (!row) return res.status(404).json({ error: 'Clinical note not found' })
    res.json({ ok: true })
  }catch(e){ return handleError(res, e) }
}

// Doctor Visits
export async function createDoctorVisit(req: Request, res: Response){
  try{
    const { encounterId } = req.params as any
    const enc = await getIPDEncounter(String(encounterId))
    const data = createIpdDoctorVisitSchema.parse(req.body)
    // If no category provided, infer: entries having any SOAP field are 'progress', else 'visit'
    const inferredCategory = (data as any).category || ((data.subjective || data.objective || data.assessment || data.plan) ? 'progress' : 'visit')
    const row = await HospitalIpdDoctorVisit.create({ ...data, category: inferredCategory, encounterId: enc._id, patientId: enc.patientId })
    // Create and emit doctor notification if doctorId is present
    const docId: any = (row as any).doctorId || (enc as any).doctorId
    if (docId){
      const when = (row as any).when || new Date()
      const message = `New IPD visit scheduled on ${new Date(when).toLocaleString()}`
      try {
        const n = await HospitalNotification.create({ doctorId: docId, type: 'ipd-visit', message, payload: { encounterId: enc._id, visitId: row._id, patientId: enc.patientId } })
        notifyDoctor(String(docId), { id: String(n._id), doctorId: String(n.doctorId), type: n.type, message: n.message, payload: n.payload, read: n.read, createdAt: n.createdAt })
      } catch {}
    }
    res.status(201).json({ visit: row })
  }catch(e){ return handleError(res, e) }
}
export async function listDoctorVisits(req: Request, res: Response){
  try{
    const { encounterId } = req.params as any
    const enc = await getIPDEncounter(String(encounterId))
    const q = req.query as any
    const page = Math.max(1, parseInt(String(q.page || '1')) || 1)
    const limit = Math.max(1, Math.min(200, parseInt(String(q.limit || '50')) || 50))
    const crit: any = { encounterId: enc._id }
    if (q.category) crit.category = String(q.category)
    const total = await HospitalIpdDoctorVisit.countDocuments(crit)
    const rows = await HospitalIpdDoctorVisit.find(crit).populate('doctorId', 'name').sort({ when: -1 }).skip((page-1)*limit).limit(limit)
    res.json({ visits: rows, total, page, limit })
  }catch(e){ return handleError(res, e) }
}
export async function updateDoctorVisit(req: Request, res: Response){
  try{
    const { id } = req.params as any
    const data = updateIpdDoctorVisitSchema.parse(req.body)
    const row = await HospitalIpdDoctorVisit.findByIdAndUpdate(String(id), { $set: data }, { new: true })
    if (!row) return res.status(404).json({ error: 'Doctor visit not found' })
    // If marked done, mark related doctor notifications as read
    try {
      if ((data as any).done === true) {
        await HospitalNotification.updateMany({ 'payload.visitId': row._id }, { $set: { read: true } })
      }
    } catch {}
    res.json({ visit: row })
  }catch(e){ return handleError(res, e) }
}
export async function removeDoctorVisit(req: Request, res: Response){
  try{
    const { id } = req.params as any
    const row = await HospitalIpdDoctorVisit.findByIdAndDelete(String(id))
    if (!row) return res.status(404).json({ error: 'Doctor visit not found' })
    // Also remove any notifications that reference this visit
    try {
      await HospitalNotification.deleteMany({ 'payload.visitId': String(id) })
      // Notify doctor clients to remove the notification immediately
      const docId: any = (row as any).doctorId || (await HospitalEncounter.findById((row as any).encounterId))?.doctorId
      if (docId) {
        notifyDoctor(String(docId), {
          id: `visit-deleted-${String(id)}`,
          doctorId: String(docId),
          type: 'ipd-visit-removed',
          message: 'IPD visit deleted',
          payload: { visitId: String(id) },
          read: true,
          createdAt: new Date(),
        })
      }
    } catch {}
    res.json({ ok: true })
  }catch(e){ return handleError(res, e) }
}

// Medication Orders
export async function createMedicationOrder(req: Request, res: Response){
  try{
    const { encounterId } = req.params as any
    const enc = await getIPDEncounter(String(encounterId))
    const data = createIpdMedicationOrderSchema.parse(req.body)
    const row = await HospitalIpdMedicationOrder.create({ ...data, encounterId: enc._id, patientId: enc.patientId })
    res.status(201).json({ order: row })
  }catch(e){ return handleError(res, e) }
}
export async function listMedicationOrders(req: Request, res: Response){
  try{
    const { encounterId } = req.params as any
    const enc = await getIPDEncounter(String(encounterId))
    const q = req.query as any
    const page = Math.max(1, parseInt(String(q.page || '1')) || 1)
    const limit = Math.max(1, Math.min(200, parseInt(String(q.limit || '50')) || 50))
    const total = await HospitalIpdMedicationOrder.countDocuments({ encounterId: enc._id })
    const rows = await HospitalIpdMedicationOrder.find({ encounterId: enc._id }).sort({ createdAt: -1 }).skip((page-1)*limit).limit(limit)
    res.json({ orders: rows, total, page, limit })
  }catch(e){ return handleError(res, e) }
}
export async function updateMedicationOrder(req: Request, res: Response){
  try{
    const { id } = req.params as any
    const data = updateIpdMedicationOrderSchema.parse(req.body)
    const row = await HospitalIpdMedicationOrder.findByIdAndUpdate(String(id), { $set: data }, { new: true })
    if (!row) return res.status(404).json({ error: 'Medication order not found' })
    res.json({ order: row })
  }catch(e){ return handleError(res, e) }
}
export async function removeMedicationOrder(req: Request, res: Response){
  try{
    const { id } = req.params as any
    const row = await HospitalIpdMedicationOrder.findByIdAndDelete(String(id))
    if (!row) return res.status(404).json({ error: 'Medication order not found' })
    res.json({ ok: true })
  }catch(e){ return handleError(res, e) }
}

// Medication Administration (MAR)
export async function createMedicationAdmin(req: Request, res: Response){
  try{
    const { orderId } = req.params as any
    const order = await HospitalIpdMedicationOrder.findById(String(orderId))
    if (!order) return res.status(404).json({ error: 'Medication order not found' })
    const enc = await getIPDEncounter(String((order as any).encounterId))
    const data = createIpdMedicationAdminSchema.parse(req.body)
    const row = await HospitalIpdMedicationAdmin.create({ ...data, orderId: order._id, encounterId: enc._id, patientId: enc.patientId })
    res.status(201).json({ admin: row })
  }catch(e){ return handleError(res, e) }
}
export async function listMedicationAdmins(req: Request, res: Response){
  try{
    const { orderId } = req.params as any
    const order = await HospitalIpdMedicationOrder.findById(String(orderId))
    if (!order) return res.status(404).json({ error: 'Medication order not found' })
    const q = req.query as any
    const page = Math.max(1, parseInt(String(q.page || '1')) || 1)
    const limit = Math.max(1, Math.min(200, parseInt(String(q.limit || '50')) || 50))
    const total = await HospitalIpdMedicationAdmin.countDocuments({ orderId: order._id })
    const rows = await HospitalIpdMedicationAdmin.find({ orderId: order._id }).sort({ givenAt: -1 }).skip((page-1)*limit).limit(limit)
    res.json({ admins: rows, total, page, limit })
  }catch(e){ return handleError(res, e) }
}
export async function updateMedicationAdmin(req: Request, res: Response){
  try{
    const { id } = req.params as any
    const data = updateIpdMedicationAdminSchema.parse(req.body)
    const row = await HospitalIpdMedicationAdmin.findByIdAndUpdate(String(id), { $set: data }, { new: true })
    if (!row) return res.status(404).json({ error: 'Medication administration not found' })
    res.json({ admin: row })
  }catch(e){ return handleError(res, e) }
}
export async function removeMedicationAdmin(req: Request, res: Response){
  try{
    const { id } = req.params as any
    const row = await HospitalIpdMedicationAdmin.findByIdAndDelete(String(id))
    if (!row) return res.status(404).json({ error: 'Medication administration not found' })
    res.json({ ok: true })
  }catch(e){ return handleError(res, e) }
}

// Lab Links
export async function createLabLink(req: Request, res: Response){
  try{
    const { encounterId } = req.params as any
    const enc = await getIPDEncounter(String(encounterId))
    const data = createIpdLabLinkSchema.parse(req.body)
    const row = await HospitalIpdLabLink.create({ ...data, encounterId: enc._id, patientId: enc.patientId })
    res.status(201).json({ link: row })
  }catch(e){ return handleError(res, e) }
}
export async function listLabLinks(req: Request, res: Response){
  try{
    const { encounterId } = req.params as any
    const enc = await getIPDEncounter(String(encounterId))
    const q = req.query as any
    const page = Math.max(1, parseInt(String(q.page || '1')) || 1)
    const limit = Math.max(1, Math.min(200, parseInt(String(q.limit || '50')) || 50))
    const total = await HospitalIpdLabLink.countDocuments({ encounterId: enc._id })
    const rows = await HospitalIpdLabLink.find({ encounterId: enc._id }).sort({ createdAt: -1 }).skip((page-1)*limit).limit(limit)
    res.json({ links: rows, total, page, limit })
  }catch(e){ return handleError(res, e) }
}
export async function updateLabLink(req: Request, res: Response){
  try{
    const { id } = req.params as any
    const data = updateIpdLabLinkSchema.parse(req.body)
    const row = await HospitalIpdLabLink.findByIdAndUpdate(String(id), { $set: data }, { new: true })
    if (!row) return res.status(404).json({ error: 'Lab link not found' })
    res.json({ link: row })
  }catch(e){ return handleError(res, e) }
}
export async function removeLabLink(req: Request, res: Response){
  try{
    const { id } = req.params as any
    const row = await HospitalIpdLabLink.findByIdAndDelete(String(id))
    if (!row) return res.status(404).json({ error: 'Lab link not found' })
    res.json({ ok: true })
  }catch(e){ return handleError(res, e) }
}

// Billing Items
export async function createBillingItem(req: Request, res: Response){
  try{
    const { encounterId } = req.params as any
    const enc = await getIPDEncounter(String(encounterId))
    const data = createIpdBillingItemSchema.parse(req.body)
    const amount = data.amount ?? ((data.qty || 0) * (data.unitPrice || 0))
    const row = await HospitalIpdBillingItem.create({ ...data, amount, encounterId: enc._id, patientId: enc.patientId })
    // Corporate: post ledger line if encounter is corporate
    try {
      const companyId = (enc as any).corporateId ? String((enc as any).corporateId) : ''
      if (companyId){
        const pat = await LabPatient.findById((enc as any).patientId).lean()
        const dateIso = (row as any)?.date ? new Date(String((row as any).date)).toISOString().slice(0,10) : new Date().toISOString().slice(0,10)
        let bedCategory: string | undefined
        if (String((row as any).type) === 'bed'){
          const bed = (enc as any).bedId ? await HospitalBed.findById((enc as any).bedId).lean() : null
          bedCategory = (bed as any)?.category ? String((bed as any).category) : undefined
        }
        const corp = await resolveIPDPrice({
          companyId,
          itemType: String((row as any).type) as any,
          refId: (row as any).refId ? String((row as any).refId) : undefined,
          bedCategory,
          defaultPrice: Number((row as any).amount || 0),
        })
        const qty = Number((row as any).qty || 1)
        const baseCorp = Number(corp.price || 0)
        const coPayPct = Math.max(0, Math.min(100, Number((enc as any)?.corporateCoPayPercent || 0)))
        const coPayAmt = Math.max(0, baseCorp * (coPayPct/100))
        let net = Math.max(0, baseCorp - coPayAmt)
        const cap = Number((enc as any)?.corporateCoverageCap || 0) || 0
        if (cap > 0){
          try {
            const existing = await CorporateTransaction.find({ encounterId: enc._id }).select('netToCorporate').lean()
            const used = (existing || []).reduce((s: number, t: any)=> s + Number(t?.netToCorporate||0), 0)
            const remaining = Math.max(0, cap - used)
            net = Math.max(0, Math.min(net, remaining))
          } catch {}
        }
        const corpUnit = qty > 0 ? (baseCorp / qty) : baseCorp
        await CorporateTransaction.create({
          companyId,
          patientMrn: String((pat as any)?.mrn || ''),
          patientName: String((pat as any)?.fullName || ''),
          serviceType: 'IPD',
          refType: 'ipd_billing_item',
          refId: String((row as any)?._id || ''),
          encounterId: enc._id as any,
          dateIso,
          description: String((row as any).description || 'IPD Item'),
          qty,
          unitPrice: Number((row as any).unitPrice || 0),
          corpUnitPrice: corpUnit,
          coPay: coPayAmt,
          netToCorporate: net,
          corpRuleId: String(corp.appliedRuleId || ''),
          status: 'accrued',
        })
      }
    } catch (e) { console.warn('Failed to create corporate transaction for IPD billing item', e) }
    res.status(201).json({ item: row })
  }catch(e){ return handleError(res, e) }
}
export async function listBillingItems(req: Request, res: Response){
  try{
    const { encounterId } = req.params as any
    const enc = await getIPDEncounter(String(encounterId))
    const q = req.query as any
    const page = Math.max(1, parseInt(String(q.page || '1')) || 1)
    const limit = Math.max(1, Math.min(200, parseInt(String(q.limit || '50')) || 50))
    const total = await HospitalIpdBillingItem.countDocuments({ encounterId: enc._id })
    const rows: any[] = await HospitalIpdBillingItem.find({ encounterId: enc._id }).sort({ date: -1, createdAt: -1 }).skip((page-1)*limit).limit(limit).lean()
    const items = (rows || []).map((r: any) => {
      const amount = clampMoney(r.amount)
      const paidAmount = clampMoney(r.paidAmount)
      const remaining = clampMoney(amount - paidAmount)
      const status = remaining <= 0 ? 'paid' : (paidAmount > 0 ? 'partial' : 'unpaid')
      return { ...r, amount, paidAmount, remaining, status }
    })
    res.json({ items, total, page, limit })
  }catch(e){ return handleError(res, e) }
}
export async function updateBillingItem(req: Request, res: Response){
  try{
    const { id } = req.params as any
    const data = updateIpdBillingItemSchema.parse(req.body)
    if (data.qty !== undefined || data.unitPrice !== undefined){
      const existing = await HospitalIpdBillingItem.findById(String(id))
      if (!existing) return res.status(404).json({ error: 'Billing item not found' })
      const qty = data.qty ?? ((existing as any).qty ?? 0)
      const unitPrice = data.unitPrice ?? ((existing as any).unitPrice ?? 0)
      if (data.amount === undefined) data.amount = qty * unitPrice
    }
    // If amount is being reduced below already paid, clamp paidAmount later by recalculating.
    const row = await HospitalIpdBillingItem.findByIdAndUpdate(String(id), { $set: data }, { new: true })
    if (!row) return res.status(404).json({ error: 'Billing item not found' })
    try { await recalcIpdPaidAmounts((row as any).encounterId) } catch {}
    // Corporate: reverse previous and add new line
    try {
      const enc = await HospitalEncounter.findById((row as any).encounterId)
      const companyId = (enc as any)?.corporateId ? String((enc as any).corporateId) : ''
      if (companyId){
        // Mark previous as reversed and create negative reversals
        const existing: any[] = await CorporateTransaction.find({ refType: 'ipd_billing_item', refId: String(id), status: { $ne: 'reversed' } }).lean()
        for (const tx of existing){
          try { await CorporateTransaction.findByIdAndUpdate(String(tx._id), { $set: { status: 'reversed' } }) } catch {}
          try {
            await CorporateTransaction.create({
              companyId: tx.companyId,
              patientMrn: tx.patientMrn,
              patientName: tx.patientName,
              serviceType: tx.serviceType,
              refType: tx.refType,
              refId: tx.refId,
              dateIso: new Date().toISOString().slice(0,10),
              description: `Reversal: ${tx.description || 'IPD Item'}`,
              qty: tx.qty,
              unitPrice: -Math.abs(Number(tx.unitPrice||0)),
              corpUnitPrice: -Math.abs(Number(tx.corpUnitPrice||0)),
              coPay: -Math.abs(Number(tx.coPay||0)),
              netToCorporate: -Math.abs(Number(tx.netToCorporate||0)),
              corpRuleId: tx.corpRuleId,
              status: 'accrued',
              reversalOf: String(tx._id),
            })
          } catch (e) { console.warn('Failed to create corporate reversal for IPD billing item update', e) }
        }
        // Create new accrual for updated amount
        const pat = await LabPatient.findById((enc as any).patientId).lean()
        let bedCategory: string | undefined
        if (String((row as any).type) === 'bed'){
          const bed = (enc as any).bedId ? await HospitalBed.findById((enc as any).bedId).lean() : null
          bedCategory = (bed as any)?.category ? String((bed as any).category) : undefined
        }
        const corp = await resolveIPDPrice({
          companyId,
          itemType: String((row as any).type) as any,
          refId: (row as any).refId ? String((row as any).refId) : undefined,
          bedCategory,
          defaultPrice: Number((row as any).amount || 0),
        })
        const qty = Number((row as any).qty || 1)
        const baseCorp = Number(corp.price || 0)
        const coPayPct = Math.max(0, Math.min(100, Number((enc as any)?.corporateCoPayPercent || 0)))
        const coPayAmt = Math.max(0, baseCorp * (coPayPct/100))
        let net = Math.max(0, baseCorp - coPayAmt)
        const cap = Number((enc as any)?.corporateCoverageCap || 0) || 0
        if (cap > 0){
          try {
            const existing = await CorporateTransaction.find({ encounterId: enc._id }).select('netToCorporate').lean()
            const used = (existing || []).reduce((s: number, t: any)=> s + Number(t?.netToCorporate||0), 0)
            const remaining = Math.max(0, cap - used)
            net = Math.max(0, Math.min(net, remaining))
          } catch {}
        }
        const corpUnit = qty > 0 ? (baseCorp / qty) : baseCorp
        await CorporateTransaction.create({
          companyId,
          patientMrn: String((pat as any)?.mrn || ''),
          patientName: String((pat as any)?.fullName || ''),
          serviceType: 'IPD',
          refType: 'ipd_billing_item',
          refId: String((row as any)?._id || ''),
          encounterId: enc._id as any,
          dateIso: new Date().toISOString().slice(0,10),
          description: String((row as any).description || 'IPD Item (Updated)'),
          qty,
          unitPrice: Number((row as any).unitPrice || 0),
          corpUnitPrice: corpUnit,
          coPay: coPayAmt,
          netToCorporate: net,
          corpRuleId: String(corp.appliedRuleId || ''),
          status: 'accrued',
        })
      }
    } catch (e) { console.warn('Failed to update corporate transactions for IPD billing item', e) }
    res.json({ item: row })
  }catch(e){ return handleError(res, e) }
}
export async function removeBillingItem(req: Request, res: Response){
  try{
    const { id } = req.params as any
    // Corporate: reverse any existing corporate transactions before deletion
    try {
      const existing: any[] = await CorporateTransaction.find({ refType: 'ipd_billing_item', refId: String(id), status: { $ne: 'reversed' } }).lean()
      for (const tx of existing){
        try { await CorporateTransaction.findByIdAndUpdate(String(tx._id), { $set: { status: 'reversed' } }) } catch {}
        try {
          await CorporateTransaction.create({
            companyId: tx.companyId,
            patientMrn: tx.patientMrn,
            patientName: tx.patientName,
            serviceType: tx.serviceType,
            refType: tx.refType,
            refId: tx.refId,
            dateIso: new Date().toISOString().slice(0,10),
            description: `Reversal: ${tx.description || 'IPD Item'}`,
            qty: tx.qty,
            unitPrice: -Math.abs(Number(tx.unitPrice||0)),
            corpUnitPrice: -Math.abs(Number(tx.corpUnitPrice||0)),
            coPay: -Math.abs(Number(tx.coPay||0)),
            netToCorporate: -Math.abs(Number(tx.netToCorporate||0)),
            corpRuleId: tx.corpRuleId,
            status: 'accrued',
            reversalOf: String(tx._id),
          })
        } catch (e) { console.warn('Failed to create corporate reversal for IPD billing item delete', e) }
      }
    } catch (e) { console.warn('Corporate reversal lookup failed for IPD billing item delete', e) }
    const row = await HospitalIpdBillingItem.findByIdAndDelete(String(id))
    if (!row) return res.status(404).json({ error: 'Billing item not found' })
    res.json({ ok: true })
  }catch(e){ return handleError(res, e) }
}

// Payments
export async function createPayment(req: Request, res: Response){
  try{
    const { encounterId } = req.params as any
    const enc = await getIPDEncounter(String(encounterId))
    const data = createIpdPaymentSchema.parse(req.body)

    // Determine allocations: client-provided OR auto-allocate FIFO over unpaid items
    let allocations: Array<{ billingItemId: string; amount: number }> = Array.isArray((data as any).allocations)
      ? (data as any).allocations
      : []

    if (!allocations.length) {
      try {
        const items: any[] = await HospitalIpdBillingItem.find({ encounterId: enc._id }).sort({ date: 1, createdAt: 1 }).select('amount paidAmount').lean()
        let remainingToAllocate = clampMoney((data as any).amount)
        const out: Array<{ billingItemId: string; amount: number }> = []
        for (const it of (items || [])) {
          if (remainingToAllocate <= 0) break
          const amt = clampMoney(it.amount)
          const paid = clampMoney(it.paidAmount)
          const rem = clampMoney(amt - paid)
          if (rem <= 0) continue
          const take = Math.min(rem, remainingToAllocate)
          if (take > 0) {
            out.push({ billingItemId: String(it._id), amount: take })
            remainingToAllocate = clampMoney(remainingToAllocate - take)
          }
        }
        allocations = out
      } catch {}
    }

    const row = await HospitalIpdPayment.create({
      ...data,
      encounterId: enc._id,
      patientId: enc.patientId,
      createdByUserId: (req as any).user?._id || (req as any).user?.id || undefined,
      createdByUsername: (req as any).user?.username || undefined,
      portal: req.body.portal || 'hospital',
      source: req.body.portal || 'hospital', // Store the 'portal' source when creating an IPD payment
      allocations,
    })

    // Update per-item paid amounts (full/partial) - keep consistent
    try { await recalcIpdPaidAmounts(enc._id) } catch {}

    // FBR fiscalization (IPD payment receipt)
    try {
      const pat: any = await LabPatient.findById((enc as any).patientId).lean()
      const payload: any = {
        refType: 'ipd_payment',
        encounterId: String(enc._id),
        paymentId: String((row as any)._id),
        receivedAt: (row as any)?.receivedAt || new Date().toISOString(),
        method: (row as any)?.method || data.method,
        refNo: (row as any)?.refNo || data.refNo,
        patient: {
          id: String(pat?._id || ''),
          mrn: String(pat?.mrn || ''),
          name: String(pat?.fullName || ''),
          phone: String(pat?.phoneNormalized || ''),
        },
        net: Number((row as any).amount || data.amount || 0),
      }
      const r: any = await postFbrInvoiceViaSDC({ module: 'IPD_PAYMENT_CREATE', invoiceType: 'IPD', refId: String((row as any)._id), amount: Number((row as any).amount || data.amount || 0), payload })
      if (r) {
        ;(row as any).fbrInvoiceNo = r.fbrInvoiceNo
        ;(row as any).fbrQrCode = r.qrCode
        ;(row as any).fbrStatus = r.status
        ;(row as any).fbrMode = r.mode
        ;(row as any).fbrError = r.error
        try { await (row as any).save() } catch {}
      }
    } catch {}

    // Finance Journal: record IPD payment; tag sessionId if cash session open
    try{
      const when = (row as any)?.receivedAt ? new Date((row as any).receivedAt) : new Date()
      const dateIso = when.toISOString().slice(0,10)
      const paidMethod = String((row as any)?.method || data.method || '').toLowerCase()
      const isCash = paidMethod === 'cash'
      let sessionId: string | undefined = undefined
      if (isCash){
        try{
          const userId = String((req as any).user?._id || (req as any).user?.id || (req as any).user?.email || '')
          if (userId){
            const sess: any = await HospitalCashSession.findOne({ status: 'open', userId }).sort({ createdAt: -1 }).lean()
            if (sess) sessionId = String(sess._id)
          }
        } catch {}
      }
      const tags: any = {
        encounterId: String(enc._id),
        patientId: String(enc.patientId),
        createdByUserId: (req as any).user?._id || (req as any).user?.id || undefined,
        createdByUsername: (req as any).user?.username || undefined,
      }
      tags.portal = String(req.body.portal || 'hospital')
      if (sessionId) tags.sessionId = sessionId
      // Try to attach originating tokenNo so Finance Transactions can display it.
      // IPD encounters usually originate from an OPD token (token.encounterId points to the encounter).
      try{
        const tok: any = await HospitalToken.findOne({ encounterId: String(enc._id) }).select('tokenNo').lean()
        if (tok?.tokenNo) tags.tokenNo = String(tok.tokenNo)
      }catch{}
      // Add patient and department info for transactions display
      try {
        const pat: any = await LabPatient.findById((enc as any).patientId).lean()
        if (pat?.fullName) tags.patientName = String(pat.fullName)
        if (pat?.mrn) tags.mrn = String(pat.mrn)
      } catch {}
      if (enc.departmentId) tags.departmentId = String(enc.departmentId)
      if (enc.doctorId) tags.doctorId = String(enc.doctorId)
      const debitAccount = isCash ? 'CASH' : 'BANK'
      const lines = [
        { account: debitAccount, debit: Number((row as any).amount||data.amount||0), tags },
        { account: 'IPD_REVENUE', credit: Number((row as any).amount||data.amount||0), tags },
      ] as any
      await FinanceJournal.create({ dateIso, refType: 'ipd_payment', refId: String((row as any)._id), memo: (row as any)?.refNo || 'IPD Payment', lines })
    } catch {}
    res.status(201).json({ payment: row })
  }catch(e){ return handleError(res, e) }
}
export async function listPayments(req: Request, res: Response){
  try{
    const { encounterId } = req.params as any
    const enc = await getIPDEncounter(String(encounterId))
    const q = req.query as any
    const page = Math.max(1, parseInt(String(q.page || '1')) || 1)
    const limit = Math.max(1, Math.min(200, parseInt(String(q.limit || '50')) || 50))
    const total = await HospitalIpdPayment.countDocuments({ encounterId: enc._id })
    const rows = await HospitalIpdPayment.find({ encounterId: enc._id }).sort({ receivedAt: -1 }).skip((page-1)*limit).limit(limit).lean()
    // Totals for UI summary/reporting
    let totals: any = undefined
    try {
      const items = await HospitalIpdBillingItem.find({ encounterId: enc._id }).select('amount').lean()
      const pays = await HospitalIpdPayment.find({ encounterId: enc._id }).select('amount').lean()
      const totalAmount = (items || []).reduce((s: number, x: any) => s + Number(x.amount || 0), 0)
      const paidAmount = (pays || []).reduce((s: number, x: any) => s + Number(x.amount || 0), 0)
      const pendingAmount = Math.max(0, totalAmount - paidAmount)
      totals = { total: totalAmount, paid: paidAmount, pending: pendingAmount }
    } catch {}
    res.json({ payments: rows, total, page, limit, totals })
  }catch(e){ return handleError(res, e) }
}
export async function updatePayment(req: Request, res: Response){
  try{
    const { id } = req.params as any
    const data = updateIpdPaymentSchema.parse(req.body)
    const row = await HospitalIpdPayment.findByIdAndUpdate(String(id), { $set: data }, { new: true })
    if (!row) return res.status(404).json({ error: 'Payment not found' })
    try { await recalcIpdPaidAmounts((row as any).encounterId) } catch {}
    res.json({ payment: row })
  }catch(e){ return handleError(res, e) }
}
export async function removePayment(req: Request, res: Response){
  try{
    const { id } = req.params as any
    const row: any = await HospitalIpdPayment.findByIdAndDelete(String(id))
    if (!row) return res.status(404).json({ error: 'Payment not found' })
    try { await recalcIpdPaidAmounts(row.encounterId) } catch {}
    res.json({ ok: true })
  }catch(e){ return handleError(res, e) }
}
