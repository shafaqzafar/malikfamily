import { useEffect, useState } from 'react'
import { hospitalApi } from '../../utils/api'

type ExpenseInput = {
  date: string
  category: string
  note: string
  amount: string
  method: 'cash' | 'bank' | 'card'
  reference?: string
  department: string
}

type Props = {
  open: boolean
  onClose: () => void
  onSaved?: () => void
}

export default function Hospital_AddExpenseDialog({ open, onClose, onSaved }: Props) {
  const [departments, setDepartments] = useState<Array<{ _id: string; name: string }>>([])
  const [categories, setCategories] = useState<Array<{ _id: string; name: string }>>([])
  const [newDept, setNewDept] = useState('')
  const [newCat, setNewCat] = useState('')
  const [addingDept, setAddingDept] = useState(false)
  const [addingCat, setAddingCat] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<ExpenseInput>({
    date: new Date().toISOString().slice(0, 10),
    category: '',
    note: '',
    amount: '',
    method: 'cash',
    reference: '',
    department: '',
  })

  useEffect(() => {
    if (!open) return
    let cancelled = false
    ;(async () => {
      try {
        const [deptRes, catRes]: any[] = await Promise.all([
          hospitalApi.listExpenseDepartments(),
          hospitalApi.listExpenseCategories(),
        ])
        if (!cancelled) {
          const deptList = deptRes?.departments || []
          const catList = catRes?.categories || []
          setDepartments(deptList)
          setCategories(catList)
          setForm(f => ({
            ...f,
            department: f.department || deptList?.[0]?.name || '',
            category: f.category || catList?.[0]?.name || '',
          }))
        }
      } catch {
        if (!cancelled) {
          setDepartments([])
          setCategories([])
        }
      }
    })()
    return () => { cancelled = true }
  }, [open])

  if (!open) return null

  const canSave = !!form.date && !!form.department && !!form.category && parseFloat(form.amount || '0') > 0 && !saving

  const addDepartment = async () => {
    const name = newDept.trim()
    if (!name) return
    setAddingDept(true)
    try {
      const res: any = await hospitalApi.createExpenseDepartment(name)
      const added = res?.department
      if (added) {
        setDepartments(prev => [...prev, { _id: added._id, name: added.name }])
        setForm(f => ({ ...f, department: added.name }))
        setNewDept('')
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to add department')
    } finally {
      setAddingDept(false)
    }
  }

  const addCategory = async () => {
    const name = newCat.trim()
    if (!name) return
    setAddingCat(true)
    try {
      const res: any = await hospitalApi.createExpenseCategory(name)
      const added = res?.category
      if (added) {
        setCategories(prev => [...prev, { _id: added._id, name: added.name }])
        setForm(f => ({ ...f, category: added.name }))
        setNewCat('')
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to add category')
    } finally {
      setAddingCat(false)
    }
  }

  const save = async () => {
    if (!canSave) return
    const amt = parseFloat(form.amount || '0')
    if (!amt) return

    try {
      setSaving(true)
      const dept = departments.find(d => d.name === form.department)
      const cat = categories.find(c => c.name === form.category)

      // Get createdByUsername from localStorage
      let createdByUsername: string | undefined = undefined
      try {
        const sessRaw = localStorage.getItem('hospital.session')
        if (sessRaw) {
          const sess = JSON.parse(sessRaw)
          if (sess?.username) createdByUsername = String(sess.username)
        }
      } catch {}

      await hospitalApi.createExpense({
        dateIso: form.date,
        expenseDepartmentId: dept?._id,
        departmentName: dept?.name,
        category: cat?.name || form.category,
        expenseCategoryId: cat?._id,
        categoryName: cat?.name,
        amount: amt,
        note: form.note?.trim() || undefined,
        method: form.method,
        ref: form.reference?.trim() || undefined,
        createdByUsername,
      })
      try {
        window.dispatchEvent(new CustomEvent('hospital:expenses:refresh'))
      } catch {}
      onSaved?.()
      onClose()
    } catch (err: any) {
      alert(err?.message || 'Failed to save expense')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/5">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <div className="text-lg font-semibold text-slate-800">Add Expense</div>
          <button onClick={onClose} className="rounded-md p-2 text-slate-500 hover:bg-slate-100">×</button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Department with inline Add */}
            <div>
              <label className="mb-1 block text-sm text-slate-700">Department</label>
              <div className="flex gap-2">
                <select
                  value={form.department}
                  onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
                  className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  {departments.map(dep => (
                    <option key={dep._id} value={dep.name}>{dep.name}</option>
                  ))}
                </select>
              </div>
              <div className="mt-2 flex gap-2">
                <input
                  type="text"
                  value={newDept}
                  onChange={e => setNewDept(e.target.value)}
                  placeholder="Add new department..."
                  className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                />
                <button
                  onClick={addDepartment}
                  disabled={!newDept.trim() || addingDept}
                  className="rounded-md bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50"
                >
                  {addingDept ? '...' : 'Add'}
                </button>
              </div>
            </div>

            {/* Category with inline Add */}
            <div>
              <label className="mb-1 block text-sm text-slate-700">Category</label>
              <div className="flex gap-2">
                <select
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  {categories.map(cat => (
                    <option key={cat._id} value={cat.name}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div className="mt-2 flex gap-2">
                <input
                  type="text"
                  value={newCat}
                  onChange={e => setNewCat(e.target.value)}
                  placeholder="Add new category..."
                  className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                />
                <button
                  onClick={addCategory}
                  disabled={!newCat.trim() || addingCat}
                  className="rounded-md bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50"
                >
                  {addingCat ? '...' : 'Add'}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm text-slate-700">Date</label>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" required />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-700">Amount</label>
              <input type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="0.00" required />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-700">Payment Method</label>
              <select value={form.method} onChange={e => setForm(f => ({ ...f, method: e.target.value as any }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                <option>cash</option>
                <option>bank</option>
                <option>card</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm text-slate-700">Reference</label>
              <input value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="e.g., EXP-000045" />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm text-slate-700">Note</label>
              <textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} rows={3} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Optional" />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <button onClick={onClose} className="btn-outline-navy">Cancel</button>
          <button onClick={save} disabled={!canSave} className="btn disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Expense'}
          </button>
        </div>
      </div>
    </div>
  )
}
