import { useState, useEffect } from 'react'

export default function Dialysis_Dashboard() {
  const [stats, setStats] = useState({
    totalPatients: 0,
    todaySessions: 0,
    activeMachines: 0,
    pendingAppointments: 0,
  })

  useEffect(() => {
    // TODO: Fetch actual stats from API
    setStats({
      totalPatients: 45,
      todaySessions: 12,
      activeMachines: 8,
      pendingAppointments: 5,
    })
  }, [])

  return (
    <div className="min-h-[70dvh] rounded-xl bg-gradient-to-br from-teal-500/20 via-cyan-300/20 to-emerald-300/20 p-6">
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">Dialysis Dashboard</h1>
          <p className="text-slate-600 mt-1">Overview of dialysis operations</p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-100 text-teal-600">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4.42 0-8 2-8 4.5V20h16v-1.5c0-2.5-3.58-4.5-8-4.5Z"/></svg>
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{stats.totalPatients}</div>
                <div className="text-sm text-slate-600">Total Patients</div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-100 text-cyan-600">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8Zm1-13h-2v6l5.25 3.15.75-1.23-4-2.42Z"/></svg>
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{stats.todaySessions}</div>
                <div className="text-sm text-slate-600">Today's Sessions</div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35Z"/></svg>
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{stats.activeMachines}</div>
                <div className="text-sm text-slate-600">Active Machines</div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 16H5V10h14v10Zm0-12H5V6h14v2Z"/></svg>
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{stats.pendingAppointments}</div>
                <div className="text-sm text-slate-600">Pending Appointments</div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Welcome to Dialysis Portal</h2>
          <p className="text-slate-600">
            Manage your dialysis patients, sessions, and appointments from this portal. 
            Use the sidebar to navigate between different sections.
          </p>
        </div>
      </div>
    </div>
  )
}
