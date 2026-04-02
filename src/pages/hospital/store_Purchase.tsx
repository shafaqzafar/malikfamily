import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { hospitalApi } from '../../utils/api'
import Toast, { type ToastState } from '../../components/ui/Toast'

type Supplier = { id: string; name: string; company?: string }
type Category = { id: string; name: string }

type PurchaseLine = {
  tempId: string
  itemId?: string
  itemName: string
  category?: string
  batchNo: string
  quantity: number
  unit: string
  purchaseCost: number
  mrp?: number
  expiry?: string
  subtotal: number
}

export default function Store_Purchase() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isViewMode = Boolean(id)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<ToastState>(null)

  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    invoiceNo: '',
    supplierId: '',
    supplierName: '',
    paymentMode: 'credit' as 'cash' | 'credit' | 'bank',
    notes: '',
  })

  const [lines, setLines] = useState<PurchaseLine[]>([
    { tempId: '1', itemName: '', batchNo: '', quantity: 1, unit: 'pcs', purchaseCost: 0, subtotal: 0 },
  ])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [supRes, catRes] = await Promise.all([
          hospitalApi.listStoreSuppliers() as any,
          hospitalApi.listStoreCategories() as any,
        ])
        if (!cancelled) {
          setSuppliers((supRes.suppliers || supRes.data || supRes || []).map((s: any) => ({
            id: String(s._id || s.id), name: s.name, company: s.company,
          })))
          setCategories((catRes.categories || catRes.data || catRes || []).map((c: any) => ({
            id: String(c._id || c.id), name: c.name,
          })))
        }
      } catch {
        // API not ready - show empty state
      }
    }
    
    async function loadPurchase() {
      if (!id) return
      try {
        const res = await hospitalApi.getStorePurchase(id) as any
        const p = res.purchase || res.data || res
        if (!cancelled && p) {
          setForm({
            date: p.date?.slice(0, 10) || '',
            invoiceNo: p.invoiceNo || '',
            supplierId: p.supplierId || '',
            supplierName: p.supplierName || '',
            paymentMode: p.paymentMode || 'credit',
            notes: p.notes || '',
          })
          setLines((p.items || []).map((item: any, idx: number) => ({
            tempId: String(idx + 1),
            itemName: item.itemName || '',
            category: item.category || '',
            batchNo: item.batchNo || '',
            quantity: item.quantity || 1,
            unit: item.unit || 'pcs',
            purchaseCost: item.purchaseCost || 0,
            mrp: item.mrp,
            expiry: item.expiry?.slice(0, 10),
            subtotal: (item.quantity || 1) * (item.purchaseCost || 0),
          })))
        }
      } catch (err: any) {
        setToast({ type: 'error', message: 'Failed to load purchase' })
      }
    }
    
    load()
    if (id) loadPurchase()
    return () => { cancelled = true }
  }, [id])

  const updateLine = (tempId: string, field: keyof PurchaseLine, value: any) => {
    setLines(prev => prev.map(l => {
      if (l.tempId !== tempId) return l
      const updated = { ...l, [field]: value }
      if (field === 'quantity' || field === 'purchaseCost') {
        updated.subtotal = Number(updated.quantity) * Number(updated.purchaseCost)
      }
      return updated
    }))
  }

  const addLine = () => {
    setLines(prev => [...prev, {
      tempId: Date.now().toString(),
      itemName: '',
      batchNo: '',
      quantity: 1,
      unit: 'pcs',
      purchaseCost: 0,
      subtotal: 0,
    }])
  }

  const removeLine = (tempId: string) => {
    if (lines.length > 1) {
      setLines(prev => prev.filter(l => l.tempId !== tempId))
    }
  }

  const totalAmount = lines.reduce((sum, l) => sum + l.subtotal, 0)

  const handleSubmit = async () => {
    if (!form.invoiceNo.trim()) {
      setToast({ type: 'error', message: 'Invoice number is required' })
      return
    }
    if (!form.supplierId) {
      setToast({ type: 'error', message: 'Supplier is required' })
      return
    }
    const validLines = lines.filter(l => l.itemName.trim() && l.quantity > 0 && l.purchaseCost > 0)
    if (validLines.length === 0) {
      setToast({ type: 'error', message: 'Add at least one valid item' })
      return
    }

    setLoading(true)
    try {
      await hospitalApi.createStorePurchase({
        date: form.date,
        invoiceNo: form.invoiceNo.trim(),
        supplierId: form.supplierId,
        supplierName: form.supplierName,
        paymentMode: form.paymentMode,
        notes: form.notes || undefined,
        items: validLines.map(l => ({
          itemName: l.itemName,
          category: l.category,
          batchNo: l.batchNo,
          quantity: l.quantity,
          unit: l.unit,
          purchaseCost: l.purchaseCost,
          mrp: l.mrp,
          expiry: l.expiry,
        })),
        totalAmount,
      })
      setToast({ type: 'success', message: 'Purchase recorded successfully' })
      setTimeout(() => navigate('/hospital/store/purchase-list'), 1000)
    } catch (err: any) {
      setToast({ type: 'error', message: err?.message || 'Failed to save' })
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (n: number) => new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(n)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-800">{isViewMode ? 'View Purchase' : 'Record Purchase'}</h2>
        <button onClick={() => navigate('/hospital/store/purchase-list')} className="text-sm text-sky-700 hover:underline">
          ← Back to List
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
            <label className="mb-1 block text-sm text-slate-700">Invoice No *</label>
            <input
              value={form.invoiceNo}
              onChange={e => setForm(f => ({ ...f, invoiceNo: e.target.value }))}
              placeholder="Supplier invoice number"
              disabled={isViewMode}
              className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 disabled:bg-slate-50 disabled:text-slate-600"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-700">Supplier *</label>
            <select
              value={form.supplierId}
              onChange={e => {
                const sup = suppliers.find(s => s.id === e.target.value)
                setForm(f => ({ ...f, supplierId: e.target.value, supplierName: sup?.name || '' }))
              }}
              disabled={isViewMode}
              className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 disabled:bg-slate-50 disabled:text-slate-600"
            >
              <option value="">Select supplier</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name} {s.company ? `(${s.company})` : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-700">Payment Mode</label>
            <select
              value={form.paymentMode}
              onChange={e => setForm(f => ({ ...f, paymentMode: e.target.value as any }))}
              disabled={isViewMode}
              className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 disabled:bg-slate-50 disabled:text-slate-600"
            >
              <option value="credit">Credit (Pay Later)</option>
              <option value="cash">Cash</option>
              <option value="bank">Bank Transfer</option>
            </select>
          </div>
        </div>

        {/* Items Table */}
        <div className="mt-6">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-slate-800">Items</h3>
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
                  <th className="px-2 py-2">Item Name</th>
                  <th className="px-2 py-2">Category</th>
                  <th className="px-2 py-2">Batch No</th>
                  <th className="px-2 py-2 w-20">Qty</th>
                  <th className="px-2 py-2 w-20">Unit</th>
                  <th className="px-2 py-2 w-28">Cost/Unit</th>
                  <th className="px-2 py-2 w-28">MRP</th>
                  <th className="px-2 py-2 w-28">Expiry</th>
                  <th className="px-2 py-2 text-right">Subtotal</th>
                  <th className="px-2 py-2 w-16"></th>
                </tr>
              </thead>
              <tbody>
                {lines.map(line => (
                  <tr key={line.tempId} className="border-b border-slate-100">
                    <td className="px-2 py-2">
                      <input
                        value={line.itemName}
                        onChange={e => updateLine(line.tempId, 'itemName', e.target.value)}
                        placeholder="Item name"
                        disabled={isViewMode}
                        className="w-full rounded border border-slate-200 px-2 py-1 text-sm outline-none focus:border-violet-500 disabled:bg-slate-50"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <select
                        value={line.category || ''}
                        onChange={e => updateLine(line.tempId, 'category', e.target.value)}
                        disabled={isViewMode}
                        className="rounded border border-slate-200 px-2 py-1 text-sm outline-none focus:border-violet-500 disabled:bg-slate-50"
                      >
                        <option value="">-</option>
                        {categories.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <input
                        value={line.batchNo}
                        onChange={e => updateLine(line.tempId, 'batchNo', e.target.value)}
                        placeholder="Batch"
                        disabled={isViewMode}
                        className="w-20 rounded border border-slate-200 px-2 py-1 text-sm outline-none focus:border-violet-500 disabled:bg-slate-50"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        min="1"
                        value={line.quantity}
                        onChange={e => updateLine(line.tempId, 'quantity', Number(e.target.value))}
                        disabled={isViewMode}
                        className="w-16 rounded border border-slate-200 px-2 py-1 text-sm outline-none focus:border-violet-500 disabled:bg-slate-50"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <select
                        value={line.unit}
                        onChange={e => updateLine(line.tempId, 'unit', e.target.value)}
                        disabled={isViewMode}
                        className="rounded border border-slate-200 px-2 py-1 text-sm outline-none focus:border-violet-500 disabled:bg-slate-50"
                      >
                        <option value="pcs">Pcs</option>
                        <option value="pack">Pack</option>
                        <option value="box">Box</option>
                        <option value="bottle">Bottle</option>
                        <option value="tube">Tube</option>
                        <option value="set">Set</option>
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.purchaseCost}
                        onChange={e => updateLine(line.tempId, 'purchaseCost', Number(e.target.value))}
                        disabled={isViewMode}
                        className="w-24 rounded border border-slate-200 px-2 py-1 text-sm outline-none focus:border-violet-500 disabled:bg-slate-50"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.mrp || ''}
                        onChange={e => updateLine(line.tempId, 'mrp', Number(e.target.value) || undefined)}
                        disabled={isViewMode}
                        className="w-24 rounded border border-slate-200 px-2 py-1 text-sm outline-none focus:border-violet-500 disabled:bg-slate-50"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="date"
                        value={line.expiry || ''}
                        onChange={e => updateLine(line.tempId, 'expiry', e.target.value || undefined)}
                        disabled={isViewMode}
                        className="w-28 rounded border border-slate-200 px-2 py-1 text-sm outline-none focus:border-violet-500 disabled:bg-slate-50"
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

        {/* Total & Notes */}
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm text-slate-700">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2}
              placeholder="Optional notes..."
              disabled={isViewMode}
              className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 disabled:bg-slate-50 disabled:text-slate-600"
            />
          </div>
          <div className="flex flex-col items-end justify-end">
            <div className="text-sm text-slate-600">Total Amount</div>
            <div className="text-3xl font-bold text-slate-800">{formatCurrency(totalAmount)}</div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={() => navigate('/hospital/store/purchase-list')}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50"
          >
            {isViewMode ? 'Back' : 'Cancel'}
          </button>
          {!isViewMode && (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Purchase'}
            </button>
          )}
        </div>
      </div>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  )
}
