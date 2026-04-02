import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { hospitalApi } from '../../utils/api'
import Toast, { type ToastState } from '../../components/ui/Toast'
import Pagination from '../../components/ui/Pagination'

type Supplier = {
  id: string
  name: string
  company?: string
  phone?: string
  address?: string
  taxId?: string
  status: 'Active' | 'Inactive'
  totalPurchases: number
  paid: number
  outstanding: number
  lastOrder?: string
}

export default function Store_Suppliers() {
  const [items, setItems] = useState<Supplier[]>([])
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', company: '', phone: '', address: '', taxId: '', status: 'Active' as 'Active' | 'Inactive' })
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ name: '', company: '', phone: '', address: '', taxId: '', status: 'Active' as 'Active' | 'Inactive' })
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastState>(null)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  const loadItems = async (p = 1) => {
    setLoading(true)
    try {
      const res = await hospitalApi.listStoreSuppliers({ status: statusFilter || undefined, search: query || undefined, page: p, limit: 20 }) as any
      const suppliers = (res.suppliers || res.data || res || []).map((s: any) => ({
        id: String(s._id || s.id),
        name: s.name,
        company: s.company,
        phone: s.phone,
        address: s.address,
        taxId: s.taxId,
        status: s.status || 'Active',
        totalPurchases: s.totalPurchases || 0,
        paid: s.paid || 0,
        outstanding: (s.totalPurchases || 0) - (s.paid || 0),
        lastOrder: s.lastOrder,
      })) as Supplier[]
      setItems(suppliers)
      const pg = res.pagination || {}
      setPage(pg.page || 1)
      setPages(pg.pages || 1)
      setTotal(pg.total || suppliers.length)
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

  const formatCurrency = (n: number) => new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(n)

  const saveAdd = async () => {
    if (!addForm.name.trim()) return
    try {
      await hospitalApi.createStoreSupplier(addForm)
      loadItems(page)
      setShowAdd(false)
      setAddForm({ name: '', company: '', phone: '', address: '', taxId: '', status: 'Active' })
      setToast({ type: 'success', message: 'Supplier created' })
    } catch (err: any) {
      setToast({ type: 'error', message: err?.message || 'Failed to create' })
    }
  }

  const saveEdit = async () => {
    if (!editId || !editForm.name.trim()) return
    try {
      await hospitalApi.updateStoreSupplier(editId, editForm)
      setItems(prev => prev.map(s => s.id === editId ? { ...s, ...editForm } : s))
      setEditId(null)
      setToast({ type: 'success', message: 'Supplier updated' })
    } catch (err: any) {
      setToast({ type: 'error', message: err?.message || 'Failed to update' })
    }
  }

  const confirmDelete = async () => {
    if (!deleteId) return
    try {
      await hospitalApi.deleteStoreSupplier(deleteId)
      loadItems(page)
      setDeleteId(null)
      setToast({ type: 'success', message: 'Supplier deleted' })
    } catch (err: any) {
      setToast({ type: 'error', message: err?.message || 'Failed to delete' })
    }
  }

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-800">Suppliers / Vendors</h2>
        <button onClick={() => setShowAdd(true)} className="rounded-md bg-sky-600 px-3 py-1.5 text-white hover:bg-sky-700">
          + Add Supplier
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search suppliers..."
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
        />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="">All Status</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left">
              <th className="px-3 py-2 font-medium text-slate-600">Name</th>
              <th className="px-3 py-2 font-medium text-slate-600">Company</th>
              <th className="px-3 py-2 font-medium text-slate-600">Phone</th>
              <th className="px-3 py-2 font-medium text-slate-600">Status</th>
              <th className="px-3 py-2 font-medium text-slate-600 text-right">Total Purchases</th>
              <th className="px-3 py-2 font-medium text-slate-600 text-right">Paid</th>
              <th className="px-3 py-2 font-medium text-slate-600 text-right">Outstanding</th>
              <th className="px-3 py-2 font-medium text-slate-600">Last Order</th>
              <th className="px-3 py-2 font-medium text-slate-600"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="px-3 py-8 text-center text-slate-500">Loading...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={9} className="px-3 py-8 text-center text-slate-500">No suppliers found</td></tr>
            ) : (
              items.map(s => (
              <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-2">
                  <Link to={`/hospital/store/supplier-ledger/${s.id}`} className="font-medium text-sky-700 hover:underline">{s.name}</Link>
                </td>
                <td className="px-3 py-2 text-slate-600">{s.company || '-'}</td>
                <td className="px-3 py-2 text-slate-600">{s.phone || '-'}</td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${s.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                    {s.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-right text-slate-700">{formatCurrency(s.totalPurchases)}</td>
                <td className="px-3 py-2 text-right text-emerald-600">{formatCurrency(s.paid)}</td>
                <td className={`px-3 py-2 text-right font-medium ${s.outstanding > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                  {formatCurrency(s.outstanding)}
                </td>
                <td className="px-3 py-2 text-slate-500">{s.lastOrder || '-'}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    <button onClick={() => { setEditId(s.id); setEditForm({ name: s.name, company: s.company || '', phone: s.phone || '', address: s.address || '', taxId: s.taxId || '', status: s.status }) }} className="rounded p-1 text-slate-500 hover:bg-slate-100">✏️</button>
                    <button onClick={() => setDeleteId(s.id)} className="rounded p-1 text-slate-500 hover:bg-slate-100">🗑️</button>
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
              <h3 className="text-base font-semibold text-slate-800">Add Supplier</h3>
              <button onClick={() => setShowAdd(false)} className="text-slate-500">✖</button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="mb-1 block text-sm text-slate-700">Name *</label>
                <input value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-700">Company</label>
                <input value={addForm.company} onChange={e => setAddForm(f => ({ ...f, company: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-700">Phone</label>
                <input value={addForm.phone} onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500" />
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-sm text-slate-700">Address</label>
                <input value={addForm.address} onChange={e => setAddForm(f => ({ ...f, address: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-700">Tax ID (NTN)</label>
                <input value={addForm.taxId} onChange={e => setAddForm(f => ({ ...f, taxId: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-700">Status</label>
                <select value={addForm.status} onChange={e => setAddForm(f => ({ ...f, status: e.target.value as any }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500">
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
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
              <h3 className="text-base font-semibold text-slate-800">Edit Supplier</h3>
              <button onClick={() => setEditId(null)} className="text-slate-500">✖</button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="mb-1 block text-sm text-slate-700">Name *</label>
                <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-700">Company</label>
                <input value={editForm.company} onChange={e => setEditForm(f => ({ ...f, company: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-700">Phone</label>
                <input value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500" />
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-sm text-slate-700">Address</label>
                <input value={editForm.address} onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-700">Tax ID (NTN)</label>
                <input value={editForm.taxId} onChange={e => setEditForm(f => ({ ...f, taxId: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-700">Status</label>
                <select value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value as any }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500">
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
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
            <h3 className="text-base font-semibold text-slate-800">Delete Supplier</h3>
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
