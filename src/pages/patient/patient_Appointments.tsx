import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { patientApi } from '../../utils/api'

export default function Patient_Appointments() {
  const navigate = useNavigate()

  const user = useMemo(() => {
    try {
      const raw = localStorage.getItem('patient.user')
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  }, [])

  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionBusy, setActionBusy] = useState('')
  const [editingId, setEditingId] = useState('')
  const [editForm, setEditForm] = useState({
    dateIso: '',
    slotStart: '',
    patientName: '',
    phone: '',
    age: '',
    gender: '',
    guardianType: '',
    guardianName: '',
    cnic: '',
    address: '',
    departmentId: '',
    doctorId: '',
    billingType: 'Cash'
  })
  const [selectedRowId, setSelectedRowId] = useState('')
  const [uploads, setUploads] = useState<Record<string, { fileName: string; previewUrl: string }>>({})
  const [viewImage, setViewImage] = useState<{ url: string; title: string } | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const tok = localStorage.getItem('patient.token')
        if (!tok) {
          navigate('/patient/login')
          return
        }
      } catch {
        navigate('/patient/login')
        return
      }

      try {
        setLoading(true)
        const r: any = await patientApi.listAppointments({})
        setRows(Array.isArray(r?.appointments) ? r.appointments : [])
      } catch (e: any) {
        setError(e?.message || 'Failed to load appointments')
      } finally {
        setLoading(false)
      }
    })()
  }, [navigate])

  const fullName = String(user?.fullName || user?.username || 'Patient')

  const getPatientName = (r: any) => {
    const name =
      r?.patientName ||
      r?.patientFullName ||
      r?.patient?.name ||
      r?.patient?.fullName ||
      r?.patientId?.name ||
      r?.patientId?.fullName ||
      ''
    return String(name || '')
  }

  const calcAgeFromDob = (dob: any) => {
    try {
      if (!dob) return ''
      const d = new Date(dob)
      if (Number.isNaN(d.getTime())) return ''
      const now = new Date()
      let age = now.getFullYear() - d.getFullYear()
      const m = now.getMonth() - d.getMonth()
      if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1
      if (!Number.isFinite(age) || age < 0 || age > 130) return ''
      return String(age)
    } catch {
      return ''
    }
  }

  const onLogout = async () => {
    try {
      await patientApi.logout()
    } catch {}
    navigate('/patient/login')
  }

  const getPatientAge = (r: any) => {
    const direct = r?.age ?? r?.patientAge ?? r?.patient?.age ?? r?.patientId?.age
    if (direct != null && String(direct).trim() !== '') return String(direct)
    const calc = calcAgeFromDob(r?.dob ?? r?.patientDob ?? r?.patient?.dob ?? r?.patientId?.dob ?? r?.patientId?.dateOfBirth)
    if (calc && calc !== '') return calc
    return '-'
  }

  const formatCreatedAtTime = (v: any) => {
    try {
      if (!v) return ''
      const d = new Date(v)
      if (Number.isNaN(d.getTime())) return ''
      const hh = String(d.getHours()).padStart(2, '0')
      const mm = String(d.getMinutes()).padStart(2, '0')
      return `${hh}:${mm}`
    } catch {
      return ''
    }
  }

  const onPickFile = () => {
    const el = document.getElementById('appt-upload-input') as HTMLInputElement | null
    if (el) el.click()
  }

  const fileToBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.onload = () => {
        const res = String(reader.result || '')
        const i = res.indexOf('base64,')
        resolve(i >= 0 ? res.slice(i + 7) : res)
      }
      reader.readAsDataURL(file)
    })

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    try {
      const file = e.target.files?.[0]
      if (!file || !selectedRowId) return
      const localPreviewUrl = URL.createObjectURL(file)
      setUploads((prev) => ({
        ...prev,
        [selectedRowId]: {
          fileName: String(file.name || 'image'),
          previewUrl: localPreviewUrl,
        },
      }))

      ;(async () => {
        try {
          setActionBusy(String(selectedRowId))
          const dataBase64 = await fileToBase64(file)
          const r: any = await patientApi.uploadAppointmentImage(String(selectedRowId), {
            fileName: file.name,
            mimeType: file.type,
            dataBase64,
          })
          const appt = r?.appointment
          if (appt?._id) {
            setRows((prev) => prev.map((x) => (String(x?._id) === String(appt._id) ? appt : x)))
          }
        } catch (err: any) {
          setError(err?.message || 'Failed to upload image')
        } finally {
          setActionBusy('')
        }
      })()
    } finally {
      e.target.value = ''
    }
  }

  const onEdit = (r: any) => {
    const id = String(r?._id || '')
    if (!id) return
    setEditingId(id)
    const toHHmm = (v: any) => {
      try {
        if (!v) return ''
        const s = String(v)
        const m = s.match(/(\d{1,2}):(\d{2})/)
        if (m) return `${String(m[1]).padStart(2, '0')}:${m[2]}`
        const d = new Date(v)
        if (!Number.isNaN(d.getTime())) {
          return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
        }
        return ''
      } catch {
        return ''
      }
    }
    const slot =
      toHHmm(r?.slotStart) ||
      toHHmm((r as any)?.apptStart) ||
      toHHmm((r as any)?.appointmentTime) ||
      toHHmm(r?.createdAt)
    setEditForm({
      dateIso: String(r?.dateIso || ''),
      slotStart: slot,
      patientName: String(r?.patientName || r?.patientId?.fullName || ''),
      phone: String(r?.phoneNormalized || r?.patientId?.phoneNormalized || ''),
      age: String(r?.age || r?.patientId?.age || ''),
      gender: String(r?.gender || r?.patientId?.gender || ''),
      guardianType: String(r?.guardianRel || r?.patientId?.guardianRel || ''),
      guardianName: String(r?.guardianName || r?.patientId?.guardianName || ''),
      cnic: String(r?.cnic || r?.patientId?.cnic || ''),
      address: String(r?.address || r?.patientId?.address || ''),
      departmentId: String(r?.departmentId?._id || r?.departmentId || ''),
      doctorId: String(r?.doctorId?._id || r?.doctorId || ''),
      billingType: String(r?.paidMethod || r?.paymentRef || 'Cash')
    })
  }

  const onSaveEdit = async () => {
    const id = String(editingId || '')
    if (!id) return
    
    try {
      setActionBusy(id)
      const resp: any = await patientApi.updateAppointment(id, {
        dateIso: editForm.dateIso,
        slotStart: editForm.slotStart,
        apptStart: editForm.slotStart,
        patientName: editForm.patientName,
        phone: editForm.phone,
        age: editForm.age,
        gender: editForm.gender,
      } as any)
      const appt = resp?.appointment
      if (appt?._id) {
        setRows((prev) => prev.map((x) => (String(x?._id) === String(appt._id) ? appt : x)))
      }
      setEditingId('')
    } catch (err: any) {
      setError(err?.message || 'Failed to update appointment')
    } finally {
      setActionBusy('')
    }
  }

  const onCancelAppointment = async (id: string) => {
    if (!window.confirm('Are you sure you want to cancel this appointment?')) return
    try {
      setActionBusy(id)
      await patientApi.deleteAppointment(id) // deleteAppointment in this codebase sets status to 'cancelled'
      setRows((prev) => prev.map(r => String(r._id) === id ? { ...r, status: 'cancelled' } : r))
      setEditingId('')
    } catch (err: any) {
      setError(err?.message || 'Failed to cancel appointment')
    } finally {
      setActionBusy('')
    }
  }

  const onDelete = async (r: any) => {
    const id = String(r?._id || '')
    if (!id) return
    const ok = window.confirm('Cancel this appointment?')
    if (!ok) return

    try {
      setActionBusy(id)
      await patientApi.deleteAppointment(id)
      setRows((prev) => prev.filter((x) => String(x?._id) !== id))
    } catch (err: any) {
      setError(err?.message || 'Failed to cancel appointment')
    } finally {
      setActionBusy('')
    }
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
          <div className="px-3 mt-3">
            <button
              onClick={onLogout}
              className="w-full rounded-xl border border-red-200 bg-white px-4 py-3 text-left text-sm font-semibold text-red-700 hover:bg-red-50"
            >
              Logout
            </button>
          </div>
        </aside>

        <main className="flex-1">
          <div className="mx-auto max-w-7xl px-6 py-10">
            <div className="flex items-center justify-between gap-4">
              <h1 className="text-2xl font-extrabold text-slate-900">Appointments</h1>
              <button
                onClick={() => navigate('/patient/add-appointment')}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Add Appointment
              </button>
            </div>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <input id="appt-upload-input" type="file" accept="image/*" className="hidden" onChange={onFileChange} />
              {error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
              ) : null}

              {loading ? (
                <div className="text-sm text-slate-600">Loading…</div>
              ) : rows.length === 0 ? (
                <div className="text-sm text-slate-600">No appointments yet.</div>
              ) : (
                <div className="overflow-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                        <th className="py-3 pr-4">Date</th>
                        <th className="py-3 pr-4">MR#</th>
                        <th className="py-3 pr-4">Patient</th>
                        <th className="py-3 pr-4">Age</th>
                        <th className="py-3 pr-4">Doctor</th>
                        <th className="py-3 pr-4">Time</th>
                        <th className="py-3 pr-4">Status</th>
                        <th className="py-3 pr-4">Consultant Fee</th>
                        <th className="py-3 pr-4">Billing Type</th>
                        <th className="py-3 pr-4">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={String(r?._id)} className="border-b border-slate-100">
                          <td className="py-3 pr-4">{String(r?.dateIso || '')}</td>
                          <td className="py-3 pr-4">{String(r?.patientId?.mrn || r?.mrn || r?.mrNo || r?.mrNumber || '')}</td>
                          <td className="py-3 pr-4">{getPatientName(r) || '-'}</td>
                          <td className="py-3 pr-4">{getPatientAge(r)}</td>
                          <td className="py-3 pr-4">{String(r?.doctorId?.name || '')}</td>
                          <td className="py-3 pr-4">{String(r?.slotStart || formatCreatedAtTime(r?.createdAt) || '')}</td>
                          <td className="py-3 pr-4">
                            <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                              r.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                            }`}>
                              {String(r?.status || '')}
                            </span>
                          </td>
                          <td className="py-3 pr-4">{Number(r?.fee || 0)}</td>
                          <td className="py-3 pr-4">{String(r?.paidMethod || r?.paymentRef || 'Cash')}</td>
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedRowId(String(r?._id || ''))
                                  onPickFile()
                                }}
                                disabled={actionBusy === String(r?._id) || r.status === 'cancelled'}
                                className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                              >
                                Upload
                              </button>

                              <button
                                type="button"
                                onClick={() => onEdit(r)}
                                disabled={actionBusy === String(r?._id) || r.status === 'cancelled'}
                                className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                onClick={() => onDelete(r)}
                                disabled={actionBusy === String(r?._id) || r.status === 'cancelled'}
                                className="cursor-pointer rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                              >
                                Delete
                              </button>

                              {r?.patientUpload?.dataBase64 ? (
                                <img
                                  src={`data:${String(r?.patientUpload?.mimeType || 'image/*')};base64,${String(r?.patientUpload?.dataBase64 || '')}`}
                                  alt="upload"
                                  onClick={() => setViewImage({
                                    url: `data:${String(r?.patientUpload?.mimeType || 'image/*')};base64,${String(r?.patientUpload?.dataBase64 || '')}`,
                                    title: String(r?.patientUpload?.fileName || 'Upload')
                                  })}
                                  className="h-12 w-12 cursor-pointer rounded-lg border border-slate-200 object-cover hover:opacity-80 transition-opacity"
                                />
                              ) : uploads[String(r?._id)]?.previewUrl ? (
                                <img
                                  src={uploads[String(r?._id)]?.previewUrl}
                                  alt="upload"
                                  onClick={() => setViewImage({
                                    url: uploads[String(r?._id)]?.previewUrl,
                                    title: uploads[String(r?._id)]?.fileName || 'Upload'
                                  })}
                                  className="h-12 w-12 cursor-pointer rounded-lg border border-slate-200 object-cover hover:opacity-80 transition-opacity"
                                />
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {viewImage && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setViewImage(null)}
        >
          <div className="relative max-h-full max-w-4xl overflow-hidden rounded-2xl bg-white p-2 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="absolute right-4 top-4 z-10">
              <button 
                onClick={() => setViewImage(null)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-black/20 text-white hover:bg-black/40 transition-colors"
              >
                ✕
              </button>
            </div>
            <img 
              src={viewImage.url} 
              alt={viewImage.title} 
              className="max-h-[85vh] w-auto rounded-xl object-contain shadow-lg"
            />
            <div className="mt-2 px-2 py-1 text-center text-sm font-semibold text-slate-700">
              {viewImage.title}
            </div>
          </div>
        </div>
      )}

      {editingId && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-black/5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h2 className="text-xl font-bold text-slate-900">Edit Appointment</h2>
              <button onClick={() => setEditingId('')} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Patient Name</label>
                <input
                  value={editForm.patientName}
                  onChange={e => setEditForm(p => ({ ...p, patientName: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Phone</label>
                <input
                  value={editForm.phone}
                  onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Age</label>
                <input
                  value={editForm.age}
                  onChange={e => setEditForm(p => ({ ...p, age: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Gender</label>
                <select
                  value={editForm.gender}
                  onChange={e => setEditForm(p => ({ ...p, gender: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Appointment Date</label>
                <input
                  type="date"
                  value={editForm.dateIso}
                  onChange={e => setEditForm(p => ({ ...p, dateIso: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Time</label>
                <input
                  type="time"
                  value={editForm.slotStart}
                  onChange={e => setEditForm(p => ({ ...p, slotStart: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Billing Type</label>
                <select
                  value={editForm.billingType}
                  onChange={e => setEditForm(p => ({ ...p, billingType: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
                >
                  <option value="Cash">Cash</option>
                  <option value="Card">Bank Account</option>
                  <option value="JazzCash">JazzCash</option>
                </select>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-6">
              <button
                onClick={() => onCancelAppointment(editingId)}
                className="rounded-xl border border-red-200 px-6 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 transition-colors"
              >
                Cancel Appointment
              </button>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setEditingId('')}
                  className="rounded-xl border border-slate-200 px-6 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={onSaveEdit}
                  disabled={!!actionBusy}
                  className="rounded-xl bg-slate-900 px-8 py-2.5 text-sm font-bold text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                  {actionBusy === editingId ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
