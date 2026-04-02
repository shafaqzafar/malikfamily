import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { hospitalApi, patientApi } from '../../utils/api'
import { downloadHospitalRxPdf, previewHospitalRxPdf } from '../../utils/hospitalRxPdf'

export default function Patient_Prescriptions() {
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

  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [active, setActive] = useState<any | null>(null)
  const [settings, setSettings] = useState<any | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        setLoading(true)
        const res: any = await patientApi.listPrescriptions()
        setRows(Array.isArray(res?.prescriptions) ? res.prescriptions : [])
      } catch (e: any) {
        setError(e?.message || 'Failed to load prescriptions')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  useEffect(() => {
    if (!active) return
    ;(async () => {
      try {
        const s: any = await hospitalApi.getSettings()
        setSettings(s?.settings || s)
      } catch {
        setSettings(null)
      }
    })()
  }, [active])

  const onLogout = async () => {
    try {
      await patientApi.logout()
    } catch {}
    navigate('/patient/login')
  }

  const fmt = (d: any) => {
    try {
      if (!d) return ''
      const x = new Date(d)
      if (Number.isNaN(x.getTime())) return ''
      return x.toLocaleString()
    } catch {
      return ''
    }
  }

  const getDoctorName = (r: any) => String(r?.encounterId?.doctorId?.name || '')
  const getPatientMrn = (r: any) => String(r?.encounterId?.patientId?.mrn || r?.patientId?.mrn || '')

  const getPatientName = (r: any) => String(r?.encounterId?.patientId?.fullName || r?.patientId?.fullName || '')
  const getFatherName = (r: any) => String(r?.encounterId?.patientId?.fatherName || r?.patientId?.fatherName || '')
  const getGender = (r: any) => String(r?.encounterId?.patientId?.gender || r?.patientId?.gender || '')
  const getPhone = (r: any) => String(r?.encounterId?.patientId?.phoneNormalized || r?.patientId?.phoneNormalized || '')
  const getAge = (r: any) => {
    const a = r?.encounterId?.patientId?.age ?? r?.patientId?.age
    return a != null ? String(a) : ''
  }
  const getAddress = (r: any) => String(r?.encounterId?.patientId?.address || r?.patientId?.address || '')

  const toLines = (v: any) => {
    const s = String(v || '').trim()
    return s
  }

  const extractInstruction = (notes: string) => {
    try {
      const mi = String(notes || '').match(/Instruction:\s*([^;]+)/i)
      return mi && mi[1] ? String(mi[1]).trim() : ''
    } catch {
      return ''
    }
  }
  const extractRoute = (notes: string) => {
    try {
      const mr = String(notes || '').match(/Route:\s*([^;]+)/i)
      return mr && mr[1] ? String(mr[1]).trim() : ''
    } catch {
      return ''
    }
  }

  const mapItems = (r: any) => {
    const items = Array.isArray(r?.items) ? r.items : []
    return items.map((it: any) => {
      const notes = String(it?.notes || '')
      return {
        name: String(it?.name || ''),
        frequency: String(it?.frequency || ''),
        dose: String(it?.dose || ''),
        duration: String(it?.duration || ''),
        instruction: String((it as any)?.instruction || extractInstruction(notes) || ''),
        route: String((it as any)?.route || extractRoute(notes) || ''),
      }
    })
  }

  const onPrint = async (r: any) => {
    try {
      const items = mapItems(r)
      await previewHospitalRxPdf({
        settings: {
          name: settings?.name,
          address: settings?.address,
          phone: settings?.phone,
          logoDataUrl: settings?.logoDataUrl,
        },
        doctor: {
          name: getDoctorName(r),
        },
        patient: {
          name: getPatientName(r),
          mrn: getPatientMrn(r),
          fatherName: getFatherName(r),
          age: getAge(r),
          gender: getGender(r),
          phone: getPhone(r),
          address: getAddress(r),
        },
        items,
        primaryComplaint: r?.primaryComplaint,
        primaryComplaintHistory: r?.primaryComplaintHistory,
        familyHistory: r?.familyHistory,
        allergyHistory: r?.allergyHistory,
        treatmentHistory: r?.treatmentHistory,
        history: r?.history,
        examFindings: r?.examFindings,
        diagnosis: r?.diagnosis,
        advice: r?.advice,
        vitals: r?.vitals,
        labTests: r?.labTests,
        labNotes: r?.labNotes,
        diagnosticTests: r?.diagnosticTests,
        diagnosticNotes: r?.diagnosticNotes,
        createdAt: r?.createdAt || r?.sharedAt,
      } as any)
    } catch (e: any) {
      setError(e?.message || 'Failed to print')
    }
  }

  const onDownload = async (r: any) => {
    try {
      const items = mapItems(r)
      const dt = new Date(r?.createdAt || r?.sharedAt || new Date())
      const fn = `Prescription_${getPatientMrn(r) || 'patient'}_${dt.toISOString().slice(0, 10)}.pdf`
      await downloadHospitalRxPdf({
        settings: {
          name: settings?.name,
          address: settings?.address,
          phone: settings?.phone,
          logoDataUrl: settings?.logoDataUrl,
        },
        doctor: {
          name: getDoctorName(r),
        },
        patient: {
          name: getPatientName(r),
          mrn: getPatientMrn(r),
          fatherName: getFatherName(r),
          age: getAge(r),
          gender: getGender(r),
          phone: getPhone(r),
          address: getAddress(r),
        },
        items,
        primaryComplaint: r?.primaryComplaint,
        primaryComplaintHistory: r?.primaryComplaintHistory,
        familyHistory: r?.familyHistory,
        allergyHistory: r?.allergyHistory,
        treatmentHistory: r?.treatmentHistory,
        history: r?.history,
        examFindings: r?.examFindings,
        diagnosis: r?.diagnosis,
        advice: r?.advice,
        vitals: r?.vitals,
        labTests: r?.labTests,
        labNotes: r?.labNotes,
        diagnosticTests: r?.diagnosticTests,
        diagnosticNotes: r?.diagnosticNotes,
        createdAt: r?.createdAt || r?.sharedAt,
      } as any, fn)
    } catch (e: any) {
      setError(e?.message || 'Failed to download')
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
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
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
              className="w-full rounded-xl bg-slate-900 px-4 py-3 text-left text-sm font-semibold text-white hover:bg-slate-800"
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
          <div className="mx-auto max-w-7xl px-6 py-10">
            <div className="flex items-center justify-between gap-4">
              <h1 className="text-2xl font-extrabold text-slate-900">Prescriptions</h1>
              <button
                onClick={() => navigate('/patient/appointments')}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Back
              </button>
            </div>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              {error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
              ) : null}

              {loading ? (
                <div className="text-sm text-slate-600">Loading…</div>
              ) : rows.length === 0 ? (
                <div className="text-sm text-slate-600">No prescriptions yet.</div>
              ) : (
                <div className="overflow-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                        <th className="py-3 pr-4">Date</th>
                        <th className="py-3 pr-4">Doctor</th>
                        <th className="py-3 pr-4">MR#</th>
                        <th className="py-3 pr-4">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={String(r?._id || r?.id)} className="border-b border-slate-100">
                          <td className="py-3 pr-4">{fmt(r?.createdAt || r?.sharedAt)}</td>
                          <td className="py-3 pr-4">{getDoctorName(r) || '-'}</td>
                          <td className="py-3 pr-4">{getPatientMrn(r) || '-'}</td>
                          <td className="py-3 pr-4">
                            <button
                              type="button"
                              onClick={() => setActive(r)}
                              className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              View
                            </button>
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

      {active && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
              <div>
                <div className="text-sm font-semibold text-slate-500">Prescription</div>
                <div className="text-lg font-extrabold text-slate-900">{settings?.name || 'Mindspire Hospital Management System'}</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onDownload(active)}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800"
                >
                  Download
                </button>
                <button onClick={() => setActive(null)} className="ml-2 text-slate-400 hover:text-slate-600">✕</button>
              </div>
            </div>

            <div className="px-6 py-6">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div className="text-base font-extrabold text-slate-900">Dr. {getDoctorName(active) || '-'}</div>
                <div className="mt-3 grid gap-2 md:grid-cols-3 text-sm">
                  <div>
                    <div className="text-xs font-semibold text-slate-500">Patient</div>
                    <div className="font-semibold text-slate-900">{getPatientName(active) || '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-500">MR#</div>
                    <div className="font-semibold text-slate-900">{getPatientMrn(active) || '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-500">Gender</div>
                    <div className="font-semibold text-slate-900">{getGender(active) || '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-500">Father Name</div>
                    <div className="font-semibold text-slate-900">{getFatherName(active) || '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-500">Age</div>
                    <div className="font-semibold text-slate-900">{getAge(active) || '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-500">Phone</div>
                    <div className="font-semibold text-slate-900">{getPhone(active) || '-'}</div>
                  </div>
                  <div className="md:col-span-3">
                    <div className="text-xs font-semibold text-slate-500">Address</div>
                    <div className="font-semibold text-slate-900">{getAddress(active) || '-'}</div>
                  </div>
                  <div className="md:col-span-3">
                    <div className="text-xs font-semibold text-slate-500">Date</div>
                    <div className="font-semibold text-slate-900">{fmt(active?.createdAt || active?.sharedAt) || '-'}</div>
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-6">
                <div className="grid gap-4">
                  <div>
                    <div className="text-sm font-extrabold text-slate-900">Medical History</div>
                    <div className="mt-1 whitespace-pre-wrap rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-800">{toLines(active?.history) || '-'}</div>
                  </div>
                  <div>
                    <div className="text-sm font-extrabold text-slate-900">Complaint</div>
                    <div className="mt-1 whitespace-pre-wrap rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-800">{toLines(active?.primaryComplaint) || '-'}</div>
                  </div>
                  <div>
                    <div className="text-sm font-extrabold text-slate-900">Examination</div>
                    <div className="mt-1 whitespace-pre-wrap rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-800">{toLines(active?.examFindings) || '-'}</div>
                  </div>
                  <div>
                    <div className="text-sm font-extrabold text-slate-900">Clinical Notes</div>
                    <div className="mt-1 whitespace-pre-wrap rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-800">{toLines(active?.primaryComplaintHistory) || '-'}</div>
                  </div>
                  <div>
                    <div className="text-sm font-extrabold text-slate-900">Advice</div>
                    <div className="mt-1 whitespace-pre-wrap rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-800">{toLines(active?.advice) || '-'}</div>
                  </div>
                </div>

                <div>
                  <div className="text-sm font-extrabold text-slate-900">Medication</div>
                  <div className="mt-2 overflow-auto rounded-xl border border-slate-200 bg-white">
                    <table className="min-w-[900px] w-full text-left text-sm">
                      <thead className="bg-slate-900 text-xs font-extrabold text-white">
                        <tr>
                          <th className="py-2 px-3 w-12">Sr.</th>
                          <th className="py-2 px-3">Drug</th>
                          <th className="py-2 px-3">Frequency</th>
                          <th className="py-2 px-3">Dosage</th>
                          <th className="py-2 px-3">Duration</th>
                          <th className="py-2 px-3">Instruction</th>
                          <th className="py-2 px-3">Route</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mapItems(active).map((it: any, idx: number) => (
                          <tr key={idx} className="border-t border-slate-200">
                            <td className="py-2 px-3">{idx + 1}</td>
                            <td className="py-2 px-3 font-semibold text-slate-900">{it.name}</td>
                            <td className="py-2 px-3">{it.frequency}</td>
                            <td className="py-2 px-3">{it.dose}</td>
                            <td className="py-2 px-3">{it.duration}</td>
                            <td className="py-2 px-3">{it.instruction}</td>
                            <td className="py-2 px-3">{it.route}</td>
                          </tr>
                        ))}
                        {mapItems(active).length === 0 ? (
                          <tr className="border-t border-slate-200">
                            <td className="py-3 px-3 text-slate-600" colSpan={7}>No medicines listed.</td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </div>

                {active?.manualAttachment?.dataUrl ? (
                  <div>
                    <div className="text-sm font-extrabold text-slate-900">Attachment</div>
                    <div className="mt-2 rounded-xl border border-slate-200 bg-white p-3 text-sm">
                      <a
                        href={String(active.manualAttachment.dataUrl)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sky-700 hover:underline font-semibold"
                      >
                        View attachment ({String(active?.manualAttachment?.fileName || 'file')})
                      </a>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="mt-8 flex items-center justify-end gap-3 border-t border-slate-100 pt-6">
                <button
                  onClick={() => setActive(null)}
                  className="rounded-xl border border-slate-200 px-6 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
