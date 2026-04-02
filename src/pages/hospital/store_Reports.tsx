import { useEffect, useState } from 'react'
import { hospitalApi } from '../../utils/api'

type ReportType = 'stock' | 'department-usage' | 'expiry' | 'consumption' | 'supplier-purchases'

export default function Store_Reports() {
  const [activeReport, setActiveReport] = useState<ReportType>('stock')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const reportConfig: Record<ReportType, { title: string; description: string }> = {
    stock: { title: 'Current Stock Report', description: 'Complete inventory with stock levels and values' },
    'department-usage': { title: 'Department Usage Report', description: 'Items issued to each department' },
    expiry: { title: 'Expiry Report', description: 'Items nearing expiry or already expired' },
    consumption: { title: 'Monthly Consumption Report', description: 'Item consumption trends over time' },
    'supplier-purchases': { title: 'Supplier Purchase Report', description: 'Purchases grouped by supplier' },
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const res = await hospitalApi.getStoreReport(activeReport, { from, to }) as any
        if (!cancelled) {
          setData(res.data || res.items || res || [])
        }
      } catch {
        // API not ready - show empty state
        if (!cancelled) {
          setData([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [activeReport, from, to])

  const formatCurrency = (n: number) => new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(n)

  const exportCSV = () => {
    if (data.length === 0) return
    const headers = Object.keys(data[0])
    const lines = [headers.join(',')]
    for (const row of data) {
      lines.push(headers.map(h => row[h]).join(','))
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${activeReport}-report-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const renderTable = () => {
    if (loading) return <div className="py-8 text-center text-slate-500">Loading...</div>
    if (data.length === 0) return <div className="py-8 text-center text-slate-500">No data available</div>

    const headers = Object.keys(data[0])

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left">
              {headers.map(h => (
                <th key={h} className="px-3 py-2 font-medium text-slate-600 capitalize">
                  {h.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => (
              <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                {headers.map(h => (
                  <td key={h} className="px-3 py-2">
                    {typeof row[h] === 'number' && (h.includes('value') || h.includes('Value') || h.includes('paid') || h.includes('outstanding')) 
                      ? formatCurrency(row[h]) 
                      : row[h]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-800">Reports</h2>
        <button onClick={exportCSV} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">
          Export CSV
        </button>
      </div>

      {/* Report Type Tabs */}
      <div className="mt-4 flex flex-wrap gap-2">
        {(Object.entries(reportConfig) as [ReportType, { title: string; description: string }][]).map(([key, config]) => (
          <button
            key={key}
            onClick={() => setActiveReport(key)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              activeReport === key
                ? 'bg-sky-600 text-white'
                : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {config.title}
          </button>
        ))}
      </div>

      {/* Date Filters */}
      <div className="mt-4 flex gap-3">
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
        <button
          onClick={() => { setFrom(''); setTo('') }}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
        >
          Clear
        </button>
      </div>

      {/* Report Content */}
      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-slate-800">{reportConfig[activeReport].title}</h3>
          <p className="text-sm text-slate-500">{reportConfig[activeReport].description}</p>
        </div>
        {renderTable()}
      </div>
    </div>
  )
}
