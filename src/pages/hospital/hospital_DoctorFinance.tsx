import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Hospital_DoctorFinanceEntryDialog from '../../components/hospital/Hospital_DoctorFinanceEntryDialog'
import { financeApi, hospitalApi } from '../../utils/api'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import ConfirmDialog from '../../components/ui/ConfirmDialog'

type EntryType = 'OPD' | 'IPD' | 'Procedure' | 'Payout' | 'Adjustment'

type Doctor = {
  id: string
  name: string
  fee?: number
}

type Entry = {
  id: string
  datetime: string
  doctorId?: string
  doctorName: string
  type: EntryType
  patient?: string
  mrNumber?: string
  tokenId?: string
  tokenNo?: string
  description?: string
  gross?: number
  discount?: number
  method?: 'cash' | 'bank' | 'card' | 'transfer'
  ref?: string
}

function toCsv(rows: Entry[]) {
  const headers = ['id','datetime','doctorName','type','patient','mrNumber','tokenNo','gross','discount','payable','description']
  const body = rows.map(r => {
    const gross = Number(r.gross||0)
    const discount = Number(r.discount||0)
    const payable = Math.max(0, gross - discount)
    return [
      r.id,
      r.datetime,
      r.doctorName,
      r.type,
      r.patient||'',
      r.mrNumber||'',
      r.tokenNo||'',
      gross,
      discount,
      payable,
      r.description||''
    ]
  })
  return [headers, ...body].map(arr => arr.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
}

export default function Hospital_DoctorFinance() {
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [doctorId, setDoctorId] = useState<string>('All')
  const [ttype, setTtype] = useState<'All' | EntryType>('All')
  const [q, setQ] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [rowsPerPage, setRowsPerPage] = useState(50)
  const [tick, setTick] = useState(0)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  

  useEffect(() => {
    // Always fetch doctors from DB on first mount and when dialog opens
    if (!doctors.length || addOpen) { loadDoctors() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addOpen])

  async function loadDoctors(){
    try {
      const res: any = await hospitalApi.listDoctors()
      const items: any[] = (res?.doctors || res || []) as any[]
      const mapped: Doctor[] = items.map((d:any)=> ({ id: String(d._id||d.id), name: String(d.name||''), fee: Number(d.opdBaseFee||0) }))
      setDoctors(mapped)
    } catch {}
  }

  useEffect(() => { syncBackendEarnings() }, [tick])
  useEffect(() => { syncBackendEarnings() }, [from, to, doctorId])

  async function syncBackendEarnings(){
    try {
      const today = new Date().toISOString().slice(0,10)
      const useFrom = (from && from.length===10) ? from : today
      const useTo = (to && to.length===10) ? to : useFrom
      const params: any = { from: useFrom, to: useTo }
      if (doctorId && doctorId !== 'All') params.doctorId = doctorId
      const res: any = await financeApi.doctorEarnings(params)
      const items: any[] = res?.earnings || []
      if (!Array.isArray(items)) return
      const mapDoc = (id?: string)=> doctors.find(d=>d.id===id)?.name || 'Doctor'
      const newOnes: Entry[] = items.map((r:any)=> {
        const amount = Number(r.amount || 0)
        const grossFromApi = Number(r.gross)
        const useApiGross = Number.isFinite(grossFromApi) && grossFromApi > 0
        const gross = useApiGross ? grossFromApi : (amount !== 0 ? Math.abs(amount) : undefined)
        const discountFromApi = Number(r.discount)
        const discount = (Number.isFinite(discountFromApi) && discountFromApi > 0) ? discountFromApi : (gross != null ? 0 : undefined)
        const patientName = (r.patientName == null) ? undefined : String(r.patientName)
        const mrn = (r.mrn == null) ? undefined : String(r.mrn)
        // Use createdAt timestamp if available (for manual entries), otherwise use dateIso
        const datetime = r.createdAt ? String(r.createdAt) : `${r.dateIso}T00:00:00`
        return ({
        id: `be:${r.id}`,
        datetime,
        doctorId: r.doctorId,
        doctorName: mapDoc(r.doctorId),
        type: (r.type || 'OPD') as EntryType,
        tokenId: r.tokenId,
        tokenNo: r.tokenNo,
        patient: patientName,
        mrNumber: mrn,
        description: r.memo,
        gross,
        discount,
        ref: undefined,
      })
      })
      setEntries(newOnes)
    } catch {}
  }

  const filtered = useMemo(() => {
    const fromDate = from ? new Date(from) : null
    const toDate = to ? new Date(new Date(to).getTime() + 24*60*60*1000 - 1) : null
    return entries
      .filter(e => {
        if (doctorId !== 'All' && e.doctorId !== doctorId) return false
        if (ttype !== 'All' && String(e.type||'').toLowerCase() !== String(ttype).toLowerCase()) return false
        const dt = new Date(e.datetime)
        if (fromDate && dt < fromDate) return false
        if (toDate && dt > toDate) return false
        if (q) {
          const hay = `${e.doctorName} ${e.patient||''} ${e.mrNumber||''} ${e.tokenNo||''} ${e.tokenId||''} ${e.description||''}`.toLowerCase()
          if (!hay.includes(q.toLowerCase())) return false
        }
        return true
      })
      .sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime())
  }, [entries, from, to, doctorId, ttype, q])

  const summary = useMemo(() => {
    let gross = 0, discount = 0, payable = 0
    for (const e of filtered) {
      const g = Number(e.gross||0)
      const d = Number(e.discount||0)
      gross += g
      discount += d
      payable += Math.max(0, g - d)
    }
    return { gross, discount, payable }
  }, [filtered])

  const exportCsv = () => {
    const csv = toCsv(filtered)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `doctor_finance_${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const downloadPdf = () => {
    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const title = 'Doctors Finance Report'
    const dateRange = from || to ? `${from || to}${to ? ' to '+to : ''}` : new Date().toISOString().slice(0,10)
    const docName = doctorId==='All' ? 'All' : (doctors.find(d=>d.id===doctorId)?.name || '')
    pdf.setFont('helvetica','bold')
    pdf.setFontSize(14)
    pdf.text(title, pageWidth/2, 14, { align: 'center' })
    pdf.setFont('helvetica','normal')
    pdf.setFontSize(10)
    pdf.text(`Date: ${dateRange}`, pageWidth/2, 20, { align: 'center' })
    pdf.text(`Doctor: ${docName}`, pageWidth/2, 25, { align: 'center' })
    pdf.setFontSize(10)
    const sumLine = `Gross: Rs ${summary.gross.toFixed(2)}   Discount: Rs ${summary.discount.toFixed(2)}   Payable: Rs ${summary.payable.toFixed(2)}`
    pdf.text(sumLine, pageWidth/2, 31, { align: 'center' })
    const headers = ['Date','Patient','MR #','Token #','Type','Gross','Discount','Payable']
    const body = filtered.map(e => {
      const gross = Number(e.gross||0)
      const discount = Number(e.discount||0)
      const payable = Math.max(0, gross - discount)
      return [
        new Date(e.datetime).toLocaleDateString(),
        e.patient || '-',
        e.mrNumber || '-',
        e.tokenNo || '-',
        e.type,
        gross.toFixed(2),
        discount.toFixed(2),
        payable.toFixed(2)
      ]
    })
    autoTable(pdf, {
      head: [headers],
      body,
      startY: 36,
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [248,249,251], textColor: 0, halign: 'left' },
      columnStyles: { 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' } }
    })
    pdf.save(`doctor_finance_${new Date().toISOString().slice(0,10)}.pdf`)
  }

  return (
    <div className="w-full px-6 py-8 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-2xl font-bold text-slate-800">Doctors Finance</div>
          <div className="text-sm text-slate-500">OPD visits, IPD rounds, procedures, and payouts</div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={()=>{ setTick(t=>t+1); syncBackendEarnings() }} className="btn-outline-navy">Refresh</button>
          <button onClick={downloadPdf} className="btn-outline-navy">Download PDF</button>
          <button onClick={exportCsv} className="btn-outline-navy">Export CSV</button>
          <button onClick={()=>setAddOpen(true)} className="btn">+ Add Entry</button>
        </div>
      </div>

      {/* Filters moved to the top (apply to entire page) */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid items-end gap-3 md:grid-cols-7">
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm text-slate-700">Doctor</label>
            <select value={doctorId} onChange={e=>setDoctorId(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="All">All</option>
              {doctors.map(d => (<option key={d.id} value={d.id}>{d.name}</option>))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-700">Type</label>
            <select value={ttype} onChange={e=>setTtype(e.target.value as any)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option>All</option>
              <option>OPD</option>
              <option>IPD</option>
              <option>Procedure</option>
              <option>Payout</option>
              <option>Adjustment</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-700">From</label>
            <input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-700">To</label>
            <input type="date" value={to} onChange={e=>setTo(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm text-slate-700">Search</label>
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="doctor, patient, MR#, ref" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryCard title="Gross (Tokens)" amount={summary.gross} tone="violet" />
        <SummaryCard title="Discount" amount={summary.discount} tone="sky" />
        <SummaryCard title="Payable" amount={summary.payable} tone="emerald" />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3 font-medium text-slate-800">Entries</div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="px-4 py-2 font-medium">Date/Time</th>
                <th className="px-4 py-2 font-medium">Doctor</th>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Patient</th>
                <th className="px-4 py-2 font-medium">MR Number</th>
                <th className="px-4 py-2 font-medium">Token Number</th>
                <th className="px-4 py-2 font-medium">Gross</th>
                <th className="px-4 py-2 font-medium">Discount</th>
                <th className="px-4 py-2 font-medium">Payable</th>
                <th className="px-4 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {filtered.slice(0, rowsPerPage).map(e => (
                <tr key={e.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-2">{new Date(e.datetime).toLocaleString()}</td>
                  <td className="px-4 py-2">{e.doctorName}</td>
                  <td className="px-4 py-2">{e.type}</td>
                  <td className="px-4 py-2">{e.patient || '-'}</td>
                  <td className="px-4 py-2">{e.mrNumber || '-'}</td>
                  <td className="px-4 py-2">{e.tokenNo || '-'}</td>
                  <td className="px-4 py-2">{Number(e.gross||0).toFixed(2)}</td>
                  <td className="px-4 py-2">{Number(e.discount||0).toFixed(2)}</td>
                  <td className="px-4 py-2">{(Math.max(0, Number(e.gross||0) - Number(e.discount||0))).toFixed(2)}</td>
                  <td className="px-4 py-2">
                    <div className="flex gap-2">
                      <button onClick={()=>startEdit()} className="rounded-md border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50">Edit</button>
                      <button onClick={()=>deleteEntry(e.id)} className="rounded-md border border-rose-200 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">No entries</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
          <div>Showing {Math.min(rowsPerPage, filtered.length)} of {filtered.length}</div>
          <div className="flex items-center gap-2">
            <label>Rows</label>
            <select value={rowsPerPage} onChange={e=>setRowsPerPage(parseInt(e.target.value))} className="rounded-md border border-slate-200 px-2 py-1">
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
          </div>
        </div>
      </div>

      {addOpen && (
        <Hospital_DoctorFinanceEntryDialog
          doctors={doctors}
          onClose={()=>setAddOpen(false)}
          onSave={async (e)=>{
            try {
              const memo = e.description || 'Manual entry'
              const amount = Math.abs(e.doctorAmount || 0)
              const dep = String((e as any).departmentName || '').toLowerCase()
              const revenueAccount = dep.includes('ipd') ? 'IPD_REVENUE' : (dep.includes('proc') ? 'PROCEDURE_REVENUE' : 'OPD_REVENUE')
              let createdByUsername: string | undefined = undefined
              try {
                const sessRaw = localStorage.getItem('hospital.session')
                if (sessRaw) {
                  const sess = JSON.parse(sessRaw)
                  if (sess?.username) createdByUsername = String(sess.username)
                }
              } catch {}
              await financeApi.manualDoctorEarning({ doctorId: e.doctorId || '', departmentId: undefined, departmentName: (e as any).departmentName, phone: (e as any).phone, amount, revenueAccount, paidMethod: 'AR', memo, sharePercent: 100, patientName: e.patient, mrn: e.mrNumber, createdByUsername })
              // Do NOT add a local row to avoid duplicates; fetch from backend instead
              await syncBackendEarnings()
              setTick(t=>t+1)
            } catch {}
            setAddOpen(false)
          }}
        />
      )}

      <div className="text-xs text-slate-500">Manage doctors in <Link to="/hospital/doctors" className="text-sky-700 hover:underline">Hospital → Doctors</Link></div>

      <ConfirmDialog
        open={!!confirmDeleteId}
        title="Confirm Delete"
        message="Delete this entry?"
        confirmText="Delete"
        onCancel={()=>setConfirmDeleteId(null)}
        onConfirm={confirmDelete}
      />
    </div>
  )

  function startEdit(){
    // Placeholder for future edit flow; opens add dialog prefilled if needed
    setAddOpen(true)
  }

  async function deleteEntry(id: string) {
    setConfirmDeleteId(id)
  }
  async function confirmDelete(){
    const id = confirmDeleteId
    setConfirmDeleteId(null)
    if (!id) return
    // If it's a backend-sourced journal, delete it server-side
    if (id.startsWith('be:')){
      const realId = id.slice(3)
      const entry = entries.find(e => e.id === id)
      // Manual entries can be hard-deleted, OPD tokens must be reversed
      if (entry && !entry.tokenId) {
        try { await financeApi.deleteManualEarning(realId) } catch {}
      } else {
        try { await financeApi.reverseJournal(realId, 'Reversed from Doctors Finance UI') } catch {}
      }
      await syncBackendEarnings()
    }
    setEntries(prev => prev.filter(e => e.id !== id))
  }
}

function SummaryCard({ title, amount, tone, subtitle }: { title: string; amount: number; tone: 'emerald'|'sky'|'violet'|'amber'; subtitle?: string }) {
  const toneMap: any = {
    emerald: 'text-emerald-700 bg-emerald-50',
    sky: 'text-sky-700 bg-sky-50',
    violet: 'text-violet-700 bg-violet-50',
    amber: 'text-amber-700 bg-amber-50',
  }
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-4`}>
      <div className="text-sm text-slate-600">{title}</div>
      <div className={`mt-1 text-xl font-semibold ${toneMap[tone] || ''} inline-block rounded px-2 py-1`}>Rs {amount.toFixed(2)}</div>
      {subtitle && <div className="mt-1 text-xs text-slate-500">{subtitle}</div>}
    </div>
  )
}
 

