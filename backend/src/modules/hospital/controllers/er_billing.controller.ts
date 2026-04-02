import { Request, Response } from 'express'
import { HospitalEncounter } from '../models/Encounter'
import { HospitalErCharge } from '../models/ErCharge'
import { HospitalErPayment } from '../models/ErPayment'
import { createErPaymentSchema } from '../validators/er_payments'
import { HospitalToken } from '../models/Token'
import { LabPatient } from '../../lab/models/Patient'
import { postFbrInvoiceViaSDC } from '../services/fbr'
import { FinanceJournal, JournalLine } from '../models/FinanceJournal'
import { Types } from 'mongoose'

function clampMoney(n: number){
  return Math.round(Number(n || 0) * 100) / 100
}

async function getEREncounter(encounterId: string){
  const enc = await HospitalEncounter.findById(encounterId)
  if (!enc) throw { status: 404, error: 'Encounter not found' }
  if (String((enc as any).type) !== 'ER') throw { status: 400, error: 'Encounter is not ER' }
  return enc
}

function handleError(res: Response, e: any){
  if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors?.[0]?.message || 'Invalid payload' })
  if (e?.status) return res.status(e.status).json({ error: e.error || 'Error' })
  return res.status(500).json({ error: 'Internal Server Error' })
}

function toOid(id?: any){
  try {
    if (!id) return undefined
    const s = String(id)
    return Types.ObjectId.isValid(s) ? new Types.ObjectId(s) : undefined
  } catch { return undefined }
}

async function postErPaymentJournal(args: { encounter: any; payment: any; patient?: any }){
  const paymentId = String(args.payment?._id || '')
  if (!paymentId) return

  // Idempotency: don't post twice for same payment
  const existing: any = await FinanceJournal.findOne({ refType: 'er_billing', refId: paymentId }).lean()
  if (existing) return

  const dateIso = String((args.payment?.receivedAt || new Date()).toISOString()).slice(0,10)
  const methodRaw = String(args.payment?.method || '').toLowerCase()
  const debitAccount = methodRaw === 'bank' ? 'BANK' : (methodRaw === 'cash' ? 'CASH' : 'CASH')
  const amount = Math.max(0, Number(args.payment?.amount || 0))
  if (!Number.isFinite(amount) || amount <= 0) return

  const enc: any = args.encounter || {}
  const pat: any = args.patient || {}
  const tags: any = {}
  const departmentId = toOid(enc?.departmentId?._id || enc?.departmentId)
  const doctorId = toOid(enc?.doctorId?._id || enc?.doctorId)
  const patientId = toOid(enc?.patientId?._id || enc?.patientId || pat?._id)

  if (departmentId) tags.departmentId = departmentId
  if (doctorId) tags.doctorId = doctorId
  if (patientId) tags.patientId = patientId
  tags.encounterId = toOid(enc?._id) || String(enc?._id || '')
  if (pat?.mrn) tags.mrn = String(pat.mrn)
  if (pat?.fullName) tags.patientName = String(pat.fullName)
  // Try to attach ER tokenNo so Finance Transactions can display it.
  // ER encounters originate from an OPD token (encounterId on token).
  try{
    const tok: any = await HospitalToken.findOne({ encounterId: toOid(enc?._id) || String(enc?._id || '') })
      .select('tokenNo')
      .lean()
    if (tok?.tokenNo) tags.tokenNo = String(tok.tokenNo)
  }catch{}
  if ((args.payment as any)?.createdByUserId) tags.createdByUserId = toOid((args.payment as any).createdByUserId) || String((args.payment as any).createdByUserId)
  if ((args.payment as any)?.createdByUsername) tags.createdByUsername = String((args.payment as any).createdByUsername)
  if ((args.payment as any)?.source) tags.portal = String((args.payment as any).source)

  const lines: JournalLine[] = [
    { account: debitAccount, debit: amount, tags: { ...tags, method: methodRaw || undefined } },
    { account: 'ER_REVENUE', credit: amount, tags: { ...tags } },
  ]
  const memo = `ER Payment ${methodRaw ? '('+methodRaw+')' : ''}`.trim()
  await FinanceJournal.create({ dateIso, refType: 'er_billing', refId: paymentId, memo, lines })
}

async function computeTotals(encounterId: string){
  const charges = await HospitalErCharge.find({ encounterId }).select('amount paidAmount').lean()
  const payments = await HospitalErPayment.find({ encounterId }).select('amount').lean()
  const total = charges.reduce((s: number, c: any) => s + Number(c.amount || 0), 0)
  const paidFromCharges = charges.reduce((s: number, c: any) => s + Number(c.paidAmount || 0), 0)
  const pending = Math.max(0, total - paidFromCharges)
  return { total, paid: paidFromCharges, pending }
}

async function recalcErPaidAmounts(encounterId: any){
  // Same logic as IPD: preserve existing paidAmount as baseline, apply new allocations
  const items: any[] = await HospitalErCharge.find({ encounterId })
    .select('_id amount paidAmount date createdAt')
    .sort({ date: 1, createdAt: 1 })
    .lean()
  if (!items.length) return

  const baselinePaid = new Map<string, number>()
  for (const it of items){
    baselinePaid.set(String(it._id), clampMoney(it.paidAmount || 0))
  }

  const pays: any[] = await HospitalErPayment.find({ encounterId })
    .select('_id amount allocations receivedAt createdAt')
    .sort({ receivedAt: 1, createdAt: 1 })
    .lean()

  const calculatedPaid = new Map<string, number>()
  for (const [id, amt] of baselinePaid.entries()){
    calculatedPaid.set(id, amt)
  }

  const accountedPaymentIds = new Set<string>()

  for (const p of (pays || [])){
    const existingAllocs: any[] = Array.isArray(p?.allocations) ? p.allocations : []
    if (!existingAllocs.length) continue
    let allMatch = true
    for (const a of existingAllocs){
      const itemId = String(a?.billingItemId || '')
      const allocAmt = clampMoney(a?.amount)
      if (!itemId || allocAmt <= 0) continue
    }
    if (allMatch && existingAllocs.length > 0){
      accountedPaymentIds.add(String(p._id))
    }
  }

  for (const p of (pays || [])){
    const pid = String(p._id)
    const existingAllocs: any[] = Array.isArray(p?.allocations) ? p.allocations : []
    
    if (existingAllocs.length > 0){
      for (const a of existingAllocs){
        const itemId = String(a?.billingItemId || '')
        const allocAmt = clampMoney(a?.amount)
        if (!itemId || allocAmt <= 0) continue
        calculatedPaid.set(itemId, clampMoney((calculatedPaid.get(itemId) || 0) + allocAmt))
      }
    } else {
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
      
      if (out.length){
        try { await HospitalErPayment.findByIdAndUpdate(pid, { $set: { allocations: out } }) } catch {}
      }
    }
  }

  const ops: any[] = []
  for (const it of items){
    const id = String(it._id)
    const baseline = baselinePaid.get(id) || 0
    const calculated = calculatedPaid.get(id) || 0
    if (Math.abs(calculated - baseline) >= 0.01){
      ops.push({ updateOne: { filter: { _id: id, encounterId }, update: { $set: { paidAmount: calculated } } } })
    }
  }
  if (ops.length) await HospitalErCharge.bulkWrite(ops)
}

export async function listCharges(req: Request, res: Response){
  try{
    const { encounterId } = req.params as any
    const enc = await getEREncounter(String(encounterId))
    const q = req.query as any
    const page = Math.max(1, parseInt(String(q.page || '1')) || 1)
    const limit = Math.max(1, Math.min(200, parseInt(String(q.limit || '50')) || 50))
    const total = await HospitalErCharge.countDocuments({ encounterId: enc._id })
    const rows = await HospitalErCharge.find({ encounterId: enc._id }).sort({ date: -1, createdAt: -1 }).skip((page-1)*limit).limit(limit).lean()
    // Add remaining field to each charge
    const items = rows.map((r: any) => ({
      ...r,
      remaining: Math.max(0, Number(r.amount || 0) - Number(r.paidAmount || 0))
    }))
    res.json({ items, total, page, limit })
  }catch(e){ return handleError(res, e) }
}

export async function listPayments(req: Request, res: Response){
  try{
    const { encounterId } = req.params as any
    const enc = await getEREncounter(String(encounterId))
    const q = req.query as any
    const page = Math.max(1, parseInt(String(q.page || '1')) || 1)
    const limit = Math.max(1, Math.min(200, parseInt(String(q.limit || '50')) || 50))
    const totalCount = await HospitalErPayment.countDocuments({ encounterId: enc._id })
    const rows = await HospitalErPayment.find({ encounterId: enc._id }).sort({ receivedAt: -1 }).skip((page-1)*limit).limit(limit).lean()
    const totals = await computeTotals(String(enc._id))
    res.json({ payments: rows, total: totalCount, page, limit, totals })
  }catch(e){ return handleError(res, e) }
}

export async function createPayment(req: Request, res: Response){
  try{
    const { encounterId } = req.params as any
    const enc = await getEREncounter(String(encounterId))
    const data = createErPaymentSchema.parse(req.body)
    const row = await HospitalErPayment.create({
      ...data,
      encounterId: enc._id,
      patientId: (enc as any).patientId,
      createdByUserId: (req as any).user?._id || (req as any).user?.id || undefined,
      createdByUsername: (req as any).user?.username || undefined,
      portal: req.body.portal || 'hospital',
      source: req.body.portal || 'hospital',
    })

    // Post to finance ledger so it appears in Transactions & Dashboard revenue
    try {
      const pat: any = await LabPatient.findById((enc as any).patientId).lean()
      await postErPaymentJournal({ encounter: enc, payment: row, patient: pat })
    } catch {}

    // FBR fiscalization (ER payment receipt) - best effort
    try {
      const pat: any = await LabPatient.findById((enc as any).patientId).lean()
      const payload: any = {
        refType: 'er_payment',
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
      const r: any = await postFbrInvoiceViaSDC({ module: 'ER_PAYMENT_CREATE', invoiceType: 'IPD', refId: String((row as any)._id), amount: Number((row as any).amount || data.amount || 0), payload })
      if (r) {
        ;(row as any).fbrInvoiceNo = r.fbrInvoiceNo
        ;(row as any).fbrQrCode = r.qrCode
        ;(row as any).fbrStatus = r.status
        ;(row as any).fbrMode = r.mode
        ;(row as any).fbrError = r.error
        try { await (row as any).save() } catch {}
      }
    } catch {}

    // Recalculate paid amounts on charges based on allocations
    await recalcErPaidAmounts(enc._id)

    const totals = await computeTotals(String(enc._id))
    res.status(201).json({ payment: row, totals })
  }catch(e){ return handleError(res, e) }
}

export async function getSummary(req: Request, res: Response){
  try{
    const { encounterId } = req.params as any
    const enc: any = await HospitalEncounter.findById(String(encounterId))
      .populate({ path: 'patientId', select: 'fullName mrn phoneNormalized address age gender' })
      .populate({ path: 'doctorId', select: 'name' })
      .populate({ path: 'departmentId', select: 'name' })
      .lean()
    if (!enc) throw { status: 404, error: 'Encounter not found' }
    const totals = await computeTotals(String(enc._id))
    res.json({ encounter: enc, encounterId: String(enc._id), totals })
  }catch(e){ return handleError(res, e) }
}
