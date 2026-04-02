import { Request, Response } from 'express'
import { PatientUser } from '../models/PatientUser'
import { LabPatient } from '../../lab/models/Patient'
import { HospitalPrescription } from '../../hospital/models/Prescription'
import { HospitalToken } from '../../hospital/models/Token'
import { HospitalAppointment } from '../../hospital/models/Appointment'

function normDigits(s?: string) {
  return String(s || '').replace(/\D+/g, '')
}

export async function list(req: Request, res: Response) {
  const username = String((req as any).user?.username || '').trim().toLowerCase()
  if (!username) return res.status(401).json({ message: 'Unauthorized' })

  const user: any = await PatientUser.findOne({ username }).lean()
  if (!user) return res.status(401).json({ message: 'Unauthorized' })

  const phoneN = normDigits(user.phoneNumber)

  // IMPORTANT: A single patient-portal user may map to multiple LabPatient records over time
  // (e.g. older appointments created a new LabPatient; newer tokens/prescriptions reference another).
  // So we resolve ALL likely patientIds and fetch prescriptions for the full set.
  const patientIds = new Set<string>()

  try {
    const appts: any[] = await HospitalAppointment.find({ createdByUsername: username, portal: 'patient', patientId: { $ne: null } })
      .select('patientId')
      .lean()
    for (const a of appts) {
      if (a?.patientId) patientIds.add(String(a.patientId))
    }
  } catch {}

  try {
    const toks: any[] = await HospitalToken.find({ createdByUsername: username, patientId: { $ne: null } })
      .select('patientId')
      .lean()
    for (const t of toks) {
      if (t?.patientId) patientIds.add(String(t.patientId))
    }
  } catch {}

  if (phoneN) {
    try {
      const patient = await LabPatient.findOne({ phoneNormalized: phoneN }).select('_id').lean()
      if (patient?._id) patientIds.add(String((patient as any)._id))
    } catch {}
  }

  if (patientIds.size === 0) return res.json({ prescriptions: [] })
  const patientIdList = Array.from(patientIds)

  const rows = await HospitalPrescription.find({ patientId: { $in: patientIdList }, shareToPortal: true })
    .sort({ createdAt: -1 })
    .populate({
      path: 'patientId',
      select: 'fullName mrn gender phoneNormalized fatherName age address',
    })
    .populate({
      path: 'encounterId',
      select: 'doctorId patientId startAt',
      populate: [
        { path: 'doctorId', select: 'name' },
        { path: 'patientId', select: 'fullName mrn gender phoneNormalized fatherName age address' },
      ],
    })
    .lean()

  res.json({ prescriptions: rows })
}

export async function getById(req: Request, res: Response) {
  const username = String((req as any).user?.username || '').trim().toLowerCase()
  if (!username) return res.status(401).json({ message: 'Unauthorized' })

  const user: any = await PatientUser.findOne({ username }).lean()
  if (!user) return res.status(401).json({ message: 'Unauthorized' })

  const phoneN = normDigits(user.phoneNumber)

  const patientIds = new Set<string>()

  try {
    const appts: any[] = await HospitalAppointment.find({ createdByUsername: username, portal: 'patient', patientId: { $ne: null } })
      .select('patientId')
      .lean()
    for (const a of appts) {
      if (a?.patientId) patientIds.add(String(a.patientId))
    }
  } catch {}

  try {
    const toks: any[] = await HospitalToken.find({ createdByUsername: username, patientId: { $ne: null } })
      .select('patientId')
      .lean()
    for (const t of toks) {
      if (t?.patientId) patientIds.add(String(t.patientId))
    }
  } catch {}

  if (phoneN) {
    try {
      const patient = await LabPatient.findOne({ phoneNormalized: phoneN }).select('_id').lean()
      if (patient?._id) patientIds.add(String((patient as any)._id))
    } catch {}
  }

  if (patientIds.size === 0) return res.status(404).json({ error: 'Prescription not found' })
  const patientIdList = Array.from(patientIds)

  const { id } = req.params as any
  const row = await HospitalPrescription.findOne({ _id: String(id), patientId: { $in: patientIdList }, shareToPortal: true })
    .populate({
      path: 'patientId',
      select: 'fullName mrn gender phoneNormalized fatherName age address',
    })
    .populate({
      path: 'encounterId',
      select: 'doctorId patientId startAt',
      populate: [
        { path: 'doctorId', select: 'name' },
        { path: 'patientId', select: 'fullName mrn gender phoneNormalized fatherName age address' },
      ],
    })
    .lean()

  if (!row) return res.status(404).json({ error: 'Prescription not found' })
  res.json({ prescription: row })
}
