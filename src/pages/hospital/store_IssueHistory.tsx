import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { hospitalApi } from '../../utils/api'
import Pagination from '../../components/ui/Pagination'

type Issue = {
  id: string
  date: string
  departmentId: string
  departmentName: string
  issuedTo?: string
  itemCount: number
  totalAmount: number
  createdAt: string
}

export default function Store_IssueHistory() {
  const [items, setItems] = useState<Issue[]>([])
  const [query, setQuery] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)

  const departments = [
    { id: '1', name: 'OPD' },
    { id: '2', name: 'ICU' },
    { id: '3', name: 'OT' },
    { id: '4', name: 'Pharmacy' },
    { id: '5', name: 'Ward A' },
    { id: '6', name: 'Lab' },
  ]

  const loadItems = async (p = 1) => {
    setLoading(true)
    try {
      const res = await hospitalApi.listStoreIssues({
        from: from || undefined,
        to: to || undefined,
        departmentId: departmentFilter || undefined,
        search: query || undefined,
        page: p,
        limit: 20,
      }) as any
      const issues = (res.issues || res.data || res || []).map((i: any) => ({
        id: String(i._id || i.id),
        date: i.date,
        departmentId: i.departmentId,
        departmentName: i.departmentName || 'Unknown',
        issuedTo: i.issuedTo,
        itemCount: i.items?.length || 0,
        totalAmount: i.totalAmount || 0,
        createdAt: i.createdAt,
      })) as Issue[]
      setItems(issues)
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
  }, [from, to, departmentFilter])

  useEffect(() => {
    const timer = setTimeout(() => loadItems(1), 400)
    return () => clearTimeout(timer)
  }, [query])

  const formatCurrency = (n: number) => new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(n)

  const exportCSV = () => {
    const header = ['Date', 'Department', 'Issued To', 'Items', 'Amount']
    const lines = [header.join(',')]
    for (const i of items) {
      lines.push([i.date, i.departmentName, i.issuedTo || '', i.itemCount, i.totalAmount].join(','))
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `issues-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-800">Issue History</h2>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">
            Export CSV
          </button>
          <Link to="/hospital/store/issues" className="rounded-md bg-emerald-600 px-3 py-1.5 text-white hover:bg-emerald-700">
            + New Issue
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
          value={departmentFilter}
          onChange={e => setDepartmentFilter(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">All Departments</option>
          {departments.map(d => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search..."
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
                <th className="px-3 py-2 font-medium text-slate-600">Department</th>
                <th className="px-3 py-2 font-medium text-slate-600">Issued To</th>
                <th className="px-3 py-2 font-medium text-slate-600">Items</th>
                <th className="px-3 py-2 font-medium text-slate-600 text-right">Value</th>
                <th className="px-3 py-2 font-medium text-slate-600"></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500">No issues found</td></tr>
              ) : (
                items.map(issue => (
                <tr key={issue.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2 text-slate-700">{issue.date}</td>
                  <td className="px-3 py-2 font-medium text-slate-800">{issue.departmentName}</td>
                  <td className="px-3 py-2 text-slate-600">{issue.issuedTo || '-'}</td>
                  <td className="px-3 py-2 text-slate-600">{issue.itemCount} items</td>
                  <td className="px-3 py-2 text-right font-medium text-slate-700">{formatCurrency(issue.totalAmount)}</td>
                  <td className="px-3 py-2">
                    <Link to={`/hospital/store/issue/${issue.id}`} className="text-sky-700 hover:underline text-xs">
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
