import { useEffect, useState } from 'react'

const actions: string[] = [
  'login','logout',
  'token_generate','token_delete',
  'patient_add','patient_edit',
  'session_start','session_end','session_cancel',
  'machine_add','machine_edit','machine_maintenance',
  'user_add','user_edit','user_delete',
  'appointment_create','appointment_cancel',
]

type Row = { _id: string; actor?: string; action: string; label?: string; method?: string; path?: string; at: string; detail?: string }

export default function Dialysis_AuditLogs() {
  const today = new Date().toISOString().slice(0,10)
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const [action, setAction] = useState<string>('All')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [items, setItems] = useState<Row[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(false)

  const refresh = async (goToPage?: number) => {
    setLoading(true)
    try {
      // TODO: Implement actual API call
      // Mock data for now
      const mockItems: Row[] = [
        { _id: '1', actor: 'admin', action: 'login', at: new Date().toISOString(), detail: 'User logged in' },
        { _id: '2', actor: 'admin', action: 'token_generate', at: new Date(Date.now() - 3600000).toISOString(), detail: 'Token D123456 generated for patient Ahmed Khan' },
        { _id: '3', actor: 'nurse', action: 'session_start', at: new Date(Date.now() - 7200000).toISOString(), detail: 'Dialysis session started on Machine 1' },
      ]
      
      // Apply filters
      let filtered = mockItems
      if (action && action !== 'All') {
        filtered = filtered.filter(i => i.action === action)
      }
      if (search) {
        const q = search.toLowerCase()
        filtered = filtered.filter(i => 
          (i.actor || '').toLowerCase().includes(q) ||
          i.action.toLowerCase().includes(q) ||
          (i.detail || '').toLowerCase().includes(q)
        )
      }
      
      setItems(filtered)
      setTotal(filtered.length)
      setTotalPages(Math.max(1, Math.ceil(filtered.length / limit)))
      if (goToPage != null) setPage(goToPage)
    } catch {
      setItems([]); setTotal(0); setTotalPages(1)
    } finally {
      setLoading(false)
    }
  }

  useEffect(()=>{ refresh(1) }, [])

  const exportCSV = () => {
    const header = ['Time','Actor','Action','Details']
    const lines = [header.join(',')]
    for (const e of items) {
      const row = [new Date(e.at).toLocaleString(), e.actor||'', e.action||'', e.detail||'']
        .map(v => typeof v === 'string' && v.includes(',') ? `"${v.replace(/"/g,'""')}"` : String(v))
      lines.push(row.join(','))
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `dialysis-audit-${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const canPrev = page > 1
  const canNext = page < totalPages
  const showingFrom = (page - 1) * limit + 1
  const showingTo = Math.min(page * limit, total)

  return (
    <div className="min-h-[70dvh] rounded-xl bg-gradient-to-br from-teal-500/20 via-cyan-300/20 to-emerald-300/20 p-6">
      <div className="mx-auto w-full max-w-6xl rounded-xl bg-white p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800">Audit Logs</h2>
          <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${loading? 'border-slate-200 bg-white text-slate-600':'border-teal-200 bg-teal-50 text-teal-700'}`}>
            <span className={`h-2 w-2 rounded-full ${loading? 'bg-slate-400 animate-pulse':'bg-teal-500'}`} />
            {loading? 'Loading…' : `${total} log${total===1?'':'s'}`}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1.5" />
          <span className="text-slate-500">to</span>
          <input type="date" value={to} onChange={e=>setTo(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1.5" />
          <select value={action} onChange={e=>setAction(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1.5">
            <option value="All">All Actions</option>
            {actions.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <button onClick={()=>refresh(1)} className="rounded-md bg-teal-600 px-4 py-1.5 font-medium text-white hover:bg-teal-700">Apply</button>
          <div className="ml-auto flex items-center gap-2">
            <label className="text-slate-600">Rows</label>
            <select value={limit} onChange={e=>{ setLimit(Number(e.target.value)); setPage(1); setTimeout(()=>refresh(1)) }} className="rounded-md border border-slate-300 px-2 py-1.5">
              {[10,20,50].map(n=> <option key={n} value={n}>{n}</option>)}
            </select>
            <button onClick={exportCSV} className="rounded-md border border-teal-300 px-4 py-1.5 font-medium text-teal-700 hover:bg-teal-50">Export CSV</button>
          </div>
        </div>

        <div className="mt-3">
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search actor, action, details..." className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200" />
        </div>

        <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-gradient-to-r from-teal-500 to-cyan-500 text-white">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Time</th>
                <th className="px-4 py-3 text-left font-semibold">Actor</th>
                <th className="px-4 py-3 text-left font-semibold">Action</th>
                <th className="px-4 py-3 text-left font-semibold">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white text-slate-700">
              {items.map(e => (
                <tr key={e._id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 whitespace-nowrap">{new Date(e.at).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-2">
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-teal-100 text-xs font-semibold text-teal-700">
                        {(e.actor||'U').slice(0,2).toUpperCase()}
                      </span>
                      {e.actor || '-'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                      {e.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{e.detail || e.label || e.path || ''}</td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td className="px-4 py-8 text-center text-slate-500" colSpan={4}>{loading ? 'Loading...' : 'No logs found'}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between text-sm text-slate-700">
          <div>
            Showing {total ? showingFrom : 0}-{total ? showingTo : 0} of {total}
          </div>
          <div className="flex items-center gap-2">
            <button disabled={!canPrev} onClick={()=> refresh(page - 1)} className={`rounded-md border px-4 py-1.5 font-medium ${canPrev? 'border-slate-300 hover:bg-slate-50' : 'opacity-50 cursor-not-allowed border-slate-200'}`}>Prev</button>
            <span className="px-2">Page {page} / {totalPages}</span>
            <button disabled={!canNext} onClick={()=> refresh(page + 1)} className={`rounded-md border px-4 py-1.5 font-medium ${canNext? 'border-slate-300 hover:bg-slate-50' : 'opacity-50 cursor-not-allowed border-slate-200'}`}>Next</button>
          </div>
        </div>
      </div>
    </div>
  )
}
