import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

interface TokenRow {
  _id: string
  date: string
  time: string
  tokenNo: string
  mrNo: string
  patient: string
  phone?: string
  gender?: string
  age?: string
  sessionType: string
  shift: string
  machine?: string
  duration: string
  fee: number
  discount: number
  status: 'queued' | 'in-progress' | 'completed' | 'cancelled'
  createdAt?: string
}

export default function Dialysis_TokenHistory() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [page, setPage] = useState(1)

  const today = new Date().toISOString().slice(0, 10)
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const [shift, setShift] = useState<string>('All')
  const [sessionType, setSessionType] = useState<string>('All')
  const [rows, setRows] = useState<TokenRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => { load() }, [from, to])

  async function load() {
    setLoading(true)
    try {
      // TODO: Implement actual API call
      // Mock data for now
      const mockRows: TokenRow[] = [
        {
          _id: '1',
          date: today,
          time: '08:30 AM',
          tokenNo: 'D123456',
          mrNo: 'D001',
          patient: 'Ahmed Khan',
          phone: '03001234567',
          gender: 'Male',
          age: '45',
          sessionType: 'hemodialysis',
          shift: 'morning',
          machine: 'Machine 1',
          duration: '4',
          fee: 5000,
          discount: 0,
          status: 'completed',
          createdAt: new Date().toISOString(),
        },
        {
          _id: '2',
          date: today,
          time: '09:15 AM',
          tokenNo: 'D123457',
          mrNo: 'D002',
          patient: 'Fatima Ali',
          phone: '03009876543',
          gender: 'Female',
          age: '52',
          sessionType: 'hemodialysis',
          shift: 'morning',
          machine: 'Machine 2',
          duration: '4',
          fee: 5000,
          discount: 500,
          status: 'in-progress',
          createdAt: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          _id: '3',
          date: today,
          time: '02:00 PM',
          tokenNo: 'D123458',
          mrNo: 'D003',
          patient: 'Muhammad Hassan',
          phone: '03005551234',
          gender: 'Male',
          age: '38',
          sessionType: 'hemodialysis',
          shift: 'afternoon',
          machine: 'Machine 3',
          duration: '4',
          fee: 5000,
          discount: 0,
          status: 'queued',
          createdAt: new Date(Date.now() - 7200000).toISOString(),
        },
      ]
      setRows(mockRows)
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter(r => {
      if (shift !== 'All' && r.shift !== shift) return false
      if (sessionType !== 'All' && r.sessionType !== sessionType) return false
      if (!q) return true
      return [r.patient, r.mrNo, r.tokenNo, r.phone, r.machine, r.gender, r.age]
        .filter(Boolean)
        .some(v => String(v).toLowerCase().includes(q))
    })
  }, [query, shift, sessionType, rows])

  const totalTokens = filtered.length
  const totalRevenue = filtered.reduce((s, r) => s + (r.status !== 'cancelled' ? r.fee : 0), 0)
  const completedSessions = filtered.filter(r => r.status === 'completed').length
  const pendingSessions = filtered.filter(r => r.status === 'queued' || r.status === 'in-progress').length

  const startIdx = (page - 1) * rowsPerPage
  const pageRows = filtered.slice(startIdx, startIdx + rowsPerPage)
  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage))

  const exportCSV = () => {
    const header = ['Date', 'Time', 'Token #', 'MR #', 'Patient', 'Phone', 'Session Type', 'Shift', 'Machine', 'Duration', 'Fee', 'Discount', 'Status']
    const lines = [header.join(',')]
    for (const r of filtered) {
      const row = [
        r.date, r.time, r.tokenNo, r.mrNo, r.patient, r.phone || '',
        r.sessionType, r.shift, r.machine || '', `${r.duration}hrs`,
        r.fee.toString(), r.discount.toString(), r.status
      ].map(v => typeof v === 'string' && v.includes(',') ? `"${v.replace(/"/g, '""')}"` : String(v))
      lines.push(row.join(','))
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `dialysis-tokens-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function openEdit(r: TokenRow) {
    navigate(`/dialysis/token-generator?tokenId=${encodeURIComponent(r._id)}`)
  }

  return (
    <div className="min-h-[70dvh] rounded-xl bg-gradient-to-br from-teal-500/20 via-cyan-300/20 to-emerald-300/20 p-6">
      <div className="mx-auto w-full max-w-7xl rounded-xl bg-white p-6 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-slate-800">
            Token History
            <span className="ml-2 rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-medium text-teal-700">
              {filtered.length}
            </span>
          </h2>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <input
              type="date"
              value={from}
              onChange={e => { setFrom(e.target.value); setPage(1) }}
              className="rounded-md border border-slate-300 px-2 py-1.5"
            />
            <span className="text-slate-500">to</span>
            <input
              type="date"
              value={to}
              onChange={e => { setTo(e.target.value); setPage(1) }}
              className="rounded-md border border-slate-300 px-2 py-1.5"
            />
            <select
              value={shift}
              onChange={e => { setShift(e.target.value); setPage(1) }}
              className="rounded-md border border-slate-300 px-2 py-1.5"
            >
              <option value="All">All Shifts</option>
              <option value="morning">Morning</option>
              <option value="afternoon">Afternoon</option>
              <option value="evening">Evening</option>
            </select>
            <select
              value={sessionType}
              onChange={e => { setSessionType(e.target.value); setPage(1) }}
              className="rounded-md border border-slate-300 px-2 py-1.5"
            >
              <option value="All">All Types</option>
              <option value="hemodialysis">Hemodialysis</option>
              <option value="peritoneal">Peritoneal</option>
              <option value="sustained">SLED</option>
            </select>
            <button
              onClick={exportCSV}
              className="rounded-md border border-teal-300 px-4 py-1.5 font-medium text-teal-700 hover:bg-teal-50"
            >
              Export CSV
            </button>
          </div>
        </div>

        <div className="mt-4">
          <input
            value={query}
            onChange={e => { setQuery(e.target.value); setPage(1) }}
            placeholder="Search by name, token#, MR#, phone, machine..."
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
          />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard title="Date" value={from === to ? from : `${from} → ${to}`} tone="amber" />
          <StatCard title="Total Tokens" value={totalTokens} tone="teal" />
          <StatCard title="Revenue" value={`Rs. ${totalRevenue.toLocaleString()}`} tone="green" />
          <StatCard title="Completed" value={completedSessions} tone="cyan" />
          <StatCard title="Pending" value={pendingSessions} tone="amber" />
        </div>

        <div className="mt-6 overflow-hidden rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-gradient-to-r from-teal-500 to-cyan-500 text-white">
              <tr className="text-left">
                <Th>Date</Th>
                <Th>Time</Th>
                <Th>Token #</Th>
                <Th>MR #</Th>
                <Th>Patient</Th>
                <Th>Phone</Th>
                <Th>Session</Th>
                <Th>Shift</Th>
                <Th>Machine</Th>
                <Th>Duration</Th>
                <Th>Fee</Th>
                <Th>Discount</Th>
                <Th>Status</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white text-slate-700">
              {loading ? (
                <tr>
                  <td className="px-4 py-8 text-center text-slate-500" colSpan={14}>Loading...</td>
                </tr>
              ) : pageRows.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-slate-500" colSpan={14}>No tokens found</td>
                </tr>
              ) : (
                pageRows.map(r => (
                  <tr key={r._id} className={`hover:bg-slate-50 ${r.status === 'cancelled' ? 'bg-rose-50' : ''}`}>
                    <Td>{r.date}</Td>
                    <Td>{r.time}</Td>
                    <Td className="font-semibold text-teal-700">{r.tokenNo}</Td>
                    <Td>{r.mrNo}</Td>
                    <Td>
                      <div>
                        <div className="font-medium">{r.patient}</div>
                        <div className="text-xs text-slate-500">{r.age || '-'} / {r.gender || '-'}</div>
                      </div>
                    </Td>
                    <Td>{r.phone || '-'}</Td>
                    <Td>
                      <span className="inline-flex rounded bg-cyan-100 px-2 py-0.5 text-xs font-medium text-cyan-700 capitalize">
                        {r.sessionType}
                      </span>
                    </Td>
                    <Td className="capitalize">{r.shift}</Td>
                    <Td>{r.machine || '-'}</Td>
                    <Td>{r.duration} hrs</Td>
                    <Td>Rs. {r.fee.toLocaleString()}</Td>
                    <Td>{r.discount > 0 ? `Rs. ${r.discount.toLocaleString()}` : '-'}</Td>
                    <Td>
                      <StatusBadge status={r.status} />
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEdit(r)}
                          title="Edit"
                          className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => window.print()}
                          title="Print"
                          className="rounded-md bg-teal-100 px-2 py-1 text-xs font-medium text-teal-700 hover:bg-teal-200"
                        >
                          Print
                        </button>
                      </div>
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div className="flex items-center justify-between border-t border-slate-200 p-3 text-sm text-slate-700">
            <div className="flex items-center gap-2">
              <span>Rows per page</span>
              <select
                value={rowsPerPage}
                onChange={e => { setRowsPerPage(parseInt(e.target.value)); setPage(1) }}
                className="rounded-md border border-slate-300 px-2 py-1"
              >
                {[10, 20, 50].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div>Page {page} of {totalPages}</div>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="rounded-md border border-slate-300 px-3 py-1.5 disabled:opacity-50"
              >
                Prev
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className="rounded-md border border-slate-300 px-3 py-1.5 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Th({ children }: { children: ReactNode }) {
  return <th className="px-3 py-3 font-semibold">{children}</th>
}

function Td({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <td className={`px-3 py-2.5 ${className}`}>{children}</td>
}

function StatusBadge({ status }: { status: TokenRow['status'] }) {
  const styles: Record<string, string> = {
    queued: 'bg-slate-100 text-slate-700',
    'in-progress': 'bg-amber-100 text-amber-700',
    completed: 'bg-emerald-100 text-emerald-700',
    cancelled: 'bg-rose-100 text-rose-700',
  }
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${styles[status] || 'bg-slate-100 text-slate-700'}`}>
      {status.replace('-', ' ')}
    </span>
  )
}

function StatCard({ title, value, tone }: { title: string; value: ReactNode; tone: 'teal' | 'green' | 'amber' | 'cyan' }) {
  const tones: Record<string, string> = {
    teal: 'bg-teal-50 text-teal-700 border-teal-100',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    cyan: 'bg-cyan-50 text-cyan-700 border-cyan-100',
  }
  return (
    <div className={`rounded-xl border p-4 ${tones[tone]}`}>
      <div className="text-xs font-medium opacity-80">{title}</div>
      <div className="mt-1 text-lg font-bold">{value}</div>
    </div>
  )
}
