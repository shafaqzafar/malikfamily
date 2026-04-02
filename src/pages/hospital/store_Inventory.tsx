import { useEffect, useState } from 'react'
import { hospitalApi } from '../../utils/api'
import Toast, { type ToastState } from '../../components/ui/Toast'
import Pagination from '../../components/ui/Pagination'

type InventoryItem = {
  id: string
  name: string
  category: string
  categoryName?: string
  unit: string
  currentStock: number
  minStock: number
  avgCost: number
  stockValue: number
  batches: number
  earliestExpiry?: string
  lastPurchase?: string
  lastSupplier?: string
}

export default function Store_Inventory() {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [stockFilter, setStockFilter] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', category: '', unit: 'pcs', minStock: 0 })
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ name: '', category: '', unit: 'pcs', minStock: 0 })
  const [toast, setToast] = useState<ToastState>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)

  const categories = [
    { id: 'medicine', name: 'Medicine' },
    { id: 'surgical', name: 'Surgical' },
    { id: 'consumables', name: 'Consumables' },
    { id: 'lab', name: 'Lab Supplies' },
    { id: 'equipment', name: 'Equipment' },
    { id: 'general', name: 'General' },
  ]

  const loadItems = async (p = 1) => {
    setLoading(true)
    try {
      const res = await hospitalApi.listStoreInventory({
        category: categoryFilter || undefined,
        status: stockFilter || undefined,
        search: query || undefined,
        page: p,
        limit: 20,
      }) as any
      const inventory = (res.items || res.data || res || []).map((i: any) => ({
        id: String(i._id || i.id),
        name: i.name,
        category: i.category,
        categoryName: categories.find(c => c.id === i.category)?.name || i.category,
        unit: i.unit || 'pcs',
        currentStock: i.currentStock || 0,
        minStock: i.minStock || 0,
        avgCost: i.avgCost || 0,
        stockValue: (i.currentStock || 0) * (i.avgCost || 0),
        batches: i.batches || 0,
        earliestExpiry: i.earliestExpiry,
        lastPurchase: i.lastPurchase,
        lastSupplier: i.lastSupplier,
      })) as InventoryItem[]
      setItems(inventory)
      const pg = res.pagination || {}
      setPage(pg.page || 1)
      setPages(pg.pages || 1)
      setTotal(pg.total || 0)
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadItems(1)
  }, [categoryFilter, stockFilter])

  useEffect(() => {
    const timer = setTimeout(() => loadItems(1), 400)
    return () => clearTimeout(timer)
  }, [query])

  const formatCurrency = (n: number) => new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(n)

  const getStockStatus = (item: InventoryItem) => {
    if (item.currentStock === 0) return { label: 'Out of Stock', color: 'bg-rose-100 text-rose-700', badge: '🔴' }
    if (item.currentStock < item.minStock) return { label: 'Low Stock', color: 'bg-amber-100 text-amber-700', badge: '🟡' }
    return { label: 'In Stock', color: 'bg-emerald-100 text-emerald-700', badge: '🟢' }
  }

  const getExpiryStatus = (expiry?: string) => {
    if (!expiry) return null
    const today = new Date()
    const expDate = new Date(expiry)
    const daysUntil = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    if (daysUntil < 0) return { label: 'Expired', color: 'text-rose-600' }
    if (daysUntil <= 30) return { label: `${daysUntil}d left`, color: 'text-amber-600' }
    if (daysUntil <= 90) return { label: `${daysUntil}d left`, color: 'text-orange-500' }
    return { label: expiry.slice(5), color: 'text-slate-500' }
  }

  const saveAdd = async () => {
    if (!addForm.name.trim()) return
    try {
      await hospitalApi.createStoreItem(addForm)
      setToast({ type: 'success', message: 'Item created' })
      setShowAdd(false)
      setAddForm({ name: '', category: '', unit: 'pcs', minStock: 0 })
      // Reload
      const res = await hospitalApi.listStoreInventory() as any
      const inventory = (res.items || res.data || res || []).map((i: any) => ({
        id: String(i._id || i.id), name: i.name, category: i.category, unit: i.unit || 'pcs',
        currentStock: i.currentStock || 0, minStock: i.minStock || 0, avgCost: i.avgCost || 0,
        stockValue: (i.currentStock || 0) * (i.avgCost || 0), batches: i.batches || 0,
        earliestExpiry: i.earliestExpiry, lastSupplier: i.lastSupplier,
      })) as InventoryItem[]
      setItems(inventory)
    } catch (err: any) {
      setToast({ type: 'error', message: err?.message || 'Failed to create' })
    }
  }

  const saveEdit = async () => {
    if (!editId || !editForm.name.trim()) return
    try {
      await hospitalApi.updateStoreItem(editId, editForm)
      setItems(prev => prev.map(i => i.id === editId ? { ...i, ...editForm } : i))
      setEditId(null)
      setToast({ type: 'success', message: 'Item updated' })
    } catch (err: any) {
      setToast({ type: 'error', message: err?.message || 'Failed to update' })
    }
  }

  const totalValue = items.reduce((sum, i) => sum + i.stockValue, 0)

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-800">Inventory / Stock</h2>
        <div className="flex gap-2">
          <button onClick={() => setShowAdd(true)} className="rounded-md bg-sky-600 px-3 py-1.5 text-white hover:bg-sky-700">
            + Add Item
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <div className="text-sm text-slate-500">Total Items</div>
          <div className="text-xl font-bold text-slate-800">{total}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <div className="text-sm text-slate-500">Total Stock Value</div>
          <div className="text-xl font-bold text-emerald-600">{formatCurrency(totalValue)}</div>
        </div>
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3">
          <div className="text-sm text-rose-600">Out of Stock</div>
          <div className="text-xl font-bold text-rose-700">{items.filter(i => i.currentStock === 0).length}</div>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div className="text-sm text-amber-600">Low Stock</div>
          <div className="text-xl font-bold text-amber-700">{items.filter(i => i.currentStock > 0 && i.currentStock < i.minStock).length}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="mt-4 flex flex-wrap gap-3">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search items..."
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500"
        />
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={stockFilter} onChange={e => setStockFilter(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="">All Stock Levels</option>
          <option value="out">Out of Stock</option>
          <option value="low">Low Stock</option>
          <option value="ok">In Stock</option>
        </select>
      </div>

      {/* Table */}
      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left">
              <th className="px-3 py-2 font-medium text-slate-600">Item</th>
              <th className="px-3 py-2 font-medium text-slate-600">Category</th>
              <th className="px-3 py-2 font-medium text-slate-600 text-right">Stock</th>
              <th className="px-3 py-2 font-medium text-slate-600 text-right">Min</th>
              <th className="px-3 py-2 font-medium text-slate-600 text-right">Avg Cost</th>
              <th className="px-3 py-2 font-medium text-slate-600 text-right">Value</th>
              <th className="px-3 py-2 font-medium text-slate-600">Expiry</th>
              <th className="px-3 py-2 font-medium text-slate-600">Status</th>
              <th className="px-3 py-2 font-medium text-slate-600"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="px-3 py-8 text-center text-slate-500">Loading...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={9} className="px-3 py-8 text-center text-slate-500">No items found</td></tr>
            ) : (
              items.map(item => {
              const status = getStockStatus(item)
              const expiry = getExpiryStatus(item.earliestExpiry)
              return (
                <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-800">{item.name}</div>
                    {item.lastSupplier && <div className="text-xs text-slate-400">{item.lastSupplier}</div>}
                  </td>
                  <td className="px-3 py-2">
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{item.categoryName || item.category}</span>
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-slate-700">
                    {item.currentStock} <span className="text-xs text-slate-400">{item.unit}</span>
                  </td>
                  <td className="px-3 py-2 text-right text-slate-500">{item.minStock}</td>
                  <td className="px-3 py-2 text-right text-slate-600">{formatCurrency(item.avgCost)}</td>
                  <td className="px-3 py-2 text-right font-medium text-slate-700">{formatCurrency(item.stockValue)}</td>
                  <td className="px-3 py-2">
                    {expiry && <span className={`text-xs ${expiry.color}`}>{expiry.label}</span>}
                    {!expiry && <span className="text-xs text-slate-400">-</span>}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${status.color}`}>
                      {status.badge} {status.label}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => { setEditId(item.id); setEditForm({ name: item.name, category: item.category, unit: item.unit, minStock: item.minStock }) }}
                      className="rounded p-1 text-slate-500 hover:bg-slate-100"
                    >
                      ✏️
                    </button>
                  </td>
                </tr>
              )
            }))}
          </tbody>
        </table>
        <Pagination page={page} pages={pages} total={total} onPageChange={loadItems} />
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-800">Add Inventory Item</h3>
              <button onClick={() => setShowAdd(false)} className="text-slate-500">✖</button>
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-sm text-slate-700">Item Name *</label>
                <input value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-700">Category</label>
                <select value={addForm.category} onChange={e => setAddForm(f => ({ ...f, category: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500">
                  <option value="">Select category</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm text-slate-700">Unit</label>
                  <select value={addForm.unit} onChange={e => setAddForm(f => ({ ...f, unit: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500">
                    <option value="pcs">Pcs</option>
                    <option value="pack">Pack</option>
                    <option value="box">Box</option>
                    <option value="bottle">Bottle</option>
                    <option value="tube">Tube</option>
                    <option value="set">Set</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-700">Min Stock</label>
                  <input type="number" min="0" value={addForm.minStock} onChange={e => setAddForm(f => ({ ...f, minStock: Number(e.target.value) }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500" />
                </div>
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
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-800">Edit Item</h3>
              <button onClick={() => setEditId(null)} className="text-slate-500">✖</button>
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-sm text-slate-700">Item Name *</label>
                <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-700">Category</label>
                <select value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500">
                  <option value="">Select category</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm text-slate-700">Unit</label>
                  <select value={editForm.unit} onChange={e => setEditForm(f => ({ ...f, unit: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500">
                    <option value="pcs">Pcs</option>
                    <option value="pack">Pack</option>
                    <option value="box">Box</option>
                    <option value="bottle">Bottle</option>
                    <option value="tube">Tube</option>
                    <option value="set">Set</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-700">Min Stock</label>
                  <input type="number" min="0" value={editForm.minStock} onChange={e => setEditForm(f => ({ ...f, minStock: Number(e.target.value) }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500" />
                </div>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setEditId(null)} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">Cancel</button>
              <button onClick={saveEdit} className="rounded-md bg-violet-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-800">Save</button>
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  )
}
