import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { patientApi, hospitalApi } from '../../utils/api'

export default function Patient_AddAppointment() {
  const navigate = useNavigate()

  const user = useMemo(() => {
    try {
      const raw = localStorage.getItem('patient.user')
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  }, [])

  useEffect(() => {
    try {
      const tok = localStorage.getItem('patient.token')
      if (!tok) navigate('/patient/login')
    } catch {
      navigate('/patient/login')
    }
  }, [navigate])

  const fullName = String(user?.fullName || user?.username || 'Patient')

  const [doctors, setDoctors] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    phone: '',
    patientName: '',
    mrNumber: '',
    age: '',
    gender: '',
    guardianType: '',
    guardianName: '',
    cnic: '',
    address: '',
    doctor: '',
    department: '',
    billingType: 'Cash',
    tokenType: 'Public',
    fee: '',
    appointmentDate: new Date().toISOString().slice(0, 10),
    appointmentTime: '',
    selectedSlot: null as any,
  })

  const finalFee = useMemo(() => {
    const fee = Number(form.fee || 0)
    return Math.max(0, fee)
  }, [form.fee])

  const set = (k: keyof typeof form, v: any) => setForm((p) => ({ ...p, [k]: v }))

  function toMin(hhmm: string) {
    const [h, m] = (hhmm || '').split(':').map(x => parseInt(x, 10) || 0)
    return h * 60 + m
  }
  function fromMin(min: number) {
    const h = Math.floor(min / 60).toString().padStart(2, '0')
    const m = (min % 60).toString().padStart(2, '0')
    return `${h}:${m}`
  }
  const [availableSlots, setAvailableSlots] = useState<any[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)

  // Load available slots when doctor or date changes
  useEffect(() => {
    if (!form.doctor || !form.appointmentDate) {
      setAvailableSlots([])
      return
    }
    ;(async () => {
      setLoadingSlots(true)
      try {
        const res: any = await hospitalApi.listDoctorSchedules({ doctorId: form.doctor, date: form.appointmentDate })
        const scheds = Array.isArray(res?.schedules) ? res.schedules : []
        // Build available slots from schedules
        const slots: any[] = []
        let scheduleFee = 0
        const selectedDoctor = doctors.find(d => String(d._id) === form.doctor)
        const tokenType = form.tokenType || 'Public'
        // Get fee from doctor if schedule doesn't have one
        const doctorFee = tokenType === 'Private' 
          ? (selectedDoctor?.opdPrivateFee || selectedDoctor?.opdBaseFee || 0)
          : (selectedDoctor?.opdPublicFee || selectedDoctor?.opdBaseFee || 0)
        // Default fallback fee
        const defaultFee = 500
        for (const s of scheds) {
          const startMin = toMin(s.startTime)
          const endMin = toMin(s.endTime)
          const slotMins = Math.max(5, Number(s.slotMinutes || 15))
          const totalSlots = Math.floor((endMin - startMin) / slotMins)
          // Use schedule fee or fall back to doctor fee or default
          const fee = Number(s.fee || doctorFee || defaultFee)
          if (fee > 0) scheduleFee = fee
          for (let i = 0; i < totalSlots; i++) {
            const slotStart = startMin + i * slotMins
            const slotEnd = slotStart + slotMins
            slots.push({
              scheduleId: s._id,
              slotNo: i + 1,
              start: fromMin(slotStart),
              end: fromMin(slotEnd),
              startMin: slotStart,
              endMin: slotEnd,
              fee: fee,
            })
          }
        }
        setAvailableSlots(slots)
        // Auto-set fee if we have one from schedules or doctor or default
        const finalFee = scheduleFee || doctorFee || defaultFee
        if (finalFee > 0) {
          set('fee', String(finalFee))
        }
      } catch {
        setAvailableSlots([])
      } finally {
        setLoadingSlots(false)
      }
    })()
  }, [form.doctor, form.appointmentDate, form.tokenType])

  const [settings, setSettings] = useState<any>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const s = await hospitalApi.getSettings() as any
        setSettings(s?.settings || s)
      } catch {}
    })()
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        const d1 = await patientApi.listDoctors()
        setDoctors(Array.isArray(d1?.doctors) ? d1.doctors : [])
      } catch {}
    })()
  }, [])

  const resolveMrn = async () => {
    try {
      if (!String(form.phone || '').trim()) return
      if (!String(form.patientName || '').trim()) return
      const r: any = await patientApi.findOrCreatePatient({
        fullName: form.patientName,
        phone: form.phone,
        gender: form.gender || undefined,
        age: form.age || undefined,
        guardianRel: form.guardianType || undefined,
        guardianName: form.guardianName || undefined,
        cnic: form.cnic || undefined,
        address: form.address || undefined,
      })
      const mrn = String(r?.patient?.mrn || '')
      if (mrn) set('mrNumber', mrn)
    } catch {}
  }

  const onSubmit = async () => {
    setError('')
    if (!String(form.patientName || '').trim()) return setError('Patient name is required')
    if (!String(form.phone || '').trim()) return setError('Phone is required')
    if (!form.doctor) return setError('Please select a doctor')
    if (!form.appointmentTime) return setError('Please select a time slot')
    setLoading(true)
    try {
      const r: any = await patientApi.createAppointment({
        phone: form.phone,
        patientName: form.patientName,
        age: form.age || undefined,
        gender: form.gender || undefined,
        guardianRel: form.guardianType || undefined,
        guardianName: form.guardianName || undefined,
        cnic: form.cnic || undefined,
        address: form.address || undefined,
        departmentId: form.doctor ? doctors.find(d => String(d._id) === form.doctor)?.primaryDepartmentId : undefined,
        doctorId: form.doctor || undefined,
        billingType: form.billingType as any,
        dateIso: form.appointmentDate || undefined,
        apptStart: form.appointmentTime || undefined,
      })
      const mrn = String(r?.patient?.mrn || '')
      if (mrn) set('mrNumber', mrn)
      navigate('/patient/appointments')
    } catch (e: any) {
      console.error('Create appointment error:', e)
      const errorMsg = e?.response?.data?.error || e?.response?.data?.details || e?.message || 'Failed to add appointment'
      setError(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  const onLogout = async () => {
    try {
      await patientApi.logout()
    } catch {}
    navigate('/patient/login')
  }

  return (
    <div className="min-h-dvh bg-slate-50">
      <div className="flex min-h-dvh">
        <aside className="w-72 border-r border-slate-200 bg-white">
          <div className="px-5 py-5">
            <div className="text-sm font-semibold text-slate-500">Patient</div>
            <div className="mt-1 text-base font-extrabold text-slate-900 truncate">{fullName}</div>
          </div>
          <div className="px-3 pb-3">
            <button
              onClick={() => navigate('/patient/add-appointment')}
              className="w-full rounded-xl bg-slate-900 px-4 py-3 text-left text-sm font-semibold text-white hover:bg-slate-800"
            >
              Add Appointment
            </button>
          </div>
          <div className="px-3 pb-3">
            <button
              onClick={() => navigate('/patient/appointments')}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Appointments
            </button>
          </div>
          <div className="px-3 pb-3">
            <button
              onClick={() => navigate('/patient/prescriptions')}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Prescriptions
            </button>
          </div>
          <div className="px-3">
            <button
              onClick={onLogout}
              className="w-full rounded-xl border border-red-200 bg-white px-4 py-3 text-left text-sm font-semibold text-red-700 hover:bg-red-50"
            >
              Logout
            </button>
          </div>
        </aside>

        <main className="flex-1">
          <div className="mx-auto max-w-7xl px-6 py-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="text-xl font-extrabold text-slate-900">Add Appointment</h1>
                <p className="mt-1 text-sm text-slate-600">Fill the details below.</p>
              </div>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="text-sm font-bold text-slate-900">Patient Information</div>

                {error ? (
                  <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                ) : null}

                <div className="mt-4 grid gap-4">
                  <div>
                    <div className="text-xs font-semibold text-slate-600">Phone</div>
                    <input
                      value={form.phone}
                      onChange={(e) => set('phone', e.target.value)}
                      onBlur={resolveMrn}
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                      placeholder="Type phone to search"
                    />
                  </div>

                  <div>
                    <div className="text-xs font-semibold text-slate-600">Patient Name</div>
                    <input
                      value={form.patientName}
                      onChange={(e) => set('patientName', e.target.value)}
                      onBlur={resolveMrn}
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                      placeholder="Type name to search"
                    />
                  </div>

                  <div>
                    <div className="text-xs font-semibold text-slate-600">Search by MR Number</div>
                    <input
                      value={form.mrNumber}
                      readOnly
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                      placeholder="MR# will be assigned automatically"
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <div className="text-xs font-semibold text-slate-600">Age</div>
                      <input
                        value={form.age}
                        onChange={(e) => set('age', e.target.value)}
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                        placeholder="e.g., 25"
                      />
                    </div>

                    <div>
                      <div className="text-xs font-semibold text-slate-600">Gender</div>
                      <select
                        value={form.gender}
                        onChange={(e) => set('gender', e.target.value)}
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                      >
                        <option value="">Select gender</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <div className="text-xs font-semibold text-slate-600">CNIC</div>
                      <input
                        value={form.cnic}
                        onChange={(e) => set('cnic', e.target.value)}
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                        placeholder="13-digit CNIC (no dashes)"
                      />
                    </div>
                    <div />
                  </div>

                  <div>
                    <div className="text-xs font-semibold text-slate-600">Address</div>
                    <textarea
                      value={form.address}
                      onChange={(e) => set('address', e.target.value)}
                      className="mt-2 min-h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                      placeholder="Residential Address"
                    />
                  </div>
                </div>

                <div className="mt-6">
                  <div className="text-sm font-bold text-slate-900">Fee Details</div>
                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <div>
                      <div className="text-xs font-semibold text-slate-600">Consultation Fee</div>
                      <input
                        value={form.fee}
                        readOnly
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                        placeholder="Fee"
                      />
                    </div>
                    <div />
                    <div>
                      <div className="text-xs font-semibold text-slate-600">Final Fee</div>
                      <div className="mt-2 w-full rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                        Rs. {finalFee.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="text-sm font-bold text-slate-900">Visit &amp; Billing</div>

                <div className="mt-4 grid gap-4">
                  <div>
                    <div className="text-xs font-semibold text-slate-600">Doctor</div>
                    <select
                      value={form.doctor}
                      onChange={(e) => set('doctor', e.target.value)}
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                    >
                      <option value="">Select doctor</option>
                      {doctors.map((d) => (
                        <option key={String(d?._id)} value={String(d?._id)}>
                          {String(d?.name || '')}
                        </option>
                      ))}
                    </select>
                    <div className="mt-2 text-xs text-slate-500">Doctor selection is optional for IPD.</div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <div className="text-xs font-semibold text-slate-600">Billing Type</div>
                      <select
                        value={form.billingType}
                        onChange={(e) => set('billingType', e.target.value)}
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                      >
                        <option value="Cash">Cash</option>
                        <option value="Card">Bank Account</option>
                        <option value="JazzCash">JazzCash</option>
                      </select>
                    </div>
                  </div>

                  {form.billingType !== 'Cash' && (
                    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                      <p className="font-bold">Payment Instructions:</p>
                      <p className="mt-1">
                        JazzCash and Bank account details are provided on this page. Please send the amount and upload the payment screenshot, then the appointment will be booked.
                      </p>
                    </div>
                  )}

                  {form.billingType === 'Cash' && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                      <p className="font-bold">Cash Payment:</p>
                      <p className="mt-1">
                        Please visit the hospital to pay your amount.
                      </p>
                    </div>
                  )}

                  <div>
                    <div className="text-xs font-semibold text-slate-600">Appointment Date</div>
                    <input
                      type="date"
                      value={form.appointmentDate}
                      onChange={(e) => { set('appointmentDate', e.target.value); set('selectedSlot', null); set('appointmentTime', ''); }}
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                    />
                  </div>

                  {loadingSlots && (
                    <div className="text-sm text-slate-600">Loading available slots...</div>
                  )}

                  {availableSlots.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-slate-600">Select Time Slot</div>
                      <div className="mt-2 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                        {availableSlots.map((slot: any, idx: number) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => { set('selectedSlot', slot); set('appointmentTime', slot.start); const slotFee = slot.fee || 500; set('fee', String(slotFee)); }}
                            className={`rounded-lg border px-2 py-2 text-xs text-center transition-colors ${
                              form.selectedSlot?.start === slot.start
                                ? 'border-slate-900 bg-slate-900 text-white'
                                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <div className="font-medium">{slot.start}</div>
                            <div className="text-[10px] opacity-70">{slot.end}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {form.doctor && form.appointmentDate && availableSlots.length === 0 && !loadingSlots && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                      No available slots for this doctor on selected date.
                    </div>
                  )}

                  <div>
                    <div className="text-xs font-semibold text-slate-600">Token Type</div>
                    <select
                      value={form.tokenType}
                      onChange={(e) => set('tokenType', e.target.value)}
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
                    >
                      <option value="Public">Public</option>
                      <option value="Private">Private</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-4">
                    <button
                      onClick={() => setForm((p) => ({ ...p, fee: '' }))}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Reset Form
                    </button>
                    <button
                      onClick={onSubmit}
                      disabled={loading}
                      className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                    >
                      {loading ? 'Saving...' : 'Add Appointment'}
                    </button>
                  </div>

                  <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="text-sm font-bold text-slate-900">JazzCash Details</div>
                    <div className="mt-4 text-sm text-slate-700">
                      <div>JazzCash Number: {settings?.jazzCashNumber || '-'}</div>
                      <div className="mt-1">Account Title: {settings?.jazzCashTitle || '-'}</div>
                    </div>
                  </section>

                  <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="text-sm font-bold text-slate-900">Bank Account Details</div>
                    <div className="mt-4 text-sm text-slate-700">
                      <div>Bank Name: {settings?.bankName || '-'}</div>
                      <div className="mt-1">Account Title: {settings?.accountTitle || '-'}</div>
                      <div className="mt-1">Account Number / IBAN: {settings?.accountNumber || '-'}</div>
                    </div>
                  </section>
                </div>
              </section>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
