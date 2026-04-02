import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { hospitalApi } from '../../utils/api'

type Ambulance = {
  id: string
  vehicleNumber: string
  driverName: string
}

type ReportData = {
  summary?: {
    totalTrips: number
    totalDistance: number
    totalFuel: number
    totalFuelCost: number
    totalExpenses: number
    avgCostPerKm: number
  }
  byAmbulance?: Array<{
    ambulanceId: string
    vehicleNumber: string
    trips: number
    distance: number
    fuel: number
    fuelCost: number
    expenses: number
    costPerKm: number
  }>
  trips?: Array<{
    id: string
    vehicleNumber: string
    patientName?: string
    pickupLocation: string
    destination: string
    purpose: string
    departureTime: string
    distanceTraveled?: number
    status: string
  }>
  fuel?: Array<{
    vehicleNumber: string
    date: string
    quantity: number
    cost: number
    station?: string
  }>
  expenses?: Array<{
    vehicleNumber: string
    category: string
    amount: number
    date: string
    description?: string
  }>
  patientTransport?: Array<{
    patientName?: string
    patientId?: string
    vehicleNumber: string
    purpose: string
    pickupLocation: string
    destination: string
    departureTime: string
    distanceTraveled?: number
  }>
}

const reportTypes = [
  { key: 'usage', label: 'Monthly Usage', icon: '📊' },
  { key: 'trips', label: 'Trip History', icon: '🚗' },
  { key: 'fuel', label: 'Fuel Report', icon: '⛽' },
  { key: 'expenses', label: 'Expense Report', icon: '💰' },
  { key: 'cost-per-km', label: 'Cost/Km Analysis', icon: '📈' },
  { key: 'patient-transport', label: 'Patient Transport', icon: '👤' },
]

export default function Ambulance_Reports() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [ambulances, setAmbulances] = useState<Ambulance[]>([])
  const [reportType, setReportType] = useState(searchParams.get('type') || 'usage')
  const [ambulanceId, setAmbulanceId] = useState('')
  const [from, setFrom] = useState(() => {
    const d = new Date()
    d.setDate(1)
    return d.toISOString().slice(0, 10)
  })
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10))
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    hospitalApi.listAmbulances().then(res => {
      const list = (res as any).ambulances || res || []
      setAmbulances(list.map((a: any) => ({
        id: String(a._id || a.id),
        vehicleNumber: a.vehicleNumber,
        driverName: a.driverName,
      })))
    }).catch(() => {})
  }, [])

  useEffect(() => {
    setSearchParams({ type: reportType })
  }, [reportType, setSearchParams])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await hospitalApi.getAmbulanceReport(reportType as any, {
          from,
          to,
          ambulanceId: ambulanceId || undefined,
        }) as any
        if (!cancelled) {
          setData(res.data || res)
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || 'Failed to load report')
          setData(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [reportType, from, to, ambulanceId])

  const exportCSV = () => {
    if (!data) return
    let header: string[] = []
    let lines: string[][] = []

    if (reportType === 'usage' && data.byAmbulance) {
      header = ['Vehicle #', 'Trips', 'Distance (km)', 'Fuel (L)', 'Fuel Cost', 'Expenses', 'Cost/Km']
      lines = data.byAmbulance.map(a => [a.vehicleNumber, String(a.trips), String(a.distance), String(a.fuel), String(a.fuelCost), String(a.expenses), String(a.costPerKm)])
    } else if (reportType === 'trips' && data.trips) {
      header = ['Vehicle #', 'Patient', 'Pickup', 'Destination', 'Purpose', 'Date', 'Distance', 'Status']
      lines = data.trips.map(t => [t.vehicleNumber, t.patientName || '', t.pickupLocation, t.destination, t.purpose, t.departureTime, String(t.distanceTraveled || 0), t.status])
    } else if (reportType === 'fuel' && data.fuel) {
      header = ['Vehicle #', 'Date', 'Quantity (L)', 'Cost', 'Station']
      lines = data.fuel.map(f => [f.vehicleNumber, f.date, String(f.quantity), String(f.cost), f.station || ''])
    } else if (reportType === 'expenses' && data.expenses) {
      header = ['Vehicle #', 'Category', 'Amount', 'Date', 'Description']
      lines = data.expenses.map(e => [e.vehicleNumber, e.category, String(e.amount), e.date, e.description || ''])
    } else if (reportType === 'cost-per-km' && data.byAmbulance) {
      header = ['Vehicle #', 'Distance (km)', 'Total Cost', 'Cost/Km']
      lines = data.byAmbulance.map(a => [a.vehicleNumber, String(a.distance), String(a.fuelCost + a.expenses), String(a.costPerKm)])
    } else if (reportType === 'patient-transport' && data.patientTransport) {
      header = ['Patient', 'Patient ID', 'Vehicle #', 'Purpose', 'Pickup', 'Destination', 'Date', 'Distance']
      lines = data.patientTransport.map(p => [p.patientName || '', p.patientId || '', p.vehicleNumber, p.purpose, p.pickupLocation, p.destination, p.departureTime, String(p.distanceTraveled || 0)])
    }

    if (header.length > 0) {
      const csv = [header.join(','), ...lines.map(l => l.join(','))].join('\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ambulance-${reportType}-report-${from}-to-${to}.csv`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  const formatCurrency = (n: number) => new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 2 }).format(n)
  const formatNumber = (n: number) => new Intl.NumberFormat('en-PK', { maximumFractionDigits: 2 }).format(n)

  const summary = useMemo(() => data?.summary, [data])

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-800">Reports & Analytics</h2>
        <button onClick={exportCSV} disabled={!data} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50">
          Export CSV
        </button>
      </div>

      {/* Report Type Tabs */}
      <div className="mt-4 flex flex-wrap gap-2">
        {reportTypes.map(rt => (
          <button
            key={rt.key}
            onClick={() => setReportType(rt.key)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              reportType === rt.key
                ? 'bg-sky-600 text-white'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {rt.icon} {rt.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="mt-4 flex flex-wrap gap-3">
        <input
          type="date"
          value={from}
          onChange={e => setFrom(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          type="date"
          value={to}
          onChange={e => setTo(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <select
          value={ambulanceId}
          onChange={e => setAmbulanceId(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">All Ambulances</option>
          {ambulances.map(a => (
            <option key={a.id} value={a.id}>{a.vehicleNumber}</option>
          ))}
        </select>
      </div>

      {/* Loading / Error */}
      {loading && (
        <div className="mt-8 text-center text-slate-500">Loading report...</div>
      )}
      {error && (
        <div className="mt-8 rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-700">{error}</div>
      )}

      {/* Report Content */}
      {!loading && !error && data && (
        <div className="mt-6">
          {/* Summary Cards */}
          {summary && (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-sm text-slate-500">Total Trips</div>
                <div className="text-xl font-bold text-slate-800">{formatNumber(summary.totalTrips)}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-sm text-slate-500">Distance (km)</div>
                <div className="text-xl font-bold text-slate-800">{formatNumber(summary.totalDistance)}</div>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="text-sm text-amber-600">Fuel (L)</div>
                <div className="text-xl font-bold text-amber-700">{formatNumber(summary.totalFuel)}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-sm text-slate-500">Fuel Cost</div>
                <div className="text-xl font-bold text-amber-600">{formatCurrency(summary.totalFuelCost)}</div>
              </div>
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
                <div className="text-sm text-rose-600">Total Expenses</div>
                <div className="text-xl font-bold text-rose-700">{formatCurrency(summary.totalExpenses)}</div>
              </div>
              <div className="rounded-lg border border-violet-200 bg-violet-50 p-4">
                <div className="text-sm text-violet-600">Avg Cost/Km</div>
                <div className="text-xl font-bold text-violet-700">{formatCurrency(summary.avgCostPerKm)}</div>
              </div>
            </div>
          )}

          {/* Usage Report - By Ambulance */}
          {reportType === 'usage' && data.byAmbulance && (
            <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left">
                    <th className="px-4 py-2 font-medium text-slate-600">Vehicle #</th>
                    <th className="px-4 py-2 font-medium text-slate-600 text-right">Trips</th>
                    <th className="px-4 py-2 font-medium text-slate-600 text-right">Distance (km)</th>
                    <th className="px-4 py-2 font-medium text-slate-600 text-right">Fuel (L)</th>
                    <th className="px-4 py-2 font-medium text-slate-600 text-right">Fuel Cost</th>
                    <th className="px-4 py-2 font-medium text-slate-600 text-right">Expenses</th>
                    <th className="px-4 py-2 font-medium text-slate-600 text-right">Cost/Km</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byAmbulance.map(a => (
                    <tr key={a.ambulanceId} className="border-b border-slate-100">
                      <td className="px-4 py-2 font-medium text-slate-800">{a.vehicleNumber}</td>
                      <td className="px-4 py-2 text-right text-slate-700">{formatNumber(a.trips)}</td>
                      <td className="px-4 py-2 text-right text-slate-700">{formatNumber(a.distance)}</td>
                      <td className="px-4 py-2 text-right text-slate-700">{formatNumber(a.fuel)}</td>
                      <td className="px-4 py-2 text-right text-amber-600">{formatCurrency(a.fuelCost)}</td>
                      <td className="px-4 py-2 text-right text-rose-600">{formatCurrency(a.expenses)}</td>
                      <td className="px-4 py-2 text-right font-medium text-violet-600">{formatCurrency(a.costPerKm)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Trip History */}
          {reportType === 'trips' && data.trips && (
            <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left">
                    <th className="px-4 py-2 font-medium text-slate-600">Vehicle #</th>
                    <th className="px-4 py-2 font-medium text-slate-600">Patient</th>
                    <th className="px-4 py-2 font-medium text-slate-600">Purpose</th>
                    <th className="px-4 py-2 font-medium text-slate-600">Pickup</th>
                    <th className="px-4 py-2 font-medium text-slate-600">Destination</th>
                    <th className="px-4 py-2 font-medium text-slate-600">Date</th>
                    <th className="px-4 py-2 font-medium text-slate-600 text-right">Distance</th>
                    <th className="px-4 py-2 font-medium text-slate-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.trips.map(t => (
                    <tr key={t.id} className="border-b border-slate-100">
                      <td className="px-4 py-2 font-medium text-slate-800">{t.vehicleNumber}</td>
                      <td className="px-4 py-2 text-slate-600">{t.patientName || '-'}</td>
                      <td className="px-4 py-2 text-slate-600">{t.purpose}</td>
                      <td className="px-4 py-2 text-slate-600">{t.pickupLocation}</td>
                      <td className="px-4 py-2 text-slate-600">{t.destination}</td>
                      <td className="px-4 py-2 text-slate-500">{new Date(t.departureTime).toLocaleString()}</td>
                      <td className="px-4 py-2 text-right text-slate-700">{t.distanceTraveled ? `${formatNumber(t.distanceTraveled)} km` : '-'}</td>
                      <td className="px-4 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs ${t.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' : t.status === 'In Progress' ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-600'}`}>
                          {t.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.trips.length === 0 && (
                <div className="py-8 text-center text-slate-500">No trips in selected period</div>
              )}
            </div>
          )}

          {/* Fuel Report */}
          {reportType === 'fuel' && data.fuel && (
            <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left">
                    <th className="px-4 py-2 font-medium text-slate-600">Vehicle #</th>
                    <th className="px-4 py-2 font-medium text-slate-600">Date</th>
                    <th className="px-4 py-2 font-medium text-slate-600 text-right">Quantity (L)</th>
                    <th className="px-4 py-2 font-medium text-slate-600 text-right">Cost</th>
                    <th className="px-4 py-2 font-medium text-slate-600">Station</th>
                  </tr>
                </thead>
                <tbody>
                  {data.fuel.map((f, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="px-4 py-2 font-medium text-slate-800">{f.vehicleNumber}</td>
                      <td className="px-4 py-2 text-slate-700">{f.date}</td>
                      <td className="px-4 py-2 text-right text-slate-700">{formatNumber(f.quantity)}</td>
                      <td className="px-4 py-2 text-right text-amber-600">{formatCurrency(f.cost)}</td>
                      <td className="px-4 py-2 text-slate-500">{f.station || '-'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-300 bg-slate-50 font-medium">
                    <td colSpan={2} className="px-4 py-2 text-slate-700">Total</td>
                    <td className="px-4 py-2 text-right text-slate-800">{formatNumber(data.fuel.reduce((s, f) => s + f.quantity, 0))} L</td>
                    <td className="px-4 py-2 text-right text-amber-700">{formatCurrency(data.fuel.reduce((s, f) => s + f.cost, 0))}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
              {data.fuel.length === 0 && (
                <div className="py-8 text-center text-slate-500">No fuel records in selected period</div>
              )}
            </div>
          )}

          {/* Expense Report */}
          {reportType === 'expenses' && data.expenses && (
            <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left">
                    <th className="px-4 py-2 font-medium text-slate-600">Vehicle #</th>
                    <th className="px-4 py-2 font-medium text-slate-600">Category</th>
                    <th className="px-4 py-2 font-medium text-slate-600 text-right">Amount</th>
                    <th className="px-4 py-2 font-medium text-slate-600">Date</th>
                    <th className="px-4 py-2 font-medium text-slate-600">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {data.expenses.map((e, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="px-4 py-2 font-medium text-slate-800">{e.vehicleNumber}</td>
                      <td className="px-4 py-2">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{e.category}</span>
                      </td>
                      <td className="px-4 py-2 text-right text-rose-600">{formatCurrency(e.amount)}</td>
                      <td className="px-4 py-2 text-slate-700">{e.date}</td>
                      <td className="px-4 py-2 text-slate-500">{e.description || '-'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-300 bg-slate-50 font-medium">
                    <td colSpan={2} className="px-4 py-2 text-slate-700">Total</td>
                    <td className="px-4 py-2 text-right text-rose-700">{formatCurrency(data.expenses.reduce((s, e) => s + e.amount, 0))}</td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
              {data.expenses.length === 0 && (
                <div className="py-8 text-center text-slate-500">No expenses in selected period</div>
              )}
            </div>
          )}

          {/* Cost per Km Analysis */}
          {reportType === 'cost-per-km' && data.byAmbulance && (
            <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left">
                    <th className="px-4 py-2 font-medium text-slate-600">Vehicle #</th>
                    <th className="px-4 py-2 font-medium text-slate-600 text-right">Distance (km)</th>
                    <th className="px-4 py-2 font-medium text-slate-600 text-right">Fuel Cost</th>
                    <th className="px-4 py-2 font-medium text-slate-600 text-right">Other Expenses</th>
                    <th className="px-4 py-2 font-medium text-slate-600 text-right">Total Cost</th>
                    <th className="px-4 py-2 font-medium text-slate-600 text-right">Cost/Km</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byAmbulance.map(a => (
                    <tr key={a.ambulanceId} className="border-b border-slate-100">
                      <td className="px-4 py-2 font-medium text-slate-800">{a.vehicleNumber}</td>
                      <td className="px-4 py-2 text-right text-slate-700">{formatNumber(a.distance)}</td>
                      <td className="px-4 py-2 text-right text-amber-600">{formatCurrency(a.fuelCost)}</td>
                      <td className="px-4 py-2 text-right text-rose-600">{formatCurrency(a.expenses)}</td>
                      <td className="px-4 py-2 text-right font-medium text-slate-800">{formatCurrency(a.fuelCost + a.expenses)}</td>
                      <td className="px-4 py-2 text-right font-bold text-violet-600">{formatCurrency(a.costPerKm)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Patient Transport History */}
          {reportType === 'patient-transport' && data.patientTransport && (
            <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left">
                    <th className="px-4 py-2 font-medium text-slate-600">Patient</th>
                    <th className="px-4 py-2 font-medium text-slate-600">Patient ID</th>
                    <th className="px-4 py-2 font-medium text-slate-600">Vehicle #</th>
                    <th className="px-4 py-2 font-medium text-slate-600">Purpose</th>
                    <th className="px-4 py-2 font-medium text-slate-600">Pickup</th>
                    <th className="px-4 py-2 font-medium text-slate-600">Destination</th>
                    <th className="px-4 py-2 font-medium text-slate-600">Date</th>
                    <th className="px-4 py-2 font-medium text-slate-600 text-right">Distance</th>
                  </tr>
                </thead>
                <tbody>
                  {data.patientTransport.map((p, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="px-4 py-2 font-medium text-slate-800">{p.patientName || '-'}</td>
                      <td className="px-4 py-2 text-slate-600">{p.patientId || '-'}</td>
                      <td className="px-4 py-2 text-slate-700">{p.vehicleNumber}</td>
                      <td className="px-4 py-2 text-slate-600">{p.purpose}</td>
                      <td className="px-4 py-2 text-slate-600">{p.pickupLocation}</td>
                      <td className="px-4 py-2 text-slate-600">{p.destination}</td>
                      <td className="px-4 py-2 text-slate-500">{new Date(p.departureTime).toLocaleString()}</td>
                      <td className="px-4 py-2 text-right text-slate-700">{p.distanceTraveled ? `${formatNumber(p.distanceTraveled)} km` : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.patientTransport.length === 0 && (
                <div className="py-8 text-center text-slate-500">No patient transport records in selected period</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
