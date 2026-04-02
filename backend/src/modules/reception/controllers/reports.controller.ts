import { Request, Response } from 'express'
import { Types } from 'mongoose'
import { HospitalUser } from '../../hospital/models/User'
import { HospitalShift } from '../../hospital/models/Shift'
import { HospitalToken } from '../../hospital/models/Token'
import { HospitalErPayment } from '../../hospital/models/ErPayment'
import { HospitalIpdPayment } from '../../hospital/models/IpdPayment'
import { HospitalIpdBillingItem } from '../../hospital/models/IpdBillingItem'
import { FinanceJournal } from '../../hospital/models/FinanceJournal'
import { HospitalEncounter } from '../../hospital/models/Encounter'
import { LabPatient } from '../../lab/models/Patient'
import { LabOrder } from '../../lab/models/Order'
import { DiagnosticOrder } from '../../diagnostic/models/Order'

function toMin(hhmm: string){
  const [h,m] = String(hhmm || '').split(':').map(x => parseInt(x, 10) || 0)
  return h * 60 + m
}

function shiftWindowForDate(shift: any, baseDateIso: string){
  const startMin = toMin(String(shift?.start || '00:00'))
  const endMin = toMin(String(shift?.end || '00:00'))

  const start = new Date(`${baseDateIso}T00:00:00.000`)
  start.setMinutes(start.getMinutes() + startMin)

  let end = new Date(`${baseDateIso}T00:00:00.000`)
  end.setMinutes(end.getMinutes() + endMin)

  // Overnight shift
  if (endMin <= startMin){
    end = new Date(end.getTime() + 24 * 60 * 60 * 1000)
  }

  return { start, end }
}

function jsonError(res: Response, status: number, message: string){
  return res.status(status).json({ error: message })
}

export async function myActivity(req: Request, res: Response){
  const mode = String((req.query as any)?.mode || 'today') as 'today'|'shift'

  const username = String((req as any).user?.username || '').trim().toLowerCase()
  const userId = String((req as any).user?._id || (req as any).user?.id || '').trim()
  if (!username && !userId) return jsonError(res, 401, 'Unauthorized')

  const todayIso = new Date().toISOString().slice(0,10)

  let rangeStart = new Date(`${todayIso}T00:00:00.000`)
  let rangeEnd = new Date(`${todayIso}T23:59:59.999`)
  let shiftMeta: any = undefined

  if (mode === 'shift'){
    const u: any = userId
      ? await HospitalUser.findById(userId).select('shiftId username').lean()
      : await HospitalUser.findOne({ username }).select('shiftId username').lean()

    if (!u) return jsonError(res, 404, 'User not found')
    if (!u.shiftId) return jsonError(res, 400, 'Shift not assigned')

    const shift: any = await HospitalShift.findById(String(u.shiftId)).lean()
    if (!shift) return jsonError(res, 404, 'Shift not found')

    const w = shiftWindowForDate(shift, todayIso)
    rangeStart = w.start
    rangeEnd = w.end
    shiftMeta = { id: String(shift._id), name: shift.name, start: shift.start, end: shift.end }
  }

  const rangeStartIso = rangeStart.toISOString()
  const rangeEndIso = rangeEnd.toISOString()

  const performedBy = username || undefined
  const performedByExact = String((req as any).user?.username || '').trim()

  // Reception portal report is portal-based (not user-based): show everything created from Reception portal.
  const portal = 'reception'

  const [tokens, erPayments, ipdJournals, labCarts, diagnosticCarts] = await Promise.all([
    HospitalToken.find({
      portal,
      ...(performedByExact ? { createdByUsername: new RegExp(`^${performedByExact}$`, 'i') } : {}),
      createdAt: { $gte: rangeStart, $lte: rangeEnd },
    })
      .select('dateIso tokenNo fee discount status corporateId createdAt patientName mrn createdByUsername portal')
      .sort({ createdAt: -1 })
      .lean(),

    HospitalErPayment.find({
      portal,
      ...(performedByExact ? { createdByUsername: new RegExp(`^${performedByExact}$`, 'i') } : {}),
      receivedAt: { $gte: rangeStart, $lte: rangeEnd },
    })
      .select('amount method refNo receivedAt createdAt receivedBy notes createdByUsername portal patientId encounterId')
      .sort({ receivedAt: -1 })
      .lean(),

    FinanceJournal.find({
      refType: 'ipd_payment',
      createdAt: { $gte: rangeStart, $lte: rangeEnd },
      'lines.tags.portal': portal,
      ...(performedByExact ? { 'lines.tags.createdByUsername': new RegExp(`^${performedByExact}$`, 'i') } : {}),
    }).select('refId dateIso memo lines createdAt').sort({ createdAt: -1 }).lean(),

    LabOrder.find({
      portal,
      ...(performedByExact ? { createdByUsername: new RegExp(`^${performedByExact}$`, 'i') } : {}),
      createdAt: { $gte: rangeStart, $lte: rangeEnd },
    })
      .select('createdAt tokenNo patient subtotal discount net receivedAmount receivableAmount status createdByUsername portal')
      .sort({ createdAt: -1 })
      .lean(),

    DiagnosticOrder.find({
      createdAt: { $gte: rangeStart, $lte: rangeEnd },
      portal,
      ...(performedByExact ? { createdByUsername: new RegExp(`^${performedByExact}$`, 'i') } : {}),
    } as any)
      .select('createdAt tokenNo patient subtotal discount net receivedAmount receivableAmount status createdByUsername portal')
      .sort({ createdAt: -1 })
      .lean(),
  ])

  const ipdPaymentIds = Array.from(new Set((ipdJournals || []).map((j: any) => String(j.refId || '')).filter(Boolean)))

  // Convert string IDs to ObjectIds for MongoDB queries
  const toObjectIds = (ids: string[]) => ids.map(id => {
    try { return new Types.ObjectId(id) } catch { return null }
  }).filter(Boolean) as Types.ObjectId[]

  const ipdPaymentsRaw = ipdPaymentIds.length
    ? await HospitalIpdPayment.find({ _id: { $in: toObjectIds(ipdPaymentIds) } })
        .select('amount method refNo receivedAt createdAt receivedBy notes encounterId patientId portal')
        .sort({ receivedAt: -1 })
        .lean()
    : ([] as any[])

  // Calculate pending amounts for IPD payments
  const ipdEncounterIds = Array.from(new Set((ipdPaymentsRaw || []).map((p: any) => String(p.encounterId || '')).filter(Boolean)))
  const ipdBillingItems = ipdEncounterIds.length
    ? await HospitalIpdBillingItem.find({ encounterId: { $in: toObjectIds(ipdEncounterIds) } }).select('encounterId amount').lean()
    : []
  const ipdAllPayments = ipdEncounterIds.length
    ? await HospitalIpdPayment.find({ encounterId: { $in: toObjectIds(ipdEncounterIds) } }).select('encounterId amount').lean()
    : []

  // Calculate totals per encounter
  const chargesByEncounter: Record<string, number> = {}
  const paidByEncounter: Record<string, number> = {}
  for (const item of ipdBillingItems) {
    const id = String(item.encounterId || '')
    if (id) chargesByEncounter[id] = (chargesByEncounter[id] || 0) + Number(item.amount || 0)
  }
  for (const pay of ipdAllPayments) {
    const id = String(pay.encounterId || '')
    if (id) paidByEncounter[id] = (paidByEncounter[id] || 0) + Number(pay.amount || 0)
  }

  // Fetch encounters for IPD payments to get admission info
  const encounters = ipdEncounterIds.length
    ? await HospitalEncounter.find({ _id: { $in: toObjectIds(ipdEncounterIds) } }).select('_id admissionNo patientId').lean()
    : []
  const encounterMap = new Map(encounters.map((e: any) => [String(e._id), e]))

  // Fetch patients directly from payment patientIds
  const paymentPatientIds = Array.from(new Set((ipdPaymentsRaw || []).map((p: any) => String(p.patientId)).filter(Boolean)))
  const patients = paymentPatientIds.length
    ? await LabPatient.find({ _id: { $in: toObjectIds(paymentPatientIds) } }).select('_id fullName mrn').lean()
    : []
  const patientMap = new Map(patients.map((p: any) => [String(p._id), p]))

  const ipdPayments = (ipdPaymentsRaw || []).map((p: any) => {
    const encId = String(p.encounterId || '')
    const totalCharges = chargesByEncounter[encId] || 0
    const totalPaid = paidByEncounter[encId] || 0
    const pending = Math.max(0, totalCharges - totalPaid)
    const encounter = encounterMap.get(encId)
    const patient = patientMap.get(String(p.patientId))
    return {
      ...p,
      pendingAmount: pending,
      performedBy: performedBy,
      admissionNo: encounter?.admissionNo || '-',
      mrn: patient?.mrn || '-',
      patientName: patient?.fullName || '-',
    }
  })

  const erEncounterIds = Array.from(new Set((erPayments || []).map((p: any) => String(p.encounterId || '')).filter(Boolean)))
  const erEncounters = erEncounterIds.length
    ? await HospitalEncounter.find({ _id: { $in: toObjectIds(erEncounterIds) } }).select('_id patientId').lean()
    : []
  const erEncounterMap = new Map(erEncounters.map((e: any) => [String(e._id), e]))

  const erPatientIds = Array.from(new Set((erPayments || []).map((p: any) => {
    const pid = String(p.patientId || '')
    if (pid) return pid
    const enc: any = erEncounterMap.get(String(p.encounterId || ''))
    return String(enc?.patientId || '')
  }).filter(Boolean)))
  const erPatients = erPatientIds.length
    ? await LabPatient.find({ _id: { $in: toObjectIds(erPatientIds) } }).select('_id fullName mrn').lean()
    : []
  const erPatientMap = new Map(erPatients.map((p: any) => [String(p._id), p]))

  const erTokensRaw = erEncounterIds.length
    ? await HospitalToken.find({ encounterId: { $in: toObjectIds(erEncounterIds) } })
        .select('tokenNo encounterId patientId mrn patientName createdAt')
        .sort({ createdAt: -1 })
        .lean()
    : ([] as any[])
  const erTokenByEncounterId = new Map<string, any>()
  for (const t of (erTokensRaw || [])){
    const encId = String((t as any).encounterId || '').trim()
    if (encId && !erTokenByEncounterId.has(encId)) erTokenByEncounterId.set(encId, t)
  }

  const tokenByPatientId = new Map<string, any>()
  const tokenByMrn = new Map<string, any>()
  const tokenByEncounterId = new Map<string, any>()
  for (const t of (tokens || [])){
    const pid = String((t as any).patientId || '').trim()
    if (pid && !tokenByPatientId.has(pid)) tokenByPatientId.set(pid, t)
    const mrn = String((t as any).mrn || '').trim()
    if (mrn && !tokenByMrn.has(mrn)) tokenByMrn.set(mrn, t)
    const encId = String((t as any).encounterId || '').trim()
    if (encId && !tokenByEncounterId.has(encId)) tokenByEncounterId.set(encId, t)
  }

  const erPaymentsEnriched = (erPayments || []).map((p: any) => {
    const enc: any = erEncounterMap.get(String(p.encounterId || ''))
    const pid = String(p.patientId || enc?.patientId || '')
    const pat: any = erPatientMap.get(pid)
    const mrn = String(pat?.mrn || '').trim() || '-'
    const encounterId = String(p.encounterId || '').trim()
    const token =
      (encounterId && erTokenByEncounterId.get(encounterId)) ||
      (encounterId && tokenByEncounterId.get(encounterId)) ||
      (pid && tokenByPatientId.get(pid)) ||
      (mrn && mrn !== '-' ? tokenByMrn.get(mrn) : undefined)
    const tokenNo = token?.tokenNo || (p as any).tokenNo || (p as any).refNo || '-'
    return {
      ...p,
      tokenNo,
      mrn,
      patientName: pat?.fullName || token?.patientName || '-',
    }
  })

  const tokenCashRows = tokens.filter((t: any) => !t.corporateId && String(t.status || '') !== 'returned')
  const tokenRevenue = tokenCashRows.reduce((s: number, t: any) => s + Number(t.fee || 0), 0)
  const tokenDiscount = tokenCashRows.reduce((s: number, t: any) => s + Number(t.discount || 0), 0)

  const erTotal = (erPayments || []).reduce((s: number, p: any) => s + Number(p.amount || 0), 0)
  const ipdTotal = (ipdPayments || []).reduce((s: number, p: any) => s + Number(p.amount || 0), 0)

  const labCartTotal = (labCarts || []).reduce((s: number, o: any) => s + Number(o.receivedAmount || 0), 0)
  const diagnosticCartTotal = (diagnosticCarts || []).reduce((s: number, o: any) => s + Number(o.receivedAmount || 0), 0)

  const inflowTotal = tokenRevenue + erTotal + ipdTotal + labCartTotal + diagnosticCartTotal
  const outflowTotal = 0
  const net = inflowTotal - outflowTotal

  res.json({
    mode,
    user: { username: performedBy },
    shift: shiftMeta,
    range: { start: rangeStartIso, end: rangeEndIso },
    summary: {
      tokens: { count: tokens.length, revenue: tokenRevenue, discount: tokenDiscount },
      erPayments: { count: erPayments.length, total: erTotal },
      ipdPayments: { count: ipdPayments.length, total: ipdTotal },
      labCarts: { count: (labCarts || []).length, total: labCartTotal },
      diagnosticCarts: { count: (diagnosticCarts || []).length, total: diagnosticCartTotal },
      inflowTotal,
      outflowTotal,
      net,
    },
    items: {
      tokens,
      erPayments: erPaymentsEnriched || [],
      ipdPayments: ipdPayments || [],
      labCarts: labCarts || [],
      diagnosticCarts: diagnosticCarts || [],
    }
  })
}
