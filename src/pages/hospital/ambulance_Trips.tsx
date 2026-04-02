import { useEffect, useState } from 'react'
import { hospitalApi } from '../../utils/api'
import Toast, { type ToastState } from '../../components/ui/Toast'
import Pagination from '../../components/ui/Pagination'

type Ambulance = {
  id: string
  vehicleNumber: string
  type: string
  driverName: string
  driverContact: string
  status: string
}

type Trip = {
  id: string
  ambulanceId: string
  vehicleNumber: string
  patientName?: string
  patientId?: string
  pickupLocation: string
  destination: string
  purpose: 'Emergency Pickup' | 'Transfer' | 'Discharge' | 'Home Collection' | 'Other'
  departureTime: string
  returnTime?: string
  odometerStart: number
  odometerEnd?: number
  distanceTraveled?: number
  driverName: string
  status: 'In Progress' | 'Completed' | 'Cancelled'
  notes?: string
}

export default function Ambulance_Trips() {
  const [ambulances, setAmbulances] = useState<Ambulance[]>([])
  const [trips, setTrips] = useState<Trip[]>([])
  const [query, setQuery] = useState('')
  const [ambulanceFilter, setAmbulanceFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({
    ambulanceId: '',
    patientName: '',
    patientId: '',
    pickupLocation: '',
    destination: '',
    purpose: 'Emergency Pickup' as 'Emergency Pickup' | 'Transfer' | 'Discharge' | 'Home Collection' | 'Other',
    departureTime: new Date().toISOString().slice(0, 16),
    odometerStart: '',
    driverName: '',
    notes: '',
  })
  const [completeId, setCompleteId] = useState<string | null>(null)
  const [completeForm, setCompleteForm] = useState({ returnTime: new Date().toISOString().slice(0, 16), odometerEnd: '' })
  const [toast, setToast] = useState<ToastState>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)

  const loadAmbulances = async () => {
    try {
      const ambRes = await hospitalApi.listAmbulances({ limit: 100 }) as any
      setAmbulances((ambRes.ambulances || ambRes || []).map((a: any) => ({
        id: String(a._id || a.id),
        vehicleNumber: a.vehicleNumber,
        type: a.type,
        driverName: a.driverName,
        driverContact: a.driverContact,
        status: a.status,
      })))
    } catch {
      // API not ready
    }
  }

  const loadTrips = async (p = 1) => {
    setLoading(true)
    try {
      const tripRes = await hospitalApi.listAmbulanceTrips({
        ambulanceId: ambulanceFilter || undefined,
        status: statusFilter || undefined,
        from: from || undefined,
        to: to || undefined,
        search: query || undefined,
        page: p,
        limit: 20,
      }) as any
      setTrips((tripRes.trips || tripRes || []).map((t: any) => ({
        id: String(t._id || t.id),
        ambulanceId: String(t.ambulanceId),
        vehicleNumber: t.vehicleNumber || t.ambulance?.vehicleNumber || '',
        patientName: t.patientName,
        patientId: t.patientId,
        pickupLocation: t.pickupLocation,
        destination: t.destination,
        purpose: t.purpose,
        departureTime: t.departureTime,
        returnTime: t.returnTime,
        odometerStart: t.odometerStart,
        odometerEnd: t.odometerEnd,
        distanceTraveled: t.distanceTraveled,
        driverName: t.driverName || t.ambulance?.driverName || '',
        status: t.status || 'In Progress',
        notes: t.notes,
      })))
      const pg = tripRes.pagination || {}
      setPage(pg.page || 1)
      setPages(pg.pages || 1)
      setTotal(pg.total || 0)
    } catch {
      setTrips([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAmbulances()
  }, [])

  useEffect(() => {
    loadTrips(1)
  }, [ambulanceFilter, statusFilter, from, to])

  useEffect(() => {
    const timer = setTimeout(() => loadTrips(1), 400)
    return () => clearTimeout(timer)
  }, [query])

  const selectedAmbulance = ambulances.find(a => a.id === addForm.ambulanceId)

  const saveAdd = async () => {
    if (!addForm.ambulanceId || !addForm.pickupLocation || !addForm.destination || !addForm.odometerStart) {
      setToast({ type: 'error', message: 'Ambulance, locations, and odometer are required' })
      return
    }
    try {
      await hospitalApi.createAmbulanceTrip({
        ambulanceId: addForm.ambulanceId,
        patientName: addForm.patientName || undefined,
        patientId: addForm.patientId || undefined,
        pickupLocation: addForm.pickupLocation,
        destination: addForm.destination,
        purpose: addForm.purpose,
        departureTime: addForm.departureTime,
        odometerStart: Number(addForm.odometerStart),
        driverName: selectedAmbulance?.driverName,
        notes: addForm.notes || undefined,
      })
      loadTrips(page)
      setShowAdd(false)
      setAddForm({ ambulanceId: '', patientName: '', patientId: '', pickupLocation: '', destination: '', purpose: 'Emergency Pickup', departureTime: new Date().toISOString().slice(0, 16), odometerStart: '', driverName: '', notes: '' })
      setToast({ type: 'success', message: 'Trip started' })
    } catch (err: any) {
      setToast({ type: 'error', message: err?.message || 'Failed to create trip' })
    }
  }

  const saveComplete = async () => {
    if (!completeId || !completeForm.odometerEnd) {
      setToast({ type: 'error', message: 'Odometer reading is required' })
      return
    }
    try {
      await hospitalApi.completeAmbulanceTrip(completeId, {
        returnTime: completeForm.returnTime,
        odometerEnd: Number(completeForm.odometerEnd),
      })
      loadTrips(page)
      setCompleteId(null)
      setCompleteForm({ returnTime: new Date().toISOString().slice(0, 16), odometerEnd: '' })
      setToast({ type: 'success', message: 'Trip completed' })
    } catch (err: any) {
      setToast({ type: 'error', message: err?.message || 'Failed to complete trip' })
    }
  }

  const statusColors: Record<string, string> = {
    'In Progress': 'bg-sky-100 text-sky-700',
    'Completed': 'bg-emerald-100 text-emerald-700',
    'Cancelled': 'bg-slate-100 text-slate-600',
  }

  const purposeColors: Record<string, string> = {
    'Emergency Pickup': 'bg-rose-100 text-rose-700',
    'Transfer': 'bg-violet-100 text-violet-700',
    'Discharge': 'bg-emerald-100 text-emerald-700',
    'Home Collection': 'bg-amber-100 text-amber-700',
    'Other': 'bg-slate-100 text-slate-600',
  }

  const formatDateTime = (d: string) => d ? new Date(d).toLocaleString() : '-'
  const formatNumber = (n: number) => new Intl.NumberFormat('en-PK').format(n)

  if (loading) {
    return <div className="p-6 text-center text-slate-500">Loading...</div>
  }

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-800">Ambulance Trips</h2>
        <button onClick={() => setShowAdd(true)} className="rounded-md bg-sky-600 px-3 py-1.5 text-white hover:bg-sky-700">
          + New Trip
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search trips..."
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500"
        />
        <select value={ambulanceFilter} onChange={e => setAmbulanceFilter(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="">All Ambulances</option>
          {ambulances.map(a => (
            <option key={a.id} value={a.id}>{a.vehicleNumber}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="">All Status</option>
          <option value="In Progress">In Progress</option>
          <option value="Completed">Completed</option>
          <option value="Cancelled">Cancelled</option>
        </select>
        <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <input type="date" value={to} onChange={e => setTo(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left">
              <th className="px-3 py-2 font-medium text-slate-600">Vehicle #</th>
              <th className="px-3 py-2 font-medium text-slate-600">Patient</th>
              <th className="px-3 py-2 font-medium text-slate-600">Purpose</th>
              <th className="px-3 py-2 font-medium text-slate-600">Pickup</th>
              <th className="px-3 py-2 font-medium text-slate-600">Destination</th>
              <th className="px-3 py-2 font-medium text-slate-600">Departed</th>
              <th className="px-3 py-2 font-medium text-slate-600">Returned</th>
              <th className="px-3 py-2 font-medium text-slate-600 text-right">Distance</th>
              <th className="px-3 py-2 font-medium text-slate-600">Status</th>
              <th className="px-3 py-2 font-medium text-slate-600"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} className="px-3 py-8 text-center text-slate-500">Loading...</td></tr>
            ) : trips.length === 0 ? (
              <tr><td colSpan={10} className="px-3 py-8 text-center text-slate-500">No trips found</td></tr>
            ) : (
              trips.map(t => (
              <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-2 font-medium text-slate-800">{t.vehicleNumber}</td>
                <td className="px-3 py-2 text-slate-600">{t.patientName || '-'}</td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${purposeColors[t.purpose]}`}>{t.purpose}</span>
                </td>
                <td className="px-3 py-2 text-slate-600">{t.pickupLocation}</td>
                <td className="px-3 py-2 text-slate-600">{t.destination}</td>
                <td className="px-3 py-2 text-slate-500">{formatDateTime(t.departureTime)}</td>
                <td className="px-3 py-2 text-slate-500">{t.returnTime ? formatDateTime(t.returnTime) : '-'}</td>
                <td className="px-3 py-2 text-right text-slate-700">{t.distanceTraveled ? `${formatNumber(t.distanceTraveled)} km` : '-'}</td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${statusColors[t.status]}`}>{t.status}</span>
                </td>
                <td className="px-3 py-2">
                  {t.status === 'In Progress' && (
                    <button onClick={() => setCompleteId(t.id)} className="rounded bg-emerald-100 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-200">Complete</button>
                  )}
                </td>
              </tr>
            )))}
          </tbody>
        </table>
        <Pagination page={page} pages={pages} total={total} onPageChange={loadTrips} />
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-800">Start New Trip</h3>
              <button onClick={() => setShowAdd(false)} className="text-slate-500">✖</button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm text-slate-700">Ambulance *</label>
                <select value={addForm.ambulanceId} onChange={e => setAddForm(f => ({ ...f, ambulanceId: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500">
                  <option value="">Select ambulance</option>
                  {ambulances.filter(a => a.status === 'Available').map(a => (
                    <option key={a.id} value={a.id}>{a.vehicleNumber} - {a.driverName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-700">Purpose *</label>
                <select value={addForm.purpose} onChange={e => setAddForm(f => ({ ...f, purpose: e.target.value as any }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500">
                  <option value="Emergency Pickup">Emergency Pickup</option>
                  <option value="Transfer">Transfer</option>
                  <option value="Discharge">Discharge</option>
                  <option value="Home Collection">Home Collection</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-700">Patient Name</label>
                <input value={addForm.patientName} onChange={e => setAddForm(f => ({ ...f, patientName: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-700">Patient ID / MRN</label>
                <input value={addForm.patientId} onChange={e => setAddForm(f => ({ ...f, patientId: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-700">Pickup Location *</label>
                <input value={addForm.pickupLocation} onChange={e => setAddForm(f => ({ ...f, pickupLocation: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-700">Destination *</label>
                <input value={addForm.destination} onChange={e => setAddForm(f => ({ ...f, destination: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-700">Departure Time</label>
                <input type="datetime-local" value={addForm.departureTime} onChange={e => setAddForm(f => ({ ...f, departureTime: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-700">Odometer Start *</label>
                <input type="number" value={addForm.odometerStart} onChange={e => setAddForm(f => ({ ...f, odometerStart: e.target.value }))} placeholder="Current reading" className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500" />
              </div>
              {selectedAmbulance && (
                <div className="col-span-2 rounded-lg bg-slate-50 p-3 text-sm">
                  <span className="text-slate-500">Driver:</span> <span className="font-medium">{selectedAmbulance.driverName}</span> ({selectedAmbulance.driverContact})
                </div>
              )}
              <div className="col-span-2">
                <label className="mb-1 block text-sm text-slate-700">Notes</label>
                <input value={addForm.notes} onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500" />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowAdd(false)} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">Cancel</button>
              <button onClick={saveAdd} className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700">Start Trip</button>
            </div>
          </div>
        </div>
      )}

      {/* Complete Modal */}
      {completeId && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-800">Complete Trip</h3>
              <button onClick={() => setCompleteId(null)} className="text-slate-500">✖</button>
            </div>
            {(() => {
              const trip = trips.find(t => t.id === completeId)
              if (!trip) return null
              return (
                <div className="mt-4 space-y-3">
                  <div className="rounded-lg bg-slate-50 p-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Vehicle:</span>
                      <span className="font-medium">{trip.vehicleNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Start Odometer:</span>
                      <span className="font-medium">{formatNumber(trip.odometerStart)} km</span>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-slate-700">Return Time</label>
                    <input type="datetime-local" value={completeForm.returnTime} onChange={e => setCompleteForm(f => ({ ...f, returnTime: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-slate-700">Odometer End *</label>
                    <input type="number" value={completeForm.odometerEnd} onChange={e => setCompleteForm(f => ({ ...f, odometerEnd: e.target.value }))} placeholder="Current reading" className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500" />
                  </div>
                  {completeForm.odometerEnd && (
                    <div className="rounded-lg bg-emerald-50 p-3 text-sm">
                      <span className="text-emerald-600">Distance:</span>{' '}
                      <span className="font-bold text-emerald-700">{formatNumber(Math.max(0, Number(completeForm.odometerEnd) - trip.odometerStart))} km</span>
                    </div>
                  )}
                </div>
              )
            })()}
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setCompleteId(null)} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">Cancel</button>
              <button onClick={saveComplete} className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700">Complete Trip</button>
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  )
}
