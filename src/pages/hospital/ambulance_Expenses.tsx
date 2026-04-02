import { useEffect, useMemo, useState } from 'react'
import { hospitalApi } from '../../utils/api'
import Toast, { type ToastState } from '../../components/ui/Toast'
import Pagination from '../../components/ui/Pagination'

type Ambulance = {
  id: string
  vehicleNumber: string
  driverName: string
}

type Expense = {
  id: string
  ambulanceId: string
  vehicleNumber: string
  category: 'Fuel' | 'Maintenance' | 'Repairs' | 'Driver Allowance' | 'Insurance' | 'Registration' | 'Other'
  amount: number
  date: string
  description?: string
  receiptNo?: string
}

const categories = ['Fuel', 'Maintenance', 'Repairs', 'Driver Allowance', 'Insurance', 'Registration', 'Other'] as const

export default function Ambulance_Expenses() {
  const [ambulances, setAmbulances] = useState<Ambulance[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [query, setQuery] = useState('')
  const [ambulanceFilter, setAmbulanceFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({
    ambulanceId: '',
    category: 'Fuel' as typeof categories[number],
    amount: '',
    date: new Date().toISOString().slice(0, 10),
    description: '',
    receiptNo: '',
  })
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ category: 'Fuel' as typeof categories[number], amount: '', date: '', description: '', receiptNo: '' })
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

  const loadExpenses = async (p = 1) => {
    setLoading(true)
    try {
      const expRes = await hospitalApi.listAmbulanceExpenses({
        ambulanceId: ambulanceFilter || undefined,
        category: categoryFilter || undefined,
        from: from || undefined,
        to: to || undefined,
        search: query || undefined,
        page: p,
        limit: 20,
      }) as any
      setExpenses((expRes.expenses || expRes.data || expRes || []).map((e: any) => ({
        id: String(e._id || e.id),
        ambulanceId: String(e.ambulanceId),
        vehicleNumber: e.vehicleNumber || e.ambulance?.vehicleNumber || '',
        category: e.category,
        amount: e.amount,
        date: e.date,
        description: e.description,
        receiptNo: e.receiptNo,
      })))
      const pg = expRes.pagination || {}
      setPage(pg.page || 1)
      setPages(pg.pages || 1)
      setTotal(pg.total || 0)
    } catch {
      setExpenses([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAmbulances()
  }, [])

  useEffect(() => {
    loadExpenses(1)
  }, [ambulanceFilter, categoryFilter, from, to])

  useEffect(() => {
    const timer = setTimeout(() => loadExpenses(1), 400)
    return () => clearTimeout(timer)
  }, [query])

  const summary = useMemo(() => {
    const total = expenses.reduce((s, e) => s + e.amount, 0)
    const byCategory = categories.reduce((acc, cat) => {
      acc[cat] = expenses.filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0)
      return acc
    }, {} as Record<string, number>)
    return { total, byCategory }
  }, [expenses])

  const saveAdd = async () => {
    if (!addForm.ambulanceId || !addForm.amount) {
      setToast({ type: 'error', message: 'Ambulance and amount are required' })
      return
    }
    try {
      await hospitalApi.createAmbulanceExpense({
        ambulanceId: addForm.ambulanceId,
        category: addForm.category,
        amount: Number(addForm.amount),
        date: addForm.date,
        description: addForm.description || undefined,
        receiptNo: addForm.receiptNo || undefined,
      })
      loadExpenses(page)
      setShowAdd(false)
      setAddForm({ ambulanceId: '', category: 'Fuel', amount: '', date: new Date().toISOString().slice(0, 10), description: '', receiptNo: '' })
      setToast({ type: 'success', message: 'Expense added' })
    } catch (err: any) {
      setToast({ type: 'error', message: err?.message || 'Failed to add expense' })
    }
  }

  const saveEdit = async () => {
    if (!editId || !editForm.amount) return
    try {
      await hospitalApi.updateAmbulanceExpense(editId, {
        category: editForm.category,
        amount: Number(editForm.amount),
        date: editForm.date,
        description: editForm.description || undefined,
        receiptNo: editForm.receiptNo || undefined,
      })
      loadExpenses(page)
      setEditId(null)
      setToast({ type: 'success', message: 'Expense updated' })
    } catch (err: any) {
      setToast({ type: 'error', message: err?.message || 'Failed to update' })
    }
  }

  const confirmDelete = async () => {
    if (!deleteId) return
    try {
      await hospitalApi.deleteAmbulanceExpense(deleteId)
      loadExpenses(page)
      setDeleteId(null)
      setToast({ type: 'success', message: 'Expense deleted' })
    } catch (err: any) {
      setToast({ type: 'error', message: err?.message || 'Failed to delete' })
    }
  }

  const exportCSV = () => {
    const header = ['Date', 'Ambulance', 'Category', 'Amount', 'Description', 'Receipt No']
    const lines = [header.join(',')]
    for (const e of expenses) {
      lines.push([e.date, e.vehicleNumber, e.category, e.amount, e.description || '', e.receiptNo || ''].join(','))
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `expenses-report-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const formatCurrency = (n: number) => new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(n)

  const categoryColors: Record<string, string> = {
    'Fuel': 'bg-amber-100 text-amber-700',
    'Maintenance': 'bg-sky-100 text-sky-700',
    'Repairs': 'bg-rose-100 text-rose-700',
    'Driver Allowance': 'bg-violet-100 text-violet-700',
    'Insurance': 'bg-emerald-100 text-emerald-700',
    'Registration': 'bg-slate-100 text-slate-700',
    'Other': 'bg-slate-100 text-slate-600',
  }

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-800">Expense Management</h2>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">Export CSV</button>
          <button onClick={() => setShowAdd(true)} className="rounded-md bg-sky-600 px-3 py-1.5 text-white hover:bg-sky-700">+ Add Expense</button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 md:col-span-2">
          <div className="text-sm text-rose-600">Total Expenses</div>
          <div className="text-2xl font-bold text-rose-700">{formatCurrency(summary.total)}</div>
        </div>
        {Object.entries(summary.byCategory).filter(([_, v]) => v > 0).slice(0, 4).map(([cat, amount]) => (
          <div key={cat} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-sm text-slate-500">{cat}</div>
            <div className="text-lg font-bold text-slate-800">{formatCurrency(amount)}</div>
          </div>
        ))}
      </div>

      {/* Category Breakdown */}
      <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-medium text-slate-700">By Category</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {Object.entries(summary.byCategory).map(([cat, amount]) => (
            <div key={cat} className={`rounded-full px-3 py-1 text-sm ${categoryColors[cat]}`}>
              {cat}: {formatCurrency(amount)}
            </div>
          ))}
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
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="">All Categories</option>
          {categories.map(c => (
            <option key={c} value={c}>{c}</option>
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
              <th className="px-3 py-2 font-medium text-slate-600">Category</th>
              <th className="px-3 py-2 font-medium text-slate-600 text-right">Amount</th>
              <th className="px-3 py-2 font-medium text-slate-600">Description</th>
              <th className="px-3 py-2 font-medium text-slate-600">Receipt</th>
              <th className="px-3 py-2 font-medium text-slate-600"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-500">Loading...</td></tr>
            ) : expenses.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-500">No expenses found</td></tr>
            ) : (
              expenses.map(e => (
              <tr key={e.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-2 text-slate-700">{e.date}</td>
                <td className="px-3 py-2 font-medium text-slate-800">{e.vehicleNumber}</td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${categoryColors[e.category]}`}>{e.category}</span>
                </td>
                <td className="px-3 py-2 text-right font-medium text-rose-600">{formatCurrency(e.amount)}</td>
                <td className="px-3 py-2 text-slate-500">{e.description || '-'}</td>
                <td className="px-3 py-2 text-slate-500">{e.receiptNo || '-'}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    <button onClick={() => { const exp = expenses.find(x => x.id === e.id); if (exp) setEditForm({ category: exp.category, amount: String(exp.amount), date: exp.date, description: exp.description || '', receiptNo: exp.receiptNo || '' }); setEditId(e.id) }} className="rounded p-1 text-slate-500 hover:bg-slate-100">✏️</button>
                    <button onClick={() => setDeleteId(e.id)} className="rounded p-1 text-slate-500 hover:bg-slate-100">🗑️</button>
                  </div>
                </td>
              </tr>
            )))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-300 bg-slate-50 font-medium">
              <td colSpan={3} className="px-3 py-2 text-slate-700">Total</td>
              <td className="px-3 py-2 text-right text-rose-700">{formatCurrency(summary.total)}</td>
              <td colSpan={3}></td>
            </tr>
          </tfoot>
        </table>
        <Pagination page={page} pages={pages} total={total} onPageChange={loadExpenses} />
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-800">Add Expense</h3>
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
                <label className="mb-1 block text-sm text-slate-700">Category *</label>
                <select value={addForm.category} onChange={e => setAddForm(f => ({ ...f, category: e.target.value as typeof categories[number] }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500">
                  {categories.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-700">Amount (PKR) *</label>
                <input type="number" step="0.01" value={addForm.amount} onChange={e => setAddForm(f => ({ ...f, amount: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-700">Date *</label>
                <input type="date" value={addForm.date} onChange={e => setAddForm(f => ({ ...f, date: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500" />
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-sm text-slate-700">Description</label>
                <input value={addForm.description} onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500" />
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-sm text-slate-700">Receipt No</label>
                <input value={addForm.receiptNo} onChange={e => setAddForm(f => ({ ...f, receiptNo: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500" />
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
              <h3 className="text-base font-semibold text-slate-800">Edit Expense</h3>
              <button onClick={() => setEditId(null)} className="text-slate-500">✖</button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm text-slate-700">Category *</label>
                <select value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value as typeof categories[number] }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500">
                  {categories.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-700">Amount (PKR) *</label>
                <input type="number" step="0.01" value={editForm.amount} onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-700">Date *</label>
                <input type="date" value={editForm.date} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500" />
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-sm text-slate-700">Description</label>
                <input value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500" />
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-sm text-slate-700">Receipt No</label>
                <input value={editForm.receiptNo} onChange={e => setEditForm(f => ({ ...f, receiptNo: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500" />
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
            <h3 className="text-base font-semibold text-slate-800">Delete Expense</h3>
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
