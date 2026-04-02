import { useEffect, useMemo, useState } from 'react'

import Toast, { type ToastState } from '../../components/ui/Toast'

import { receptionApi } from '../../utils/api'

import { fmtDateTime12, fmt12 } from '../../utils/timeFormat'

import {

  RefreshCw,

  Ticket,

  Stethoscope,

  Bed,

  FlaskConical,

  Microscope,

} from 'lucide-react'



function currency(n: number){

  return `Rs ${Number(n || 0).toFixed(2)}`

}



function escHtml(v: any){

  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as any)[c] || c)

}



function buildReportHtml({

  title,

  user,

  mode,

  shift,

  range,

  summary,

  tokens,

  labCarts,

  diagnosticCarts,

  erPayments,

  ipdPayments,

}: {

  title: string

  user: string

  mode: 'today' | 'shift'

  shift?: any

  range?: any

  summary?: any

  tokens: any[]

  labCarts: any[]

  diagnosticCarts: any[]

  erPayments: any[]

  ipdPayments: any[]

}){

  const now = new Date()

  const printedDate = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

  const printedTime = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

  const periodLabel = mode === 'today' ? 'Today' : 'Current Shift'

  const shiftLabel = shift ? `${shift.name}: ${fmt12(shift.start)}-${fmt12(shift.end)}` : '-'

  const rangeLabel = `${range?.start ? fmtDateTime12(range.start) : '-'} → ${range?.end ? fmtDateTime12(range.end) : '-'}`



  const table = (label: string, head: string[], bodyRows: string[][]) => {

    const th = head.map(h => `<th>${escHtml(h)}</th>`).join('')

    const rows = (bodyRows || []).map(r => `<tr>${r.map((c, i) => {

      const isMoney = /^(fee|discount|amount|pending|net|received)$/i.test(String(head[i] || '')) || String(c || '').trim().startsWith('Rs')

      return `<td class="${isMoney ? 'right' : ''}">${escHtml(c)}</td>`

    }).join('')}</tr>`).join('')

    const empty = `<tr><td class="empty" colspan="${head.length}">No rows</td></tr>`

    return `

      <div class="section">

        <div class="section-title">${escHtml(label)}</div>

        <table>

          <thead><tr>${th}</tr></thead>

          <tbody>${rows || empty}</tbody>

        </table>

      </div>

    `

  }



  const summaryNet = Number(summary?.net || 0)

  const netClass = summaryNet > 0 ? 'pos' : (summaryNet < 0 ? 'neg' : 'zero')

  const money = (n: any) => `Rs ${Number(n || 0).toFixed(2)}`



  return `<!doctype html>

  <html>

    <head>

      <meta charset="utf-8"/>

      <title>${escHtml(title)}</title>

      <style>

        @page { size: A4 portrait; margin: 10mm }

        *{ box-sizing:border-box }

        body{ font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; color:#0f172a; line-height:1.35; font-size:12px }

        .header{ border:1px solid #e2e8f0; border-radius:10px; padding:14px; margin-bottom:14px }

        .h1{ font-size:18px; font-weight:800; margin:0 0 6px 0 }

        .meta-grid{ display:grid; grid-template-columns: 1fr 1fr; gap:6px 12px }

        .meta{ color:#334155 }

        .meta b{ color:#0f172a }

        .net{ margin-top:10px; display:flex; align-items:baseline; justify-content:space-between; padding-top:10px; border-top:1px solid #e2e8f0 }

        .net .label{ color:#64748b; font-weight:600 }

        .net .value{ font-size:18px; font-weight:900 }

        .pos{ color:#059669 }

        .neg{ color:#dc2626 }

        .zero{ color:#334155 }

        .kpis{ margin-top:10px; display:grid; grid-template-columns: repeat(4, 1fr); gap:8px }

        .kpi{ border:1px solid #e2e8f0; border-radius:10px; padding:10px }

        .kpi .k{ color:#64748b; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.3px }

        .kpi .v{ margin-top:2px; font-size:14px; font-weight:800 }

        .kpi .s{ margin-top:2px; color:#64748b; font-size:11px }

        .section{ margin-top:12px; page-break-inside:avoid }

        .section-title{ font-size:12px; font-weight:800; background:#f1f5f9; border:1px solid #e2e8f0; padding:8px 10px; border-radius:10px; margin-bottom:6px }

        table{ width:100%; border-collapse:collapse; table-layout:fixed }

        th,td{ border:1px solid #e2e8f0; padding:6px 8px; vertical-align:top; word-wrap:break-word }

        th{ background:#f8fafc; font-weight:800; color:#334155 }

        td.right, th.right{ text-align:right }

        .empty{ text-align:center; color:#64748b; padding:10px }

        .footer{ margin-top:14px; color:#94a3b8; font-size:10px; text-align:center }

      </style>

    </head>

    <body>

      <div class="header">

        <div class="h1">${escHtml(title)}</div>

        <div class="meta-grid">

          <div class="meta"><b>Portal:</b> Reception</div>

          <div class="meta"><b>User:</b> ${escHtml(user)}</div>

          <div class="meta"><b>Period:</b> ${escHtml(periodLabel)}</div>

          <div class="meta"><b>Shift:</b> ${escHtml(shiftLabel)}</div>

          <div class="meta"><b>Range:</b> ${escHtml(rangeLabel)}</div>

          <div class="meta"><b>Printed:</b> ${escHtml(printedDate)} ${escHtml(printedTime)}</div>

        </div>

        <div class="net">

          <div class="label">Net Balance</div>

          <div class="value ${netClass}">${escHtml(money(summaryNet))}</div>

        </div>

        <div class="kpis">

          <div class="kpi"><div class="k">Tokens</div><div class="v">${escHtml(money(summary?.tokens?.revenue || 0))}</div><div class="s">Count: ${escHtml(summary?.tokens?.count ?? 0)} | Discount: ${escHtml(money(summary?.tokens?.discount || 0))}</div></div>

          <div class="kpi"><div class="k">ER Payments</div><div class="v">${escHtml(money(summary?.erPayments?.total || 0))}</div><div class="s">Count: ${escHtml(summary?.erPayments?.count ?? 0)}</div></div>

          <div class="kpi"><div class="k">IPD Payments</div><div class="v">${escHtml(money(summary?.ipdPayments?.total || 0))}</div><div class="s">Count: ${escHtml(summary?.ipdPayments?.count ?? 0)}</div></div>

          <div class="kpi"><div class="k">Carts</div><div class="v">${escHtml(money((summary?.labCarts?.total || 0) + (summary?.diagnosticCarts?.total || 0)))}</div><div class="s">Lab: ${escHtml(summary?.labCarts?.count ?? 0)} | Diagnostic: ${escHtml(summary?.diagnosticCarts?.count ?? 0)}</div></div>

        </div>

      </div>



      ${table(

        `Tokens (${(tokens || []).length})`,

        ['Date/Time', 'Token', 'MRN', 'Patient', 'Fee', 'Discount', 'Performed By', 'Portal'],

        (tokens || []).map((t: any) => [

          fmtDateTime12(t.createdAt || t.dateIso || new Date().toISOString()),

          String(t.tokenNo || '-'),

          String(t.mrn || '-'),

          String(t.patientName || '-'),

          money(t.fee || 0),

          money(t.discount || 0),

          String(t.createdByUsername || t.performedBy || '-'),

          String(t.portal || 'reception'),

        ])

      )}



      ${table(

        `Lab Cart (${(labCarts || []).length})`,

        ['Date/Time', 'Token', 'MRN', 'Patient', 'Subtotal', 'Discount', 'Net', 'Received', 'Pending', 'Status', 'Performed By', 'Portal'],

        (labCarts || []).map((o: any) => [

          fmtDateTime12(o.createdAt || new Date().toISOString()),

          String(o.tokenNo || '-'),

          String(o.patient?.mrn || '-'),

          String(o.patient?.fullName || '-'),

          money(o.subtotal || 0),

          money(o.discount || 0),

          money(o.net || 0),

          money(o.receivedAmount || 0),

          money(o.receivableAmount || 0),

          String(o.status || '-'),

          String(o.createdByUsername || '-'),

          String(o.portal || 'reception'),

        ])

      )}



      ${table(

        `Diagnostic Cart (${(diagnosticCarts || []).length})`,

        ['Date/Time', 'Token', 'MRN', 'Patient', 'Subtotal', 'Discount', 'Net', 'Received', 'Pending', 'Status', 'Performed By', 'Portal'],

        (diagnosticCarts || []).map((o: any) => [

          fmtDateTime12(o.createdAt || new Date().toISOString()),

          String(o.tokenNo || '-'),

          String(o.patient?.mrn || '-'),

          String(o.patient?.fullName || '-'),

          money(o.subtotal || 0),

          money(o.discount || 0),

          money(o.net || 0),

          money(o.receivedAmount || 0),

          money(o.receivableAmount || 0),

          String(o.status || '-'),

          String(o.createdByUsername || '-'),

          String(o.portal || 'reception'),

        ])

      )}



      ${table(

        `ER Payments (${(erPayments || []).length})`,

        ['Date/Time', 'Token', 'MRN', 'Patient', 'Method', 'Ref', 'Amount', 'Performed By', 'Portal'],

        (erPayments || []).map((p: any) => [

          fmtDateTime12(p.receivedAt || p.createdAt || new Date().toISOString()),

          String(p.tokenNo || p.tokenNoFromToken || p.tokenNoFromTags || '-'),

          String(p.mrn || p.patientMrn || '-'),

          String(p.patientName || p.patient || '-'),

          String(p.method || '-'),

          String(p.refNo || ''),

          money(p.amount || 0),

          String(p.createdByUsername || p.performedBy || '-'),

          String(p.portal || 'reception'),

        ])

      )}



      ${table(

        `IPD Payments (${(ipdPayments || []).length})`,

        ['Date/Time', 'Admission', 'MRN', 'Patient', 'Method', 'Ref', 'Amount', 'Pending', 'Performed By', 'Portal'],

        (ipdPayments || []).map((p: any) => [

          fmtDateTime12(p.receivedAt || p.createdAt || new Date().toISOString()),

          String(p.admissionNo || p.admission || '-'),

          String(p.mrn || p.patientMrn || '-'),

          String(p.patientName || p.patient || '-'),

          String(p.method || '-'),

          String(p.refNo || ''),

          money(p.amount || 0),

          money(p.pendingAmount || 0),

          String(p.createdByUsername || p.performedBy || '-'),

          String(p.portal || 'reception'),

        ])

      )}



      <div class="footer">Generated by HMS · Reception Portal</div>

    </body>

  </html>`

}



function SummaryCard({ icon: Icon, iconColor, iconBg, label, count, value, subValue }: any){

  return (

    <div className="rounded-lg border border-slate-200 bg-white p-3">

      <div className="flex items-center justify-between">

        <div className="flex items-center gap-2">

          <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${iconBg || 'bg-slate-50'}`}>

            <Icon className={`h-5 w-5 ${iconColor || 'text-slate-600'}`} />

          </div>

          <div>

            <div className="text-xs text-slate-500">{label}</div>

            <div className="text-sm font-semibold text-slate-800">{count}</div>

          </div>

        </div>

        <div className="text-right">

          <div className="text-sm font-semibold text-slate-800">{value}</div>

          {subValue ? <div className="text-[11px] text-slate-500">{subValue}</div> : null}

        </div>

      </div>

    </div>

  )

}



function SimpleTable({ head, rows }: any){

  return (

    <div className="overflow-x-auto rounded-lg border border-slate-200">

      <table className="min-w-full text-sm">

        <thead className="bg-slate-50">

          <tr>

            {head.map((h: any, i: number) => (

              <th key={i} className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold text-slate-600">{h}</th>

            ))}

          </tr>

        </thead>

        <tbody>

          {rows.length === 0 ? (

            <tr><td colSpan={head.length} className="px-3 py-3 text-slate-500">No data</td></tr>

          ) : rows.map((r: any[], idx: number) => (

            <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}>

              {r.map((c: any, j: number) => (

                <td key={j} className="whitespace-nowrap px-3 py-2 text-slate-700">{c}</td>

              ))}

            </tr>

          ))}

        </tbody>

      </table>

    </div>

  )

}



function Section({ title, icon: Icon, children }: any){

  return (

    <div className="rounded-xl border border-slate-200 bg-white">

      <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">

        {Icon ? <Icon className="h-4 w-4 text-slate-600" /> : null}

        <div className="text-sm font-semibold text-slate-800">{title}</div>

      </div>

      <div className="p-4">{children}</div>

    </div>

  )

}



export default function Reception_MyActivityReport(){

  const [mode, setMode] = useState<'today'|'shift'>('today')

  const [loading, setLoading] = useState(false)

  const [data, setData] = useState<any>(null)

  const [toast, setToast] = useState<ToastState>(null)



  async function load(){

    setLoading(true)

    try{

      const res: any = await receptionApi.myActivityReport({ mode })

      setData(res || null)

    }catch(e: any){

      setData(null)

      setToast({ type: 'error', message: e?.message || 'Failed to load report' })

    }finally{

      setLoading(false)

    }

  }



  useEffect(() => { load() }, [mode])



  const summary = data?.summary || {}

  const range = data?.range || {}

  const items = data?.items || {}

  const tokens = items?.tokens || []

  const erPayments = items?.erPayments || []

  const ipdPayments = items?.ipdPayments || []

  const labCarts = items?.labCarts || []

  const diagnosticCarts = items?.diagnosticCarts || []



  const netTone = useMemo(() => (Number(summary?.net || 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'), [summary?.net])



  async function downloadPdf(){

    try{

      if (!data) {

        setToast({ type: 'error', message: 'No data to export' })

        return

      }

      const htmlDoc = buildReportHtml({

        title: 'My Activity Report (Reception)',

        user: data?.user?.username || '-',

        mode,

        shift: data?.shift,

        range,

        summary,

        tokens,

        labCarts,

        diagnosticCarts,

        erPayments,

        ipdPayments,

      })

      if (!htmlDoc) {

        setToast({ type: 'error', message: 'Nothing to export' })

        return

      }



      const api = (window as any).electronAPI

      if (api && typeof api.printPreviewHtml === 'function'){

        const r = await api.printPreviewHtml(htmlDoc, { printBackground: true, marginsType: 0 })

        if (r && r.ok === false) {

          setToast({ type: 'error', message: r.error || 'Failed to generate PDF' })

          return

        }

        return

      }



      setToast({ type: 'error', message: 'PDF export is only available in the desktop app' })

    }catch(err: any){

      setToast({ type: 'error', message: err?.message || 'Failed to generate PDF' })

    }

  }



  return (

    <div className="space-y-4">

      <div className="rounded-xl border border-slate-200 bg-white">

        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">

          <div>

            <div className="text-base font-semibold text-slate-800">My Activity Report (Reception)</div>

            <div className="text-xs text-slate-500">

              {data?.user?.username ? <span className="font-medium text-slate-700">{data.user.username}</span> : null}

              {data?.user?.username && range?.start ? ' · ' : null}

              {range?.start ? fmtDateTime12(range.start) : '-'} → {range?.end ? fmtDateTime12(range.end) : '-'}

            </div>

          </div>

          <div className="flex items-center gap-2">

            <select value={mode} onChange={e => setMode(e.target.value as any)} className="rounded-md border border-slate-300 px-2 py-1 text-sm">

              <option value="today">Today</option>

              <option value="shift">Current Shift</option>

            </select>

            <button onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">

              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />

              Refresh

            </button>

            <button onClick={downloadPdf} disabled={!data || loading} className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 disabled:opacity-50">

              Export PDF

            </button>

          </div>

        </div>



        <div className="p-4">

          <div className={`rounded-xl p-4 mb-4 ${Number(summary?.net || 0) >= 0 ? 'bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100' : 'bg-gradient-to-r from-rose-50 to-red-50 border border-rose-100'}`}>

            <div className="flex items-start justify-between">

              <div>

                <div className="text-sm font-medium text-slate-600">Net Balance</div>

                <div className={`text-3xl font-bold mt-1 ${netTone}`}>{currency(summary?.net || 0)}</div>

                <div className="text-xs text-slate-500 mt-1">{range?.start ? fmtDateTime12(range.start) : '-'} → {range?.end ? fmtDateTime12(range.end) : '-'}</div>

              </div>

              <div className="text-xs font-medium text-slate-700 bg-white/60 px-2 py-1 rounded">

                {data?.user?.username || '-'}

              </div>

            </div>

          </div>



          <div className="grid gap-3 md:grid-cols-5">

            <SummaryCard icon={Ticket} iconColor="text-blue-600" iconBg="bg-blue-50" label="Tokens" count={summary?.tokens?.count ?? 0} value={currency(summary?.tokens?.revenue || 0)} subValue={`Discount: ${currency(summary?.tokens?.discount || 0)}`} />

            <SummaryCard icon={FlaskConical} iconColor="text-teal-600" iconBg="bg-teal-50" label="Lab Payments" count={summary?.labCarts?.count ?? 0} value={currency(summary?.labCarts?.total || 0)} subValue={`Received: ${currency(summary?.labCarts?.received || 0)}`} />

            <SummaryCard icon={Microscope} iconColor="text-indigo-600" iconBg="bg-indigo-50" label="Diagnostic Payments" count={summary?.diagnosticCarts?.count ?? 0} value={currency(summary?.diagnosticCarts?.total || 0)} subValue={`Received: ${currency(summary?.diagnosticCarts?.received || 0)}`} />

            <SummaryCard icon={Stethoscope} iconColor="text-amber-600" iconBg="bg-amber-50" label="ER Payments" count={summary?.erPayments?.count ?? 0} value={currency(summary?.erPayments?.total || 0)} />

            <SummaryCard icon={Bed} iconColor="text-purple-600" iconBg="bg-purple-50" label="IPD Payments" count={summary?.ipdPayments?.count ?? 0} value={currency(summary?.ipdPayments?.total || 0)} />

          </div>

        </div>

      </div>



      <div className="space-y-4">

        <Section title={`Tokens (${tokens.length})`} icon={Ticket}>

          <SimpleTable

            head={['Date/Time', 'Token', 'MRN', 'Patient', 'Fee', 'Discount', 'Performed By', 'Portal']}

            rows={tokens.map((t: any) => [

              fmtDateTime12(t.createdAt || t.dateIso || new Date().toISOString()),

              String(t.tokenNo || '-'),

              String(t.mrn || '-'),

              String(t.patientName || '-'),

              currency(Number(t.fee || 0)),

              currency(Number(t.discount || 0)),

              String(t.createdByUsername || t.performedBy || '-'),

              String(t.portal || 'reception'),

            ])}

          />

        </Section>



        <Section title={`Lab Cart (${labCarts.length})`} icon={Ticket}>

          <SimpleTable

            head={['Date/Time', 'Token', 'MRN', 'Patient', 'Subtotal', 'Discount', 'Net', 'Received', 'Pending', 'Status', 'Performed By', 'Portal']}

            rows={labCarts.map((o: any) => [

              fmtDateTime12(o.createdAt || new Date().toISOString()),

              String(o.tokenNo || '-'),

              String(o.patient?.mrn || '-'),

              String(o.patient?.fullName || '-'),

              currency(Number(o.subtotal || 0)),

              currency(Number(o.discount || 0)),

              currency(Number(o.net || 0)),

              currency(Number(o.receivedAmount || 0)),

              currency(Number(o.receivableAmount || 0)),

              String(o.status || '-'),

              String(o.createdByUsername || '-'),

              String(o.portal || 'reception'),

            ])}

          />

        </Section>



        <Section title={`Diagnostic Cart (${diagnosticCarts.length})`} icon={Ticket}>

          <SimpleTable

            head={['Date/Time', 'Token', 'MRN', 'Patient', 'Subtotal', 'Discount', 'Net', 'Received', 'Pending', 'Status', 'Performed By', 'Portal']}

            rows={diagnosticCarts.map((o: any) => [

              fmtDateTime12(o.createdAt || new Date().toISOString()),

              String(o.tokenNo || '-'),

              String(o.patient?.mrn || '-'),

              String(o.patient?.fullName || '-'),

              currency(Number(o.subtotal || 0)),

              currency(Number(o.discount || 0)),

              currency(Number(o.net || 0)),

              currency(Number(o.receivedAmount || 0)),

              currency(Number(o.receivableAmount || 0)),

              String(o.status || '-'),

              String(o.createdByUsername || '-'),

              String(o.portal || 'reception'),

            ])}

          />

        </Section>



        <Section title={`ER Payments (${erPayments.length})`} icon={Stethoscope}>

          <SimpleTable

            head={['Date/Time', 'Token', 'MRN', 'Patient', 'Method', 'Ref', 'Amount', 'Performed By', 'Portal']}

            rows={erPayments.map((p: any) => [

              fmtDateTime12(p.receivedAt || p.createdAt || new Date().toISOString()),

              String(p.tokenNo || p.tokenNoFromToken || p.tokenNoFromTags || '-'),

              String(p.mrn || p.patientMrn || '-'),

              String(p.patientName || p.patient || '-'),

              String(p.method || '-'),

              String(p.refNo || ''),

              currency(Number(p.amount || 0)),

              String(p.createdByUsername || p.performedBy || '-'),

              String(p.portal || 'reception'),

            ])}

          />

        </Section>



        <Section title={`IPD Payments (${ipdPayments.length})`} icon={Bed}>

          <SimpleTable

            head={['Date/Time', 'Admission', 'MRN', 'Patient', 'Method', 'Ref', 'Amount', 'Pending', 'Performed By', 'Portal']}

            rows={ipdPayments.map((p: any) => [

              fmtDateTime12(p.receivedAt || p.createdAt || new Date().toISOString()),

              String(p.admissionNo || p.admission || '-'),

              String(p.mrn || p.patientMrn || '-'),

              String(p.patientName || p.patient || '-'),

              String(p.method || '-'),

              String(p.refNo || ''),

              currency(Number(p.amount || 0)),

              currency(Number(p.pendingAmount || 0)),

              String(p.createdByUsername || p.performedBy || '-'),

              String(p.portal || 'reception'),

            ])}

          />

        </Section>

      </div>



      <Toast toast={toast} onClose={() => setToast(null)} />

    </div>

  )

}

