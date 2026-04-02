import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { hospitalApi } from '../../../utils/api'
import ConfirmDialog from '../../../components/ui/ConfirmDialog'

function fmtDate(d?: string){
  if (!d) return ''
  const s = String(d)
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (m) return `${m[3]}/${m[2]}/${m[1]}`
  try { const x = new Date(s); if (!isNaN(x.getTime())){ const dd = String(x.getDate()).padStart(2,'0'); const mm = String(x.getMonth()+1).padStart(2,'0'); const yy = x.getFullYear(); return `${dd}/${mm}/${yy}` } } catch {}
  return s
}
function fmtTime(t?: string){
  if (!t) return ''
  const s = String(t)
  const m = s.match(/^(\d{1,2}):(\d{2})/)
  if (m){ let hh = parseInt(m[1],10); const mm = m[2]; const ap = hh>=12? 'PM':'AM'; hh = hh%12 || 12; return `${hh}:${mm} ${ap}` }
  try { const x = new Date(s); if (!isNaN(x.getTime())) return x.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) } catch {}
  return s
}
function fmtDateTime(d?: string, t?: string){
  const a = fmtDate(d)
  const b = fmtTime(t)
  return [a,b].filter(Boolean).join(' ')
}
function esc(s?:string){ return String(s??'').replace(/[&<>"']/g, c=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'} as any)[c]) }
function vRow(lbl?:string, val?:string){ return `<div style="display:grid;grid-template-columns:80px 1fr"><div style="padding:4px 6px;font-weight:700;border-right:1px solid #222;border-bottom:1px solid #222">${esc(lbl)}<\/div><div style="border-bottom:1px solid #222;padding:4px 6px">${esc(val)}<\/div><\/div>` }
function tRow(lbl?:string, val?:string){ return `<div style="display:grid;grid-template-columns:1fr 120px"><div style="border-right:1px solid #222;border-bottom:1px solid #222;padding:4px 6px">${esc(lbl)}<\/div><div style="border-bottom:1px solid #222;padding:4px 6px">${esc(val)}<\/div><\/div>` }

export default function Hospital_ShortStayList(){
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [total, setTotal] = useState(0)
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [encounterType, setEncounterType] = useState<string>('')

  useEffect(()=>{ load() }, [page, limit, encounterType])

  async function load(){
    setLoading(true)
    try {
      // Try list API
      const res: any = await hospitalApi.listIpdShortStays({ q, page, limit, encounterType: encounterType || undefined }).catch(()=>null)
      if (res && Array.isArray(res.results)){
        setRows(res.results)
        setTotal(res.total||res.results.length||0)
        return
      }
      // Fallback: scan discharged encounters and include those with a short-stay doc
      const encs: any = await hospitalApi.listIPDAdmissions({ status: 'discharged', q, page, limit }).catch(()=>null)
      const admissions = encs?.admissions||[]
      const mapped = await Promise.all(admissions.map(async (e: any)=>{
        try {
          const ss: any = await hospitalApi.getIpdShortStay(String(e._id)).catch(()=>null)
          if (ss?.shortStay){
            return {
              _id: ss.shortStay._id,
              encounterId: String(e._id),
              createdAt: ss.shortStay.createdAt || e.startAt,
              patientName: e.patientId?.fullName,
              mrn: e.patientId?.mrn,
              cnic: e.patientId?.cnicNormalized,
              phone: e.patientId?.phoneNormalized,
              department: e.departmentId?.name,
            }
          }
        } catch {}
        return null
      }))
      const rows = mapped.filter(Boolean) as any[]
      setRows(rows)
      setTotal(rows.length)
    } finally { setLoading(false) }
  }

  function sr(idx: number){ return (page-1)*limit + idx + 1 }

  async function onDelete(encounterId: string){
    setConfirmDeleteId(encounterId)
  }
  async function confirmDelete(){
    if (!confirmDeleteId) return
    try { await hospitalApi.deleteIpdShortStay(confirmDeleteId) } catch {}
    setConfirmDeleteId(null)
    load()
  }

  async function onPrint(formId: string){
    // Fetch data and settings - backend now supports looking up by form _id
    const [ss, settings, enc] = await Promise.all([
      hospitalApi.getIpdShortStay(formId).catch(()=>null),
      hospitalApi.getSettings().catch(()=>null),
      hospitalApi.getIPDAdmissionById(formId).catch(()=>null)
    ])
    
    const data = ss?.shortStay?.data || {}
    const F = data
    const S = settings || {}
    const patient = enc?.encounter?.patientId || {}
    
    // Build print HTML
    const style = `
      <style>@page{size:A4;margin:12mm}
      body{font-family:system-ui,Segoe UI,Arial,sans-serif;color:#111}
      .page{border:2px solid #222;padding:16px}
      .grid{display:grid;gap:8px;align-items:end}
      .line{border-bottom:1px solid #222;min-height:20px}
      .title{font-weight:900;text-align:center;margin:6px 0}
      .t{border:1px solid #222}
      .row2{display:grid;grid-template-columns:auto 1fr;gap:8px;align-items:end}
      .lbl{font-weight:700}
      .inline{display:inline-block;border-bottom:1px solid #222;min-height:0;padding:0 2px;width:max-content}
      </style>
    `
    const logo = S?.logoDataUrl ? `<img src="${S.logoDataUrl}" style="height:60px; object-fit:contain;" />` : ''
    const hdr = `
      <div style="display:grid; grid-template-columns:auto 1fr auto; align-items:center;">
        <div style="justify-self:start;">${logo}</div>
        <div style="text-align:center;">
          <div style="font-size:18px; font-weight:800;">${esc(S?.name||'')}</div>
          <div style="font-size:12px; color:#333;">${esc(S?.address||'')}</div>
          <div style="font-size:12px; color:#333;">${[S?.phone, S?.email].filter(Boolean).map(esc).join(' | ')}</div>
        </div>
        <div></div>
      </div>`
    const lv = (l:string, v?:string)=>`<div class="row2"><div class="lbl">${l}</div><div class="line">${esc(v)}</div></div>`
    const html = `<!doctype html><html><head><meta charset="utf-8"/>${style}</head><body>
      <div class="page">
        ${hdr}
        <div class="title">SHORT STAY FORM</div>
        <div class="grid" style="grid-template-columns:auto 1fr auto 160px auto 100px auto 100px;margin-top:8px"><div class="lbl">Patient's Name:</div><div class="line">${esc(F.patientName||patient?.fullName)}</div><div class="lbl">MR#</div><div class="line">${esc(F.mrn||patient?.mrn)}</div><div class="lbl">Age:</div><div class="line">${esc(F.age||patient?.age)}</div><div class="lbl">Sex:</div><div class="line">${esc(F.sex||patient?.gender)}</div></div>
        <div class="grid" style="grid-template-columns:auto 1fr auto 160px auto 160px;margin-top:8px"><div class="lbl">Address:</div><div class="line">${esc(F.address||patient?.address)}</div><div class="lbl">Date & Time in</div><div class="line">${esc(fmtDateTime(F.dateIn,F.timeIn))}</div><div class="lbl">Date & time out</div><div class="line">${esc(fmtDateTime(F.dateOut,F.timeOut))}</div></div>
        <div class="grid" style="grid-template-columns:auto 1fr auto 1fr auto 1fr;align-items:center;column-gap:10px;margin-top:8px"><div class="lbl">OPD ${F.isOpd?'☑':'☐'}</div><div></div><div class="lbl">Short Stay ${F.isShortStay?'☑':'☐'}</div><div></div><div class="lbl">Referred ${F.isReferred?'☑':'☐'}</div></div>
        ${lv('Admission to:', F.admissionTo)}${lv('Presenting Complains:', F.presentingComplaints)}${lv('Brief History:', F.briefHistory)}${lv('Any procedure:', F.anyProcedure)}
        <div class="grid" style="grid-template-columns:auto 1fr auto 200px;margin-top:8px"><div class="lbl">Final diagnosis:</div><div class="line">${esc(F.finalDiagnosis)}</div><div class="lbl">Consultant:</div><div class="line">${esc(F.consultant)}</div></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8px">
          <div class="t">${vRow('BP',F.vitals?.bp)}${vRow('HR',F.vitals?.hr)}${vRow('SPO2',F.vitals?.spo2)}${vRow('Temp',F.vitals?.temp)}${vRow('FHR',F.vitals?.fhr)}</div>
          <div class="t"><div style="display:grid;grid-template-columns:1fr 120px"><div style="border-right:1px solid #222;padding:4px 6px;font-weight:700;border-bottom:1px solid #222">Test</div><div style="padding:4px 6px;text-align:center;font-weight:700;border-bottom:1px solid #222">Results</div></div>${tRow('Hb',F.tests?.hb)}${tRow('Bilirubin D/Ind',F.tests?.bilirubin)}${tRow('BSR',F.tests?.bsr)}${tRow('Urea',F.tests?.urea)}${tRow('S,Creat',F.tests?.screat)}</div>
        </div>
        ${lv('Treatment Given at Hospital:', F.treatmentGiven)}${lv('Treatment at Discharge:', F.treatmentAtDischarge)}
        <div class="grid" style="grid-template-columns:auto 1fr auto 200px;margin-top:8px"><div class="lbl">Referred to / center name:</div><div class="line">${esc(F.referralCenter)}</div><div class="lbl">Contact No:</div><div class="line">${esc(F.referralContact)}</div></div>
        ${lv('Reason for referral:', F.referralReason)}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8px"><div class="t" style="padding:6px"><div style="font-weight:700;margin-bottom:6px">Condition at Discharge:</div><div>${['Satisfactory','Fair','Poor'].map(x=>`${F.conditionAtDischarge===x?'☑':'☐'} ${x}`).join('  ')}</div></div><div class="t" style="padding:6px"><div style="font-weight:700;margin-bottom:6px">Response of Treatment:</div><div>${['Excellent','Good','Average','Poor'].map(x=>`${F.responseOfTreatment===x?'☑':'☐'} ${x}`).join('  ')}</div></div></div>
        ${lv('Follow up Instructions:', F.followUpInstructions)}
        <div style="display:grid;grid-template-columns:1fr 320px;column-gap:10px;margin-top:10px">
          <div style="display:grid;grid-template-rows:auto auto;row-gap:6px">
            <div class="row2"><div class="lbl">Doctor Name:</div><div class="line">${esc(F.doctorName)}</div></div>
            <div style="display:flex;align-items:end;gap:4px"><div class="lbl">Stamp:</div><div class="line" style="width:110px"></div></div>
          </div>
          <div style="display:grid;grid-template-rows:auto auto;row-gap:6px">
            <div style="display:flex;align-items:end;gap:4px"><div class="lbl">Sign:</div><div class="line" style="width:130px"></div></div>
            <div style="display:flex;align-items:end;gap:8px"><div class="lbl">Date:</div><div class="inline">${esc(fmtDate(F.signDate))}</div><div class="lbl">Time:</div><div class="inline">${esc(fmtTime(F.signTime))}</div></div>
          </div>
        </div>
        <div style="text-align:right;margin-top:8px;font-size:12px">32</div>
      </div>
    </body></html>`
    
    // Use Electron print preview if available
    const api: any = (window as any).electronAPI
    try {
      if (api && typeof api.printPreviewHtml === 'function'){
        await api.printPreviewHtml(html, {})
        return
      }
    } catch {}
    
    // Fallback to browser window
    const w = window.open('', '_blank'); if (!w) return
    w.document.write(html); w.document.close(); w.focus(); w.print()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold text-slate-800">Short Stay Forms</div>
        <div className="flex items-center gap-2">
          <select className="border rounded-md px-2 py-1 text-sm" value={encounterType} onChange={e=>{ setEncounterType(e.target.value); setPage(1) }}>
            <option value="">All Departments</option>
            <option value="IPD">IPD</option>
            <option value="EMERGENCY">Emergency</option>
          </select>
          <input className="border rounded-md px-2 py-1 text-sm" placeholder="Search name / MRN / CNIC / phone / dept" value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>{ if (e.key==='Enter') { setPage(1); load() } }} />
          <button className="btn-outline-navy text-sm" onClick={()=>{ setPage(1); load() }} disabled={loading}>Search</button>
        </div>
      </div>

      <div className="overflow-auto border rounded-md">
        <table className="min-w-[800px] w-full">
          <thead>
            <tr className="bg-slate-100 text-left text-sm text-slate-700">
              <th className="px-3 py-2">Sr #</th>
              <th className="px-3 py-2">Patient</th>
              <th className="px-3 py-2">MRN</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Department</th>
              <th className="px-3 py-2">CNIC</th>
              <th className="px-3 py-2">Phone</th>
              <th className="px-3 py-2">Created</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {rows.map((r, i)=> (
              <tr key={r._id} className="border-t">
                <td className="px-3 py-2">{sr(i)}</td>
                <td className="px-3 py-2">{r.patientName||'-'}</td>
                <td className="px-3 py-2">{r.mrn||'-'}</td>
                <td className="px-3 py-2">{r.encounterType||'IPD'}</td>
                <td className="px-3 py-2">{r.department||'-'}</td>
                <td className="px-3 py-2">{r.cnic||'-'}</td>
                <td className="px-3 py-2">{r.phone||'-'}</td>
                <td className="px-3 py-2">{new Date(r.createdAt||r._id?.toString?.()).toLocaleString?.()||''}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-2">
                    <button className="btn-outline-navy text-xs" onClick={()=> navigate(`/hospital/ipd/admissions/${encodeURIComponent(r.encounterId)}/forms/short-stay`)}>Edit</button>
                    <button className="btn-outline-navy text-xs" onClick={()=> onPrint(String(r._id))}>Print</button>
                    <button className="btn-outline-navy text-xs" onClick={()=> onDelete(String(r.encounterId))}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length===0 && (
              <tr><td className="px-3 py-6 text-slate-500" colSpan={9}>{loading? 'Loading...':'No records found'}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-end gap-2 text-sm">
        <span>Rows:</span>
        <select className="border rounded px-2 py-1" value={limit} onChange={e=>{ setLimit(parseInt(e.target.value)||20); setPage(1) }}>
          {[10,20,50,100].map(n=> <option key={n} value={n}>{n}</option>)}
        </select>
        <span>Page {page} of {Math.max(1, Math.ceil(total/limit)||1)}</span>
        <button className="btn-outline-navy" disabled={page<=1} onClick={()=> setPage(p=>Math.max(1,p-1))}>Prev</button>
        <button className="btn-outline-navy" disabled={page>=Math.ceil(total/limit)} onClick={()=> setPage(p=>p+1)}>Next</button>
      </div>
      <ConfirmDialog
        open={!!confirmDeleteId}
        title="Confirm Delete"
        message="Delete this form?"
        confirmText="Delete"
        onCancel={()=>setConfirmDeleteId(null)}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
