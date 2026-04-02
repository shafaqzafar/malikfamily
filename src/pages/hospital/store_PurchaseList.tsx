import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { hospitalApi } from '../../utils/api'
import Pagination from '../../components/ui/Pagination'

type Purchase = {
  id: string
  date: string
  invoiceNo: string
  supplierId: string
  supplierName: string
  totalAmount: number
  paymentStatus: 'paid' | 'partial' | 'unpaid'
  itemCount: number
  createdAt: string
}

export default function Store_PurchaseList() {
  const [items, setItems] = useState<Purchase[]>([])
  const [query, setQuery] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)

  const loadItems = async (p = 1) => {
    setLoading(true)
    try {
      const res = await hospitalApi.listStorePurchases({
        from: from || undefined,
        to: to || undefined,
        search: query || undefined,
        page: p,
        limit: 20,
      }) as any
      const purchases = (res.purchases || res.data || res || []).map((p: any) => ({
        id: String(p._id || p.id),
        date: p.date,
        invoiceNo: p.invoiceNo,
        supplierId: p.supplierId,
        supplierName: p.supplierName || 'Unknown',
        totalAmount: p.totalAmount || 0,
        paymentStatus: p.paymentStatus || 'unpaid',
        itemCount: p.items?.length || 0,
        createdAt: p.createdAt,
      })) as Purchase[]
      setItems(purchases)
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
  }, [from, to, statusFilter])

  useEffect(() => {
    const timer = setTimeout(() => loadItems(1), 400)
    return () => clearTimeout(timer)
  }, [query])

  const formatCurrency = (n: number) => new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(n)

  const statusColors: Record<string, string> = {
    paid: 'bg-emerald-100 text-emerald-700',
    partial: 'bg-amber-100 text-amber-700',
    unpaid: 'bg-rose-100 text-rose-700',
  }

  const exportCSV = () => {
    const header = ['Date', 'Invoice No', 'Supplier', 'Amount', 'Status', 'Items']
    const lines = [header.join(',')]
    for (const p of items) {
      lines.push([p.date, p.invoiceNo, p.supplierName, p.totalAmount, p.paymentStatus, p.itemCount].join(','))
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `purchases-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-800">Purchase History</h2>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">
            Export CSV
          </button>
          <Link to="/hospital/store/purchase" className="rounded-md bg-sky-600 px-3 py-1.5 text-white hover:bg-sky-700">
            + New Purchase
          </Link>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <input
          type="date"
          value={from}
          onChange={e => setFrom(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          type="date"
          value={to}
          onChange={e => setTo(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">All Status</option>
          <option value="paid">Paid</option>
          <option value="partial">Partial</option>
          <option value="unpaid">Unpaid</option>
        </select>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search invoice or supplier..."
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500"
        />
      </div>

      {loading ? (
        <div className="mt-8 text-center text-slate-500">Loading...</div>
      ) : (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left">
                <th className="px-3 py-2 font-medium text-slate-600">Date</th>
                <th className="px-3 py-2 font-medium text-slate-600">Invoice No</th>
                <th className="px-3 py-2 font-medium text-slate-600">Supplier</th>
                <th className="px-3 py-2 font-medium text-slate-600">Items</th>
                <th className="px-3 py-2 font-medium text-slate-600 text-right">Amount</th>
                <th className="px-3 py-2 font-medium text-slate-600">Status</th>
                <th className="px-3 py-2 font-medium text-slate-600"></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-500">No purchases found</td></tr>
              ) : (
                items.map(p => (
                <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2 text-slate-700">{p.date}</td>
                  <td className="px-3 py-2 font-medium text-slate-800">{p.invoiceNo}</td>
                  <td className="px-3 py-2">
                    <Link to={`/hospital/store/supplier-ledger/${p.supplierId}`} className="text-sky-700 hover:underline">
                      {p.supplierName}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-slate-600">{p.itemCount} items</td>
                  <td className="px-3 py-2 text-right font-medium text-slate-700">{formatCurrency(p.totalAmount)}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${statusColors[p.paymentStatus]}`}>
                      {p.paymentStatus.charAt(0).toUpperCase() + p.paymentStatus.slice(1)}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <Link to={`/hospital/store/purchase/${p.id}`} className="text-sky-700 hover:underline text-xs">
                      View
                    </Link>
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
          <Pagination page={page} pages={pages} total={total} onPageChange={loadItems} />
        </div>
      )}
    </div>
  )
}
