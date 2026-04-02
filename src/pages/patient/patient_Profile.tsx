import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Patient_Profile() {
  const navigate = useNavigate()

  const user = useMemo(() => {
    try {
      const raw = localStorage.getItem('patient.user')
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  }, [])

  return (
    <div className="min-h-dvh bg-slate-50">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-extrabold text-slate-900">My Profile</h1>
          <button onClick={() => navigate('/patient')} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Back
          </button>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-xs font-semibold text-slate-500">Full Name</div>
              <div className="mt-1 font-semibold text-slate-900">{String(user?.fullName || '')}</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500">Username</div>
              <div className="mt-1 font-semibold text-slate-900">{String(user?.username || '')}</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500">Phone Number</div>
              <div className="mt-1 font-semibold text-slate-900">{String(user?.phoneNumber || '')}</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500">Date of Birth</div>
              <div className="mt-1 font-semibold text-slate-900">{String(user?.dateOfBirth || '')}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
