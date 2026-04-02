import { useEffect, useState } from 'react'
import { hospitalApi } from '../../utils/api'
import Toast, { type ToastState } from '../../components/ui/Toast'
import Pagination from '../../components/ui/Pagination'

type Ambulance = {
  id: string
  vehicleNumber: string
  type: 'BLS' | 'ALS' | 'Patient Transport' | 'Neonatal'
  driverName: string
  driverContact: string
  status: 'Available' | 'On Duty' | 'Maintenance'
  notes?: string
  totalTrips?: number
  totalDistance?: number
  lastTrip?: string
}

export default function Ambulance_Master() {
  const [items, setItems] = useState<Ambulance[]>([])
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({
    vehicleNumber: '',
    type: 'BLS' as 'BLS' | 'ALS' | 'Patient Transport' | 'Neonatal',
    driverName: '',
    driverContact: '',
    status: 'Available' as 'Available' | 'On Duty' | 'Maintenance',
    notes: '',
  })
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    vehicleNumber: '',
    type: 'BLS' as 'BLS' | 'ALS' | 'Patient Transport' | 'Neonatal',
    driverName: '',
    driverContact: '',
    status: 'Available' as 'Available' | 'On Duty' | 'Maintenance',
    notes: '',
  })
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastState>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)

  const loadItems = async (p = 1) => {
    setLoading(true)
    try {
      const res = await hospitalApi.listAmbulances({ status: statusFilter || undefined, search: query || undefined, page: p, limit: 20 }) as any
      const ambulances = (res.ambulances || res.data || res || []).map((a: any) => ({
        id: String(a._id || a.id),
        vehicleNumber: a.vehicleNumber,
        type: a.type,
        driverName: a.driverName,
        driverContact: a.driverContact,
        status: a.status || 'Available',
        notes: a.notes,
        totalTrips: a.totalTrips || 0,
        totalDistance: a.totalDistance || 0,
        lastTrip: a.lastTrip,
      })) as Ambulance[]
      setItems(ambulances)
      const pg = res.pagination || {}
      setPage(pg.page || 1)
      setPages(pg.pages || 1)
      setTotal(pg.total || ambulances.length)
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadItems(1)
  }, [statusFilter])

  useEffect(() => {
    const timer = setTimeout(() => loadItems(1), 400)
    return () => clearTimeout(timer)
  }, [query])

  const saveAdd = async () => {
    if (!addForm.vehicleNumber.trim() || !addForm.driverName.trim()) {
      setToast({ type: 'error', message: 'Vehicle number and driver name are required' })
      return
    }
    try {
      await hospitalApi.createAmbulance(addForm)
      loadItems(page)
      setShowAdd(false)
      setAddForm({ vehicleNumber: '', type: 'BLS', driverName: '', driverContact: '', status: 'Available', notes: '' })
      setToast({ type: 'success', message: 'Ambulance added' })
    } catch (err: any) {
      setToast({ type: 'error', message: err?.message || 'Failed to add ambulance' })
    }
  }

  const saveEdit = async () => {
    if (!editId || !editForm.vehicleNumber.trim() || !editForm.driverName.trim()) return
    try {
      await hospitalApi.updateAmbulance(editId, editForm)
      loadItems(page)
      setEditId(null)
      setToast({ type: 'success', message: 'Ambulance updated' })
    } catch (err: any) {
      setToast({ type: 'error', message: err?.message || 'Failed to update' })
    }
  }

  const confirmDelete = async () => {
    if (!deleteId) return
    try {
      await hospitalApi.deleteAmbulance(deleteId)
      loadItems(page)
      setDeleteId(null)
      setToast({ type: 'success', message: 'Ambulance deleted' })
    } catch (err: any) {
      setToast({ type: 'error', message: err?.message || 'Failed to delete' })
    }
  }

  const statusColors: Record<string, string> = {
    'Available': 'bg-emerald-100 text-emerald-700',
    'On Duty': 'bg-sky-100 text-sky-700',
    'Maintenance': 'bg-amber-100 text-amber-700',
  }

  const typeLabels: Record<string, string> = {
    'BLS': 'Basic Life Support',
    'ALS': 'Advanced Life Support',
    'Patient Transport': 'Patient Transport',
    'Neonatal': 'Neonatal',
  }

  const formatNumber = (n: number) => new Intl.NumberFormat('en-PK').format(n)

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-800">Ambulance Master</h2>
        <button onClick={() => setShowAdd(true)} className="rounded-md bg-sky-600 px-3 py-1.5 text-white hover:bg-sky-700">
          + Add Ambulance
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by vehicle number, driver..."
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
        />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="">All Status</option>
          <option value="Available">Available</option>
          <option value="On Duty">On Duty</option>
          <option value="Maintenance">Maintenance</option>
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="">All Types</option>
          <option value="BLS">Basic Life Support</option>
          <option value="ALS">Advanced Life Support</option>
          <option value="Patient Transport">Patient Transport</option>
          <option value="Neonatal">Neonatal</option>
        </select>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left">
              <th className="px-3 py-2 font-medium text-slate-600">Vehicle #</th>
              <th className="px-3 py-2 font-medium text-slate-600">Type</th>
              <th className="px-3 py-2 font-medium text-slate-600">Driver</th>
              <th className="px-3 py-2 font-medium text-slate-600">Contact</th>
              <th className="px-3 py-2 font-medium text-slate-600">Status</th>
              <th className="px-3 py-2 font-medium text-slate-600 text-right">Total Trips</th>
              <th className="px-3 py-2 font-medium text-slate-600 text-right">Distance (km)</th>
              <th className="px-3 py-2 font-medium text-slate-600">Last Trip</th>
              <th className="px-3 py-2 font-medium text-slate-600"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="px-3 py-8 text-center text-slate-500">Loading...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={9} className="px-3 py-8 text-center text-slate-500">No ambulances found</td></tr>
            ) : (
              items.map(a => (
              <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-2 font-medium text-slate-800">{a.vehicleNumber}</td>
                <td className="px-3 py-2 text-slate-600">{typeLabels[a.type]}</td>
                <td className="px-3 py-2 text-slate-600">{a.driverName}</td>
                <td className="px-3 py-2 text-slate-600">{a.driverContact || '-'}</td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${statusColors[a.status]}`}>
                    {a.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-right text-slate-700">{formatNumber(a.totalTrips || 0)}</td>
                <td className="px-3 py-2 text-right text-slate-700">{formatNumber(a.totalDistance || 0)}</td>
                <td className="px-3 py-2 text-slate-500">{a.lastTrip || '-'}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    <button onClick={() => { setEditId(a.id); setEditForm({ vehicleNumber: a.vehicleNumber, type: a.type, driverName: a.driverName, driverContact: a.driverContact, status: a.status, notes: a.notes || '' }) }} className="rounded p-1 text-slate-500 hover:bg-slate-100">✏️</button>
                    <button onClick={() => setDeleteId(a.id)} className="rounded p-1 text-slate-500 hover:bg-slate-100">🗑️</button>
                  </div>
                </td>
              </tr>
            )))}
          </tbody>
        </table>
        <Pagination page={page} pages={pages} total={total} onPageChange={loadItems} />
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-800">Add Ambulance</h3>
              <button onClick={() => setShowAdd(false)} className="text-slate-500">✖</button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm text-slate-700">Vehicle Number *</label>
                <input value={addForm.vehicleNumber} onChange={e => setAddForm(f => ({ ...f, vehicleNumber: e.target.value }))} placeholder="e.g., LEB-1234" className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-700">Type *</label>
                <select value={addForm.type} onChange={e => setAddForm(f => ({ ...f, type: e.target.value as any }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500">
                  <option value="BLS">Basic Life Support</option>
                  <option value="ALS">Advanced Life Support</option>
                  <option value="Patient Transport">Patient Transport</option>
                  <option value="Neonatal">Neonatal</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-700">Driver Name *</label>
                <input value={addForm.driverName} onChange={e => setAddForm(f => ({ ...f, driverName: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-700">Driver Contact</label>
                <input value={addForm.driverContact} onChange={e => setAddForm(f => ({ ...f, driverContact: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-700">Status</label>
                <select value={addForm.status} onChange={e => setAddForm(f => ({ ...f, status: e.target.value as any }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500">
                  <option value="Available">Available</option>
                  <option value="On Duty">On Duty</option>
                  <option value="Maintenance">Maintenance</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-sm text-slate-700">Notes</label>
                <input value={addForm.notes} onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes" className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500" />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowAdd(false)} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">Cancel</button>
              <button onClick={saveAdd} className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editId && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-800">Edit Ambulance</h3>
              <button onClick={() => setEditId(null)} className="text-slate-500">✖</button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm text-slate-700">Vehicle Number *</label>
                <input value={editForm.vehicleNumber} onChange={e => setEditForm(f => ({ ...f, vehicleNumber: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-700">Type *</label>
                <select value={editForm.type} onChange={e => setEditForm(f => ({ ...f, type: e.target.value as any }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500">
                  <option value="BLS">Basic Life Support</option>
                  <option value="ALS">Advanced Life Support</option>
                  <option value="Patient Transport">Patient Transport</option>
                  <option value="Neonatal">Neonatal</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-700">Driver Name *</label>
                <input value={editForm.driverName} onChange={e => setEditForm(f => ({ ...f, driverName: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-700">Driver Contact</label>
                <input value={editForm.driverContact} onChange={e => setEditForm(f => ({ ...f, driverContact: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-700">Status</label>
                <select value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value as any }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500">
                  <option value="Available">Available</option>
                  <option value="On Duty">On Duty</option>
                  <option value="Maintenance">Maintenance</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-sm text-slate-700">Notes</label>
                <input value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500" />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setEditId(null)} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">Cancel</button>
              <button onClick={saveEdit} className="rounded-md bg-violet-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-800">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-lg">
            <h3 className="text-base font-semibold text-slate-800">Delete Ambulance</h3>
            <p className="mt-2 text-sm text-slate-600">Are you sure? This cannot be undone.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setDeleteId(null)} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">Cancel</button>
              <button onClick={confirmDelete} className="rounded-md bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700">Delete</button>
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  )
}
