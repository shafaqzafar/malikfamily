import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { hospitalApi } from '../../utils/api'

type Ambulance = {
  id: string
  vehicleNumber: string
  type: 'BLS' | 'ALS' | 'Patient Transport' | 'Neonatal'
  driverName: string
  driverContact: string
  status: 'Available' | 'On Duty' | 'Maintenance'
}

type DashboardStats = {
  totalAmbulances: number
  available: number
  onDuty: number
  maintenance: number
  todayTrips: number
  monthTrips: number
  monthDistance: number
  monthFuel: number
  monthExpenses: number
  activeTrips: Array<{
    id: string
    vehicleNumber: string
    patientName?: string
    destination: string
    departureTime: string
  }>
}

export default function Ambulance_Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalAmbulances: 0,
    available: 0,
    onDuty: 0,
    maintenance: 0,
    todayTrips: 0,
    monthTrips: 0,
    monthDistance: 0,
    monthFuel: 0,
    monthExpenses: 0,
    activeTrips: [],
  })
  const [ambulances, setAmbulances] = useState<Ambulance[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [dashRes, ambRes] = await Promise.all([
          hospitalApi.ambulanceDashboard() as Promise<any>,
          hospitalApi.listAmbulances() as Promise<any>,
        ])
        if (!cancelled) {
          setStats(dashRes.stats || dashRes || stats)
          setAmbulances((ambRes.ambulances || ambRes || []).map((a: any) => ({
            id: String(a._id || a.id),
            vehicleNumber: a.vehicleNumber,
            type: a.type,
            driverName: a.driverName,
            driverContact: a.driverContact,
            status: a.status || 'Available',
          })))
        }
      } catch {
        // API not ready - show empty state
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const formatCurrency = (n: number) => new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(n)
  const formatNumber = (n: number) => new Intl.NumberFormat('en-PK').format(n)

  const quickLinks = [
    { to: '/hospital/ambulance/trips', label: 'New Trip', icon: '🚑', color: 'bg-sky-600' },
    { to: '/hospital/ambulance/master', label: 'Ambulances', icon: '🚐', color: 'bg-violet-600' },
    { to: '/hospital/ambulance/fuel', label: 'Add Fuel', icon: '⛽', color: 'bg-amber-600' },
    { to: '/hospital/ambulance/expenses', label: 'Expenses', icon: '💰', color: 'bg-emerald-600' },
  ]

  const statusColors: Record<string, string> = {
    'Available': 'bg-emerald-100 text-emerald-700 border-emerald-200',
    'On Duty': 'bg-sky-100 text-sky-700 border-sky-200',
    'Maintenance': 'bg-amber-100 text-amber-700 border-amber-200',
  }

  const typeLabels: Record<string, string> = {
    'BLS': 'Basic Life Support',
    'ALS': 'Advanced Life Support',
    'Patient Transport': 'Patient Transport',
    'Neonatal': 'Neonatal',
  }

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-slate-800">Ambulance Management</h2>
      <p className="mt-1 text-slate-500">Track ambulance movements, trips, fuel, and expenses</p>

      {loading ? (
        <div className="mt-8 text-center text-slate-500">Loading...</div>
      ) : (
        <>
          {/* Quick Actions */}
          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            {quickLinks.map(link => (
              <Link
                key={link.to}
                to={link.to}
                className={`flex items-center gap-3 rounded-xl ${link.color} px-4 py-3 text-white shadow-sm transition hover:scale-[1.02] hover:shadow-md`}
              >
                <span className="text-2xl">{link.icon}</span>
                <span className="font-medium">{link.label}</span>
              </Link>
            ))}
          </div>

          {/* Stats Grid */}
          <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-5">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-sm text-slate-500">Total Ambulances</div>
              <div className="mt-1 text-2xl font-bold text-slate-800">{stats.totalAmbulances}</div>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="text-sm text-emerald-600">Available</div>
              <div className="mt-1 text-2xl font-bold text-emerald-700">{stats.available}</div>
            </div>
            <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
              <div className="text-sm text-sky-600">On Duty</div>
              <div className="mt-1 text-2xl font-bold text-sky-700">{stats.onDuty}</div>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="text-sm text-amber-600">Maintenance</div>
              <div className="mt-1 text-2xl font-bold text-amber-700">{stats.maintenance}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-sm text-slate-500">Today's Trips</div>
              <div className="mt-1 text-2xl font-bold text-violet-600">{stats.todayTrips}</div>
            </div>
          </div>

          {/* Monthly Summary */}
          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-sm text-slate-500">Monthly Trips</div>
              <div className="mt-1 text-xl font-bold text-slate-800">{formatNumber(stats.monthTrips)}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-sm text-slate-500">Distance (km)</div>
              <div className="mt-1 text-xl font-bold text-slate-800">{formatNumber(stats.monthDistance)}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-sm text-slate-500">Fuel Cost</div>
              <div className="mt-1 text-xl font-bold text-amber-600">{formatCurrency(stats.monthFuel)}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-sm text-slate-500">Total Expenses</div>
              <div className="mt-1 text-xl font-bold text-rose-600">{formatCurrency(stats.monthExpenses)}</div>
            </div>
          </div>

          {/* Active Trips */}
          {stats.activeTrips.length > 0 && (
            <div className="mt-8">
              <h3 className="text-lg font-semibold text-slate-800">Active Trips</h3>
              <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-left">
                      <th className="px-4 py-2 font-medium text-slate-600">Ambulance</th>
                      <th className="px-4 py-2 font-medium text-slate-600">Patient</th>
                      <th className="px-4 py-2 font-medium text-slate-600">Destination</th>
                      <th className="px-4 py-2 font-medium text-slate-600">Departed</th>
                      <th className="px-4 py-2 font-medium text-slate-600"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.activeTrips.map(trip => (
                      <tr key={trip.id} className="border-b border-slate-100">
                        <td className="px-4 py-2 font-medium text-slate-800">{trip.vehicleNumber}</td>
                        <td className="px-4 py-2 text-slate-600">{trip.patientName || '-'}</td>
                        <td className="px-4 py-2 text-slate-600">{trip.destination}</td>
                        <td className="px-4 py-2 text-slate-500">{new Date(trip.departureTime).toLocaleString()}</td>
                        <td className="px-4 py-2">
                          <Link to={`/hospital/ambulance/trips?id=${trip.id}`} className="text-sky-600 hover:underline">Complete</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Ambulance Fleet Status */}
          <div className="mt-8">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-800">Fleet Status</h3>
              <Link to="/hospital/ambulance/master" className="text-sm text-sky-600 hover:underline">Manage Ambulances →</Link>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {ambulances.map(amb => (
                <div key={amb.id} className={`rounded-lg border p-4 ${statusColors[amb.status]}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-lg font-bold">{amb.vehicleNumber}</div>
                      <div className="text-sm opacity-75">{typeLabels[amb.type]}</div>
                    </div>
                    <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-white/50">{amb.status}</span>
                  </div>
                  <div className="mt-3 text-sm">
                    <div className="opacity-75">Driver: {amb.driverName}</div>
                    <div className="opacity-75">{amb.driverContact}</div>
                  </div>
                </div>
              ))}
              {ambulances.length === 0 && (
                <div className="col-span-full rounded-lg border border-slate-200 bg-slate-50 p-6 text-center text-slate-500">
                  No ambulances registered. <Link to="/hospital/ambulance/master" className="text-sky-600 hover:underline">Add one now</Link>
                </div>
              )}
            </div>
          </div>

          {/* Reports Links */}
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-slate-800">Reports & Analytics</h3>
            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
              <Link to="/hospital/ambulance/reports?type=usage" className="rounded-lg border border-slate-200 bg-white p-3 text-sm hover:bg-slate-50">
                📊 Usage Report
              </Link>
              <Link to="/hospital/ambulance/reports?type=trips" className="rounded-lg border border-slate-200 bg-white p-3 text-sm hover:bg-slate-50">
                🚗 Trip History
              </Link>
              <Link to="/hospital/ambulance/reports?type=fuel" className="rounded-lg border border-slate-200 bg-white p-3 text-sm hover:bg-slate-50">
                ⛽ Fuel Report
              </Link>
              <Link to="/hospital/ambulance/reports?type=expenses" className="rounded-lg border border-slate-200 bg-white p-3 text-sm hover:bg-slate-50">
                💰 Expense Report
              </Link>
              <Link to="/hospital/ambulance/reports?type=cost-per-km" className="rounded-lg border border-slate-200 bg-white p-3 text-sm hover:bg-slate-50">
                📈 Cost/Km Analysis
              </Link>
              <Link to="/hospital/ambulance/reports?type=patient-transport" className="rounded-lg border border-slate-200 bg-white p-3 text-sm hover:bg-slate-50">
                👤 Patient Transport
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
