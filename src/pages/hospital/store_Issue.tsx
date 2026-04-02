import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { hospitalApi } from '../../utils/api'
import Toast, { type ToastState } from '../../components/ui/Toast'

type Department = { id: string; name: string }
type InventoryItem = { id: string; name: string; currentStock: number; unit: string; avgCost: number }
type Batch = { id: string; batchNo: string; quantity: number; expiry?: string; purchaseCost: number }

type IssueLine = {
  tempId: string
  itemId: string
  itemName: string
  batchId: string
  batchNo: string
  quantity: number
  unit: string
  costPerUnit: number
  subtotal: number
  availableQty: number
}

export default function Store_Issue() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isViewMode = Boolean(id)
  const [departments, setDepartments] = useState<Department[]>([])
  const [items, setItems] = useState<InventoryItem[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<ToastState>(null)

  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    departmentId: '',
    departmentName: '',
    issuedTo: '',
    notes: '',
  })

  const [lines, setLines] = useState<IssueLine[]>([
    { tempId: '1', itemId: '', itemName: '', batchId: '', batchNo: '', quantity: 1, unit: 'pcs', costPerUnit: 0, subtotal: 0, availableQty: 0 },
  ])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [depRes, itemRes] = await Promise.all([
          hospitalApi.listDepartments() as any,
          hospitalApi.listStoreInventory() as any,
        ])
        if (!cancelled) {
          setDepartments((depRes.departments || depRes.data || depRes || []).map((d: any) => ({
            id: String(d._id || d.id), name: d.name,
          })))
          setItems((itemRes.items || itemRes.data || itemRes || []).filter((i: any) => i.currentStock > 0).map((i: any) => ({
            id: String(i._id || i.id), name: i.name, currentStock: i.currentStock, unit: i.unit || 'pcs', avgCost: i.avgCost || 0,
          })))
        }
      } catch {
        // API not ready - show empty state
      }
    }
    
    async function loadIssue() {
      if (!id) return
      try {
        const res = await hospitalApi.getStoreIssue(id) as any
        const issue = res.issue || res.data || res
        if (!cancelled && issue) {
          setForm({
            date: issue.date?.slice(0, 10) || '',
            departmentId: issue.departmentId || '',
            departmentName: issue.departmentName || '',
            issuedTo: issue.issuedTo || '',
            notes: issue.notes || '',
          })
          setLines((issue.items || []).map((item: any, idx: number) => ({
            tempId: String(idx + 1),
            itemId: item.itemId || '',
            itemName: item.itemName || '',
            batchId: item.batchId || '',
            batchNo: item.batchNo || '',
            quantity: item.quantity || 1,
            unit: item.unit || 'pcs',
            costPerUnit: item.costPerUnit || 0,
            subtotal: (item.quantity || 1) * (item.costPerUnit || 0),
            availableQty: item.quantity || 0,
          })))
        }
      } catch (err: any) {
        setToast({ type: 'error', message: 'Failed to load issue' })
      }
    }
    
    load()
    if (id) loadIssue()
    return () => { cancelled = true }
  }, [id])

  const loadBatchesForItem = async (itemId: string) => {
    try {
      const res = await hospitalApi.listStoreBatches(itemId) as any
      return (res.batches || res.data || res || []).map((b: any) => ({
        id: String(b._id || b.id),
        batchNo: b.batchNo,
        quantity: b.quantity,
        expiry: b.expiry,
        purchaseCost: b.purchaseCost,
      }))
    } catch {
        // API not ready - return empty
        return []
      }
  }

  const selectItem = async (tempId: string, itemId: string) => {
    const item = items.find(i => i.id === itemId)
    if (!item) return

    const itemBatches = await loadBatchesForItem(itemId)
    setBatches(prev => [...prev.filter(b => !b.id.startsWith('temp-')), ...itemBatches])

    // Auto-select first batch (FIFO)
    const firstBatch = itemBatches[0]
    setLines(prev => prev.map(l => {
      if (l.tempId !== tempId) return l
      return {
        ...l,
        itemId,
        itemName: item.name,
        unit: item.unit,
        batchId: firstBatch?.id || '',
        batchNo: firstBatch?.batchNo || '',
        costPerUnit: firstBatch?.purchaseCost || item.avgCost,
        availableQty: firstBatch?.quantity || item.currentStock,
        subtotal: l.quantity * (firstBatch?.purchaseCost || item.avgCost),
      }
    }))
  }

  const selectBatch = (tempId: string, batchId: string) => {
    const batch = batches.find(b => b.id === batchId)
    if (!batch) return

    setLines(prev => prev.map(l => {
      if (l.tempId !== tempId) return l
      return {
        ...l,
        batchId,
        batchNo: batch.batchNo,
        costPerUnit: batch.purchaseCost,
        availableQty: batch.quantity,
        subtotal: l.quantity * batch.purchaseCost,
      }
    }))
  }

  const updateLine = (tempId: string, field: keyof IssueLine, value: any) => {
    setLines(prev => prev.map(l => {
      if (l.tempId !== tempId) return l
      const updated = { ...l, [field]: value }
      if (field === 'quantity' || field === 'costPerUnit') {
        updated.subtotal = Number(updated.quantity) * Number(updated.costPerUnit)
      }
      return updated
    }))
  }

  const addLine = () => {
    setLines(prev => [...prev, {
      tempId: Date.now().toString(),
      itemId: '', itemName: '', batchId: '', batchNo: '',
      quantity: 1, unit: 'pcs', costPerUnit: 0, subtotal: 0, availableQty: 0,
    }])
  }

  const removeLine = (tempId: string) => {
    if (lines.length > 1) {
      setLines(prev => prev.filter(l => l.tempId !== tempId))
    }
  }

  const totalAmount = lines.reduce((sum, l) => sum + l.subtotal, 0)

  const handleSubmit = async () => {
    if (!form.departmentId) {
      setToast({ type: 'error', message: 'Department is required' })
      return
    }
    const validLines = lines.filter(l => l.itemId && l.batchId && l.quantity > 0)
    if (validLines.length === 0) {
      setToast({ type: 'error', message: 'Add at least one valid item' })
      return
    }
    // Check quantities
    for (const l of validLines) {
      if (l.quantity > l.availableQty) {
        setToast({ type: 'error', message: `Quantity for ${l.itemName} exceeds available stock` })
        return
      }
    }

    setLoading(true)
    try {
      await hospitalApi.createStoreIssue({
        date: form.date,
        departmentId: form.departmentId,
        departmentName: form.departmentName,
        issuedTo: form.issuedTo || undefined,
        notes: form.notes || undefined,
        items: validLines.map(l => ({
          itemId: l.itemId,
          itemName: l.itemName,
          batchId: l.batchId,
          batchNo: l.batchNo,
          quantity: l.quantity,
          unit: l.unit,
          costPerUnit: l.costPerUnit,
        })),
        totalAmount,
      })
      setToast({ type: 'success', message: 'Stock issued successfully' })
      setTimeout(() => navigate('/hospital/store/issue-history'), 1000)
    } catch (err: any) {
      setToast({ type: 'error', message: err?.message || 'Failed to issue' })
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (n: number) => new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(n)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-800">{isViewMode ? 'View Issue' : 'Issue Stock to Department'}</h2>
        <button onClick={() => navigate('/hospital/store/issue-history')} className="text-sm text-sky-700 hover:underline">
          ← Back to History
        </button>
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        {/* Header Info */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-sm text-slate-700">Date</label>
            <input
              type="date"
              value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              disabled={isViewMode}
              className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 disabled:bg-slate-50 disabled:text-slate-600"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-700">Department *</label>
            <select
              value={form.departmentId}
              onChange={e => {
                const dep = departments.find(d => d.id === e.target.value)
                setForm(f => ({ ...f, departmentId: e.target.value, departmentName: dep?.name || '' }))
              }}
              disabled={isViewMode}
              className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 disabled:bg-slate-50 disabled:text-slate-600"
            >
              <option value="">Select department</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-700">Issued To</label>
            <input
              value={form.issuedTo}
              onChange={e => setForm(f => ({ ...f, issuedTo: e.target.value }))}
              placeholder="Staff name (optional)"
              disabled={isViewMode}
              className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 disabled:bg-slate-50 disabled:text-slate-600"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-700">Notes</label>
            <input
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Optional notes"
              disabled={isViewMode}
              className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 disabled:bg-slate-50 disabled:text-slate-600"
            />
          </div>
        </div>

        {/* Items Table */}
        <div className="mt-6">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-slate-800">Items to Issue</h3>
            {!isViewMode && (
              <button onClick={addLine} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">
                + Add Item
              </button>
            )}
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-600">
                  <th className="px-2 py-2">Item</th>
                  <th className="px-2 py-2">Batch</th>
                  <th className="px-2 py-2">Available</th>
                  <th className="px-2 py-2 w-20">Qty</th>
                  <th className="px-2 py-2 w-20">Unit</th>
                  <th className="px-2 py-2 w-28">Cost/Unit</th>
                  <th className="px-2 py-2 text-right">Subtotal</th>
                  <th className="px-2 py-2 w-16"></th>
                </tr>
              </thead>
              <tbody>
                {lines.map(line => (
                  <tr key={line.tempId} className="border-b border-slate-100">
                    <td className="px-2 py-2">
                      <select
                        value={line.itemId}
                        onChange={e => selectItem(line.tempId, e.target.value)}
                        disabled={isViewMode}
                        className="w-full rounded border border-slate-200 px-2 py-1 text-sm outline-none focus:border-violet-500 disabled:bg-slate-50"
                      >
                        <option value="">Select item</option>
                        {items.map(i => (
                          <option key={i.id} value={i.id}>{i.name} ({i.currentStock} {i.unit})</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <select
                        value={line.batchId}
                        onChange={e => selectBatch(line.tempId, e.target.value)}
                        className="rounded border border-slate-200 px-2 py-1 text-sm outline-none focus:border-violet-500 disabled:bg-slate-50"
                        disabled={!line.itemId || isViewMode}
                      >
                        <option value="">Select batch</option>
                        {batches.filter(b => b.quantity > 0).map(b => (
                          <option key={b.id} value={b.id}>{b.batchNo} ({b.quantity} avail)</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2 text-slate-600">
                      {line.availableQty > 0 ? `${line.availableQty} ${line.unit}` : '-'}
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        min="1"
                        max={line.availableQty || undefined}
                        value={line.quantity}
                        onChange={e => updateLine(line.tempId, 'quantity', Number(e.target.value))}
                        disabled={isViewMode}
                        className="w-16 rounded border border-slate-200 px-2 py-1 text-sm outline-none focus:border-violet-500 disabled:bg-slate-50"
                      />
                    </td>
                    <td className="px-2 py-2 text-slate-600">{line.unit}</td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.costPerUnit}
                        onChange={e => updateLine(line.tempId, 'costPerUnit', Number(e.target.value))}
                        disabled={isViewMode}
                        className="w-24 rounded border border-slate-200 px-2 py-1 text-sm outline-none focus:border-violet-500 disabled:bg-slate-50"
                      />
                    </td>
                    <td className="px-2 py-2 text-right font-medium text-slate-700">
                      {formatCurrency(line.subtotal)}
                    </td>
                    <td className="px-2 py-2 text-center">
                      {!isViewMode && (
                        <button
                          onClick={() => removeLine(line.tempId)}
                          className="rounded p-1 text-rose-500 hover:bg-rose-50"
                          disabled={lines.length === 1}
                        >
                          🗑️
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Total */}
        <div className="mt-4 flex justify-end">
          <div className="text-right">
            <div className="text-sm text-slate-600">Total Value</div>
            <div className="text-3xl font-bold text-slate-800">{formatCurrency(totalAmount)}</div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={() => navigate('/hospital/store/issue-history')}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
          >
            {isViewMode ? 'Back' : 'Cancel'}
          </button>
          {!isViewMode && (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Issue Stock'}
            </button>
          )}
        </div>
      </div>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  )
}
