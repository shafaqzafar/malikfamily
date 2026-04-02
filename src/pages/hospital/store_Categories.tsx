import { useEffect, useState } from 'react'
import { hospitalApi } from '../../utils/api'
import Toast, { type ToastState } from '../../components/ui/Toast'
import Pagination from '../../components/ui/Pagination'

type Category = {
  id: string
  name: string
  description?: string
  active: boolean
  itemCount?: number
}

export default function Store_Categories() {
  const [items, setItems] = useState<Category[]>([])
  const [query, setQuery] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', description: '', active: true })
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ name: '', description: '', active: true })
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastState>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)

  const loadItems = async (_p = 1) => {
    setLoading(true)
    try {
      const res = await hospitalApi.listStoreCategories() as any
      const categories = (res.categories || res.data || res || []).map((c: any) => ({
        id: String(c._id || c.id),
        name: c.name,
        description: c.description,
        active: c.active !== false,
        itemCount: c.itemCount || 0,
      })) as Category[]
      setItems(categories)
      const pg = res.pagination || {}
      setPage(pg.page || 1)
      setPages(pg.pages || 1)
      setTotal(pg.total || categories.length)
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadItems(1)
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => loadItems(1), 400)
    return () => clearTimeout(timer)
  }, [query])

  const saveAdd = async () => {
    if (!addForm.name.trim()) return
    try {
      await hospitalApi.createStoreCategory({ name: addForm.name.trim(), description: addForm.description || undefined, active: addForm.active })
      loadItems(page)
      setShowAdd(false)
      setAddForm({ name: '', description: '', active: true })
      setToast({ type: 'success', message: 'Category created' })
    } catch (err: any) {
      setToast({ type: 'error', message: err?.message || 'Failed to create' })
    }
  }

  const saveEdit = async () => {
    if (!editId || !editForm.name.trim()) return
    try {
      await hospitalApi.updateStoreCategory(editId, { name: editForm.name.trim(), description: editForm.description || undefined, active: editForm.active })
      loadItems(page)
      setEditId(null)
      setToast({ type: 'success', message: 'Category updated' })
    } catch (err: any) {
      setToast({ type: 'error', message: err?.message || 'Failed to update' })
    }
  }

  const confirmDelete = async () => {
    if (!deleteId) return
    try {
      await hospitalApi.deleteStoreCategory(deleteId)
      loadItems(page)
      setDeleteId(null)
      setToast({ type: 'success', message: 'Category deleted' })
    } catch (err: any) {
      setToast({ type: 'error', message: err?.message || 'Failed to delete' })
    }
  }

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-800">Item Categories</h2>
        <button onClick={() => setShowAdd(true)} className="rounded-md bg-sky-600 px-3 py-1.5 text-white hover:bg-sky-700">
          + Add Category
        </button>
      </div>

      <div className="mt-4">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search categories..."
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
        />
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="col-span-full py-8 text-center text-slate-500">Loading...</div>
        ) : items.length === 0 ? (
          <div className="col-span-full py-8 text-center text-slate-500">No categories found</div>
        ) : (
          items.map(cat => (
          <div key={cat.id} className={`rounded-xl border ${cat.active ? 'border-slate-200 bg-white' : 'border-slate-200 bg-slate-100'} p-4 shadow-sm`}>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg">📁</span>
                  <span className="font-semibold text-slate-800">{cat.name}</span>
                  {!cat.active && <span className="rounded bg-slate-300 px-1.5 text-xs text-slate-600">Inactive</span>}
                </div>
                {cat.description && <p className="mt-1 text-sm text-slate-500">{cat.description}</p>}
                <div className="mt-2 text-xs text-slate-400">{cat.itemCount} items</div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => { setEditId(cat.id); setEditForm({ name: cat.name, description: cat.description || '', active: cat.active }) }} className="rounded p-1 text-slate-500 hover:bg-slate-100">✏️</button>
                <button onClick={() => setDeleteId(cat.id)} className="rounded p-1 text-slate-500 hover:bg-slate-100">🗑️</button>
              </div>
            </div>
          </div>
        )))}
      </div>
      <Pagination page={page} pages={pages} total={total} onPageChange={loadItems} />

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-800">Add Category</h3>
              <button onClick={() => setShowAdd(false)} className="text-slate-500">✖</button>
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-sm text-slate-700">Name</label>
                <input value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-700">Description</label>
                <textarea value={addForm.description} onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))} rows={2} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500" />
              </div>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={addForm.active} onChange={e => setAddForm(f => ({ ...f, active: e.target.checked }))} className="rounded" />
                <span className="text-sm text-slate-700">Active</span>
              </label>
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
              <h3 className="text-base font-semibold text-slate-800">Edit Category</h3>
              <button onClick={() => setEditId(null)} className="text-slate-500">✖</button>
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-sm text-slate-700">Name</label>
                <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-700">Description</label>
                <textarea value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} rows={2} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500" />
              </div>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={editForm.active} onChange={e => setEditForm(f => ({ ...f, active: e.target.checked }))} className="rounded" />
                <span className="text-sm text-slate-700">Active</span>
              </label>
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
            <h3 className="text-base font-semibold text-slate-800">Delete Category</h3>
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
