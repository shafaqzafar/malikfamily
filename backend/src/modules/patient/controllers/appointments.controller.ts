import { Request, Response } from 'express'
import { HospitalAppointment } from '../../hospital/models/Appointment'
import { HospitalDoctorSchedule } from '../../hospital/models/DoctorSchedule'
import { HospitalDoctor } from '../../hospital/models/Doctor'
import { HospitalDepartment } from '../../hospital/models/Department'
import { LabPatient } from '../../lab/models/Patient'

// Helper functions for slot calculation
function toMin(hhmm: string): number {
  const [h, m] = (hhmm || '').split(':').map(x => parseInt(x, 10) || 0)
  return h * 60 + m
}

function fromMin(min: number): string {
  const h = Math.floor(min / 60).toString().padStart(2, '0')
  const m = (min % 60).toString().padStart(2, '0')
  return `${h}:${m}`
}

function computeSlotStartEnd(startTime: string, slotMinutes: number, slotNo: number) {
  const startMin = toMin(startTime) + (slotNo - 1) * slotMinutes
  return {
    start: fromMin(startMin),
    end: fromMin(startMin + slotMinutes)
  }
}

function computeSlotIndex(startTime: string, endTime: string, slotMinutes: number, apptStart: string): number | null {
  const startMin = toMin(startTime)
  const endMin = toMin(endTime)
  const apptMin = toMin(apptStart)
  if (apptMin < startMin || apptMin >= endMin) return null
  const idx = Math.floor((apptMin - startMin) / slotMinutes) + 1
  const totalSlots = Math.floor((endMin - startMin) / slotMinutes)
  if (idx < 1 || idx > totalSlots) return null
  return idx
}

async function nextGlobalMrn(): Promise<string> {
  const last: any = await LabPatient.findOne().sort({ createdAt: -1 }).lean()
  const lastNum = parseInt(String(last?.mrn || '').replace(/\D/g, ''), 10) || 0
  return 'MR-' + (lastNum + 1).toString().padStart(3, '0')
}

// Helper to normalize phone
function normalizePhone(phone: string): string {
  const digits = String(phone || '').replace(/\D/g, '')
  if (digits.length === 10 && digits.startsWith('0')) return digits
  if (digits.length === 11 && digits.startsWith('0')) return digits
  if (digits.length === 10 && !digits.startsWith('0')) return '0' + digits
  return digits
}

export async function create(req: Request, res: Response) {
  try {
    const username = String((req as any).user?.username || '').trim().toLowerCase()
    if (!username) return res.status(401).json({ message: 'Unauthorized' })

    const body = req.body as any
    const data = {
      phone: String(body.phone || ''),
      patientName: String(body.patientName || ''),
      age: body.age ? Number(body.age) : undefined,
      gender: body.gender ? String(body.gender) : undefined,
      doctorId: body.doctorId ? String(body.doctorId) : undefined,
      departmentId: body.departmentId ? String(body.departmentId) : undefined,
      dateIso: body.dateIso ? String(body.dateIso) : undefined,
      apptStart: body.apptStart ? String(body.apptStart) : undefined,
      billingType: body.billingType ? String(body.billingType) : 'Cash',
    }

    // Validate required fields
    if (!data.patientName) return res.status(400).json({ error: 'Patient name is required' })
    if (!data.phone) return res.status(400).json({ error: 'Phone is required' })
    if (!data.doctorId) return res.status(400).json({ error: 'Doctor is required' })
    if (!data.dateIso) return res.status(400).json({ error: 'Appointment date is required' })
    if (!data.apptStart) return res.status(400).json({ error: 'Appointment time is required' })

    // Find or create patient
    let patient: any = null
    const phoneNormalized = normalizePhone(data.phone)
    if (phoneNormalized) {
      patient = await LabPatient.findOne({ phoneNormalized }).lean()
    }
    if (!patient && data.patientName) {
      const mrn = await nextGlobalMrn()
      patient = await LabPatient.create({
        mrn,
        fullName: data.patientName,
        phoneNormalized,
        gender: data.gender,
        age: data.age,
        createdAtIso: new Date().toISOString(),
      })
    } else if (patient && data.age) {
      // Update existing patient with new age if provided
      patient = await LabPatient.findByIdAndUpdate(
        patient._id,
        { $set: { age: data.age } },
        { new: true }
      ).lean()
    }

    // Get doctor schedule for the date
    const schedules = await HospitalDoctorSchedule.find({
      doctorId: data.doctorId,
      dateIso: data.dateIso,
    }).lean()

    if (!schedules.length) {
      return res.status(400).json({ error: 'No schedule found for this doctor on selected date' })
    }

    // Use first schedule
    const sched = schedules[0]
    const slotMinutes = Number(sched.slotMinutes || 15)

    // Resolve consultant fee (best-effort)
    let consultantFee: number | undefined = undefined
    try {
      const doctor: any = data.doctorId ? await HospitalDoctor.findById(String(data.doctorId)).lean() : null
      const departmentId = (data.departmentId && String(data.departmentId).trim()) ? String(data.departmentId) : (sched as any)?.departmentId ? String((sched as any).departmentId) : ''
      const department: any = departmentId ? await HospitalDepartment.findById(departmentId).lean() : null
      if (department && doctor) {
        consultantFee = Number(doctor?.opdBaseFee ?? department?.opdBaseFee ?? 0)
      } else if (doctor) {
        consultantFee = Number(doctor?.opdBaseFee ?? 0)
      } else if (department) {
        consultantFee = Number(department?.opdBaseFee ?? 0)
      }
      if (!Number.isFinite(Number(consultantFee))) consultantFee = undefined
    } catch {
      consultantFee = undefined
    }

    // Compute slot number from apptStart
    const slotNo = computeSlotIndex(sched.startTime, sched.endTime, slotMinutes, data.apptStart)
    if (!slotNo) {
      return res.status(400).json({ error: 'Invalid appointment time for this schedule' })
    }

    // Check if slot is already booked
    const existingAppt = await HospitalAppointment.findOne({
      scheduleId: String(sched._id),
      slotNo,
      status: { $in: ['booked', 'confirmed', 'checked-in'] }
    }).lean()

    if (existingAppt) {
      return res.status(409).json({ error: 'This slot is already booked' })
    }

    // Compute slot start/end
    const se = computeSlotStartEnd(sched.startTime, slotMinutes, slotNo)

    // Create appointment
    const apptData: any = {
      dateIso: data.dateIso,
      portal: 'patient',
      doctorId: data.doctorId,
      scheduleId: String(sched._id),
      slotNo,
      slotStart: se.start,
      slotEnd: se.end,
      fee: consultantFee,
      patientId: patient?._id || undefined,
      mrn: patient?.mrn || undefined,
      patientName: patient ? patient.fullName : data.patientName,
      phoneNormalized: patient ? patient.phoneNormalized : phoneNormalized,
      gender: patient ? patient.gender : data.gender,
      age: data.age != null ? data.age : (patient?.age || undefined),
      status: 'booked',
      createdByUsername: username,
    }
    // Only add departmentId if it's a valid non-empty string
    if (data.departmentId && String(data.departmentId).trim()) {
      apptData.departmentId = String(data.departmentId)
    } else if (sched.departmentId) {
      apptData.departmentId = String(sched.departmentId)
    }
    const appt = await HospitalAppointment.create(apptData)

    res.status(201).json({ appointment: appt, patient })
  } catch (e: any) {
    console.error('Patient portal create appointment error:', e)
    console.error('Error stack:', e?.stack)
    console.error('Request body:', req.body)
    console.error('Request user:', (req as any).user)
    res.status(500).json({ error: 'Failed to create appointment', details: e?.message })
  }
}

export async function list(req: Request, res: Response) {
  const q = req.query as any
  const date = q.date ? String(q.date) : ''
  const from = q.from ? String(q.from) : ''
  const to = q.to ? String(q.to) : ''

  const username = String((req as any).user?.username || '').trim().toLowerCase()
  if (!username) return res.status(401).json({ message: 'Unauthorized' })

  const crit: any = { createdByUsername: username, portal: 'patient' }
  if (date) {
    crit.dateIso = date
  } else if (from || to) {
    crit.dateIso = {}
    if (from) crit.dateIso.$gte = from
    if (to) crit.dateIso.$lte = to
  }
  crit.status = { $ne: 'cancelled' }

  const rows = await HospitalAppointment.find(crit)
    .sort({ createdAt: -1 })
    .populate('patientId', 'fullName mrn gender phoneNormalized dateOfBirth age')
    .populate('doctorId', 'name opdBaseFee opdPublicFee opdPrivateFee opdFollowupFee')
    .populate('departmentId', 'name opdBaseFee opdFollowupFee')
    .lean()

  // Backfill fee if missing (best-effort)
  for (const r of rows as any[]) {
    if (r?.fee != null) continue
    try {
      const d: any = r?.doctorId && typeof r.doctorId === 'object' ? r.doctorId : null
      const dep: any = r?.departmentId && typeof r.departmentId === 'object' ? r.departmentId : null
      const fee = (d && (d as any).opdBaseFee != null) ? Number((d as any).opdBaseFee)
        : (dep && (dep as any).opdBaseFee != null) ? Number((dep as any).opdBaseFee)
        : undefined
      if (fee != null && Number.isFinite(fee)) r.fee = fee
    } catch {}
  }

  res.json({ appointments: rows })
}

export async function update(req: Request, res: Response) {
  const id = String(req.params.id || '')
  if (!id) return res.status(400).json({ message: 'id required' })

  const username = String((req as any).user?.username || '').trim().toLowerCase()
  if (!username) return res.status(401).json({ message: 'Unauthorized' })

  const body = (req.body || {}) as any
  const patch: any = {}
  if (Object.prototype.hasOwnProperty.call(body, 'dateIso')) patch.dateIso = String(body.dateIso || '')
  if (Object.prototype.hasOwnProperty.call(body, 'slotStart')) patch.slotStart = String(body.slotStart || '')
  if (Object.prototype.hasOwnProperty.call(body, 'patientName')) patch.patientName = String(body.patientName || '')
  if (Object.prototype.hasOwnProperty.call(body, 'phone')) patch.phoneNormalized = normalizePhone(body.phone)
  if (Object.prototype.hasOwnProperty.call(body, 'age')) patch.age = body.age != null ? String(body.age) : undefined
  if (Object.prototype.hasOwnProperty.call(body, 'gender')) patch.gender = String(body.gender || '')
  if (Object.prototype.hasOwnProperty.call(body, 'guardianRel')) patch.guardianRel = String(body.guardianRel || '')
  if (Object.prototype.hasOwnProperty.call(body, 'guardianName')) patch.guardianName = String(body.guardianName || '')
  if (Object.prototype.hasOwnProperty.call(body, 'cnic')) patch.cnic = String(body.cnic || '')
  if (Object.prototype.hasOwnProperty.call(body, 'address')) patch.address = String(body.address || '')

  const updated = await HospitalAppointment.findOneAndUpdate(
    { _id: id, createdByUsername: username, portal: 'patient', status: { $ne: 'cancelled' } },
    { $set: patch },
    { new: true }
  )
    .populate('patientId', 'fullName mrn gender phoneNormalized dateOfBirth age')
    .populate('doctorId', 'name')
    .populate('departmentId', 'name')
    .lean()

  if (!updated) return res.status(404).json({ message: 'Appointment not found' })
  res.json({ appointment: updated })
}

export async function remove(req: Request, res: Response) {
  const id = String(req.params.id || '')
  if (!id) return res.status(400).json({ message: 'id required' })

  const username = String((req as any).user?.username || '').trim().toLowerCase()
  if (!username) return res.status(401).json({ message: 'Unauthorized' })

  const appt: any = await HospitalAppointment.findOne({ _id: id, createdByUsername: username, portal: 'patient' }).lean()
  if (!appt) return res.status(404).json({ message: 'Appointment not found' })

  // Hard delete for patient portal appointments (they haven't been converted to tokens yet)
  await HospitalAppointment.deleteOne({ _id: id, createdByUsername: username, portal: 'patient' })
  return res.json({ success: true, deleted: true })
}

export async function upload(req: Request, res: Response) {
  const id = String(req.params.id || '')
  if (!id) return res.status(400).json({ message: 'id required' })

  const username = String((req as any).user?.username || '').trim().toLowerCase()
  if (!username) return res.status(401).json({ message: 'Unauthorized' })

  const body = (req.body || {}) as any
  const fileName = String(body.fileName || '')
  const mimeType = String(body.mimeType || '')
  const dataBase64 = String(body.dataBase64 || '')
  if (!dataBase64) return res.status(400).json({ message: 'dataBase64 required' })

  const patch: any = {
    patientUpload: {
      fileName: fileName || undefined,
      mimeType: mimeType || undefined,
      dataBase64,
      uploadedAt: new Date().toISOString(),
    },
  }

  const updated = await HospitalAppointment.findOneAndUpdate(
    { _id: id, createdByUsername: username, portal: 'patient', status: { $ne: 'cancelled' } },
    { $set: patch },
    { new: true }
  )
    .populate('patientId', 'fullName mrn gender phoneNormalized dateOfBirth age')
    .populate('doctorId', 'name')
    .populate('departmentId', 'name')
    .lean()

  if (!updated) return res.status(404).json({ message: 'Appointment not found' })
  res.json({ appointment: updated })
}
