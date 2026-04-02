import { useEffect, useMemo, useState } from 'react'
import { hospitalApi } from '../../utils/api'
import Toast, { type ToastState } from '../../components/ui/Toast'
import Pagination from '../../components/ui/Pagination'

type Ambulance = {
  id: string
  vehicleNumber: string
  driverName: string
}

type FuelRecord = {
  id: string
  ambulanceId: string
  vehicleNumber: string
  date: string
  quantity: number
  cost: number
  station?: string
  odometer: number
  receiptNo?: string
  notes?: string
}

export default function Ambulance_Fuel() {
  const [ambulances, setAmbulances] = useState<Ambulance[]>([])
  const [records, setRecords] = useState<FuelRecord[]>([])
  const [query, setQuery] = useState('')
  const [ambulanceFilter, setAmbulanceFilter] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({
    ambulanceId: '',
    date: new Date().toISOString().slice(0, 10),
    quantity: '',
    cost: '',
    station: '',
    odometer: '',
    receiptNo: '',
    notes: '',
  })
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ date: '', quantity: '', cost: '', station: '', odometer: '', receiptNo: '', notes: '' })
  const [deleteId, setDeleteId] = useState<string | null>(null)
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
        driverName: a.driverName,
      })))
    } catch {
      // API not ready
    }
  }

  const loadRecords = async (p = 1) => {
    setLoading(true)
    try {
      const fuelRes = await hospitalApi.listAmbulanceFuel({
        ambulanceId: ambulanceFilter || undefined,
        from: from || undefined,
        to: to || undefined,
        search: query || undefined,
        page: p,
        limit: 20,
      }) as any
      setRecords((fuelRes.fuel || fuelRes.data || fuelRes || []).map((f: any) => ({
        id: String(f._id || f.id),
        ambulanceId: String(f.ambulanceId),
        vehicleNumber: f.vehicleNumber || f.ambulance?.vehicleNumber || '',
        date: f.date,
        quantity: f.quantity,
        cost: f.cost,
        station: f.station,
        odometer: f.odometer,
        receiptNo: f.receiptNo,
        notes: f.notes,
      })))
      const pg = fuelRes.pagination || {}
      setPage(pg.page || 1)
      setPages(pg.pages || 1)
      setTotal(pg.total || 0)
    } catch {
      setRecords([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAmbulances()
  }, [])

  useEffect(() => {
    loadRecords(1)
  }, [ambulanceFilter, from, to])

  useEffect(() => {
    const timer = setTimeout(() => loadRecords(1), 400)
    return () => clearTimeout(timer)
  }, [query])

  const summary = useMemo(() => {
    const totalQty = records.reduce((s, r) => s + r.quantity, 0)
    const totalCost = records.reduce((s, r) => s + r.cost, 0)
    const avgPerLiter = totalQty > 0 ? totalCost / totalQty : 0
    return { totalQty, totalCost, avgPerLiter }
  }, [records])

  const saveAdd = async () => {
    if (!addForm.ambulanceId || !addForm.quantity || !addForm.cost || !addForm.odometer) {
      setToast({ type: 'error', message: 'Ambulance, quantity, cost, and odometer are required' })
      return
    }
    try {
      await hospitalApi.createAmbulanceFuel({
        ambulanceId: addForm.ambulanceId,
        date: addForm.date,
        quantity: Number(addForm.quantity),
        cost: Number(addForm.cost),
        station: addForm.station || undefined,
        odometer: Number(addForm.odometer),
        receiptNo: addForm.receiptNo || undefined,
        notes: addForm.notes || undefined,
      })
      loadRecords(page)
      setShowAdd(false)
      setAddForm({ ambulanceId: '', date: new Date().toISOString().slice(0, 10), quantity: '', cost: '', station: '', odometer: '', receiptNo: '', notes: '' })
      setToast({ type: 'success', message: 'Fuel record added' })
    } catch (err: any) {
      setToast({ type: 'error', message: err?.message || 'Failed to add record' })
    }
  }

  const saveEdit = async () => {
    if (!editId) return
    try {
      await hospitalApi.updateAmbulanceFuel(editId, {
        date: editForm.date,
        quantity: Number(editForm.quantity),
        cost: Number(editForm.cost),
        station: editForm.station || undefined,
        odometer: Number(editForm.odometer),
        receiptNo: editForm.receiptNo || undefined,
        notes: editForm.notes || undefined,
      })
      setRecords(prev => prev.map(r => r.id === editId ? { ...r, ...editForm, quantity: Number(editForm.quantity), cost: Number(editForm.cost), odometer: Number(editForm.odometer) } : r))
      setEditId(null)
      setToast({ type: 'success', message: 'Record updated' })
    } catch (err: any) {
      setToast({ type: 'error', message: err?.message || 'Failed to update' })
    }
  }

  const confirmDelete = async () => {
    if (!deleteId) return
    try {
      await hospitalApi.deleteAmbulanceFuel(deleteId)
      setRecords(prev => prev.filter(r => r.id !== deleteId))
      setDeleteId(null)
      setToast({ type: 'success', message: 'Record deleted' })
    } catch (err: any) {
      setToast({ type: 'error', message: err?.message || 'Failed to delete' })
    }
  }

  const exportCSV = () => {
    const header = ['Date', 'Ambulance', 'Quantity (L)', 'Cost', 'Station', 'Odometer', 'Receipt No', 'Notes']
    const lines = [header.join(',')]
    for (const r of records) {
      lines.push([r.date, r.vehicleNumber, r.quantity, r.cost, r.station || '', r.odometer, r.receiptNo || '', r.notes || ''].join(','))
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `fuel-report-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const formatCurrency = (n: number) => new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(n)
  const formatNumber = (n: number) => new Intl.NumberFormat('en-PK').format(n)

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-800">Fuel Tracking</h2>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">Export CSV</button>
          <button onClick={() => setShowAdd(true)} className="rounded-md bg-sky-600 px-3 py-1.5 text-white hover:bg-sky-700">+ Add Fuel</button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="mt-4 grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm text-slate-500">Total Fuel</div>
          <div className="text-xl font-bold text-slate-800">{formatNumber(summary.totalQty)} L</div>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="text-sm text-amber-600">Total Cost</div>
          <div className="text-xl font-bold text-amber-700">{formatCurrency(summary.totalCost)}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm text-slate-500">Avg. per Liter</div>
          <div className="text-xl font-bold text-slate-800">{formatCurrency(summary.avgPerLiter)}</div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search..."
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500"
        />
        <select value={ambulanceFilter} onChange={e => setAmbulanceFilter(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="">All Ambulances</option>
          {ambulances.map(a => (
            <option key={a.id} value={a.id}>{a.vehicleNumber}</option>
          ))}
        </select>
        <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <input type="date" value={to} onChange={e => setTo(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left">
              <th className="px-3 py-2 font-medium text-slate-600">Date</th>
              <th className="px-3 py-2 font-medium text-slate-600">Ambulance</th>
              <th className="px-3 py-2 font-medium text-slate-600 text-right">Quantity (L)</th>
              <th className="px-3 py-2 font-medium text-slate-600 text-right">Cost</th>
              <th className="px-3 py-2 font-medium text-slate-600">Station</th>
              <th className="px-3 py-2 font-medium text-slate-600 text-right">Odometer</th>
              <th className="px-3 py-2 font-medium text-slate-600">Receipt</th>
              <th className="px-3 py-2 font-medium text-slate-600"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-slate-500">Loading...</td></tr>
            ) : records.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-slate-500">No fuel records found</td></tr>
            ) : (
              records.map(r => (
              <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-2 text-slate-700">{r.date}</td>
                <td className="px-3 py-2 font-medium text-slate-800">{r.vehicleNumber}</td>
                <td className="px-3 py-2 text-right text-slate-700">{formatNumber(r.quantity)}</td>
                <td className="px-3 py-2 text-right font-medium text-amber-600">{formatCurrency(r.cost)}</td>
                <td className="px-3 py-2 text-slate-600">{r.station || '-'}</td>
                <td className="px-3 py-2 text-right text-slate-700">{formatNumber(r.odometer)} km</td>
                <td className="px-3 py-2 text-slate-500">{r.receiptNo || '-'}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    <button onClick={() => { const rec = records.find(x => x.id === r.id); if (rec) setEditForm({ date: rec.date, quantity: String(rec.quantity), cost: String(rec.cost), station: rec.station || '', odometer: String(rec.odometer), receiptNo: rec.receiptNo || '', notes: rec.notes || '' }); setEditId(r.id) }} className="rounded p-1 text-slate-500 hover:bg-slate-100">✏️</button>
                    <button onClick={() => setDeleteId(r.id)} className="rounded p-1 text-slate-500 hover:bg-slate-100">🗑️</button>
                  </div>
                </td>
              </tr>
            )))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-300 bg-slate-50 font-medium">
              <td colSpan={2} className="px-3 py-2 text-slate-700">Total</td>
              <td className="px-3 py-2 text-right text-slate-800">{formatNumber(summary.totalQty)} L</td>
              <td className="px-3 py-2 text-right text-amber-700">{formatCurrency(summary.totalCost)}</td>
              <td colSpan={4}></td>
            </tr>
          </tfoot>
        </table>
        <Pagination page={page} pages={pages} total={total} onPageChange={loadRecords} />
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-800">Add Fuel Record</h3>
              <button onClick={() => setShowAdd(false)} className="text-slate-500">✖</button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm text-slate-700">Ambulance *</label>
                <select value={addForm.ambulanceId} onChange={e => setAddForm(f => ({ ...f, ambulanceId: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500">
                  <option value="">Select ambulance</option>
                  {ambulances.map(a => (
                    <option key={a.id} value={a.id}>{a.vehicleNumber}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-700">Date *</label>
                <input type="date" value={addForm.date} onChange={e => setAddForm(f => ({ ...f, date: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-700">Quantity (L) *</label>
                <input type="number" step="0.01" value={addForm.quantity} onChange={e => setAddForm(f => ({ ...f, quantity: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-700">Cost (PKR) *</label>
                <input type="number" step="0.01" value={addForm.cost} onChange={e => setAddForm(f => ({ ...f, cost: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-700">Station</label>
                <input value={addForm.station} onChange={e => setAddForm(f => ({ ...f, station: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-700">Odometer (km) *</label>
                <input type="number" value={addForm.odometer} onChange={e => setAddForm(f => ({ ...f, odometer: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-700">Receipt No</label>
                <input value={addForm.receiptNo} onChange={e => setAddForm(f => ({ ...f, receiptNo: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500" />
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-sm text-slate-700">Notes</label>
                <input value={addForm.notes} onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500" />
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
              <h3 className="text-base font-semibold text-slate-800">Edit Fuel Record</h3>
              <button onClick={() => setEditId(null)} className="text-slate-500">✖</button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm text-slate-700">Date *</label>
                <input type="date" value={editForm.date} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-700">Quantity (L) *</label>
                <input type="number" step="0.01" value={editForm.quantity} onChange={e => setEditForm(f => ({ ...f, quantity: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-700">Cost (PKR) *</label>
                <input type="number" step="0.01" value={editForm.cost} onChange={e => setEditForm(f => ({ ...f, cost: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-700">Station</label>
                <input value={editForm.station} onChange={e => setEditForm(f => ({ ...f, station: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-700">Odometer (km) *</label>
                <input type="number" value={editForm.odometer} onChange={e => setEditForm(f => ({ ...f, odometer: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-700">Receipt No</label>
                <input value={editForm.receiptNo} onChange={e => setEditForm(f => ({ ...f, receiptNo: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500" />
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
            <h3 className="text-base font-semibold text-slate-800">Delete Record</h3>
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
