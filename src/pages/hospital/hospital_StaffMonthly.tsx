import { useEffect, useMemo, useState } from 'react'
import { hospitalApi } from '../../utils/api'
import Hospital_StaffReportDialog from '../../components/hospital/hospital_StaffReportDialog'

type Staff = { id: string; name: string; position?: string; shiftId?: string; salary?: number }
type Attendance = { id?: string; staffId: string; date: string; shiftId?: string; status: 'present'|'absent'|'leave'; clockIn?: string; clockOut?: string; notes?: string }
type Shift = { id: string; name: string; start?: string; end?: string }

function toMinutes(hm?: string){ if(!hm) return 0; const [h,m] = (hm||'').split(':').map(n=>parseInt(n||'0')); return (h*60 + m) }
function fmtHours(min: number){ const h = Math.floor(min/60); const m = Math.round(min%60); return `${h}h ${m}m` }
function nowTime(){ const d=new Date(); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}` }
function to12Hour(hm?: string){ if(!hm) return ''; const [h,m] = hm.split(':').map(n=>parseInt(n||'0')); const ampm = h >= 12 ? 'PM' : 'AM'; const h12 = h % 12 || 12; return `${h12}:${String(m).padStart(2,'0')} ${ampm}` }

export default function Hospital_StaffMonthly(){
  const [month, setMonth] = useState<string>(new Date().toISOString().slice(0,7))
  const [selectedStaffId, setSelectedStaffId] = useState<string>('')
  const [reportOpen, setReportOpen] = useState(false)
  const [showAllDays, setShowAllDays] = useState(false)

  const [staff, setStaff] = useState<Staff[]>([])
  const [att, setAtt] = useState<Attendance[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])

  useEffect(()=>{
    let mounted = true
    ;(async () => {
      try {
        const [staffRes, shiftRes] = await Promise.all([
          hospitalApi.listStaff(),
          hospitalApi.listShifts().catch(()=>({items:[]}))
        ])
        if (!mounted) return
        const raw: any[] = (staffRes?.staff || staffRes?.items || staffRes || [])
        const list = raw.map((x:any)=>({ id: x._id, name: x.name, position: x.position || x.role, shiftId: x.shiftId, salary: x.salary }))
        setStaff(list)
        setShifts((shiftRes?.items||[]).map((x:any)=>({ id: x._id, name: x.name, start: x.start, end: x.end })))
        if (!selectedStaffId && list[0]) setSelectedStaffId(list[0].id)
      } catch (e) { console.error(e) }
    })()
    return ()=>{ mounted = false }
  }, [])

  useEffect(()=>{
    let mounted = true
    ;(async () => {
      try {
        const from = `${month}-01`
        const to = new Date(Number(month.slice(0,4)), Number(month.slice(5,7)), 0)
        const toStr = `${to.getFullYear()}-${String(month.slice(5,7)).padStart(2,'0')}-${String(to.getDate()).padStart(2,'0')}`
        const res = await hospitalApi.listAttendance({ from, to: toStr, staffId: selectedStaffId || undefined, limit: 1000 })
        console.log('DEBUG StaffMonthly API:', { from, to: toStr, staffId: selectedStaffId, items: res?.items?.length, firstItem: res?.items?.[0] })
        if (!mounted) return
        const mapped = (res.items||[]).map((x:any)=>({ id: x._id || `${x.staffId}-${x.date}-${x.shiftId||''}`, staffId: String(x.staffId), date: x.date, shiftId: x.shiftId, status: x.status, clockIn: x.clockIn, clockOut: x.clockOut, notes: x.notes }))
        setAtt(mapped)
      } catch (e) { console.error(e) }
    })()
    return ()=>{ mounted = false }
  }, [month, selectedStaffId])

  const shiftById = useMemo(()=> Object.fromEntries(shifts.map(s => [s.id, s] as const)), [shifts])
  const shiftName = (id?: string) => {
    if (!id) return '—'
    const byId = shiftById[id]?.name
    if (byId) return byId
    const byName = shifts.find(s => String(s.name) === String(id))?.name
    return byName || String(id)
  }

  const days = useMemo(()=>{
    if (!selectedStaffId) return [] as Array<{ date:string; clockIn?:string; clockOut?:string; status:string; shiftId?:string }>
    console.log('DEBUG days useMemo - att length:', att.length, 'selectedStaffId:', selectedStaffId)
    console.log('DEBUG att records:', att.slice(0,5))
    const byDate: Record<string, { clockIn?:string; clockOut?:string; status:string; shiftId?:string }> = {}
    for (const a of att.filter(x=> String(x.staffId) === String(selectedStaffId))){
      const d = a.date
      if (!byDate[d]) byDate[d] = { status: a.status, clockIn: a.clockIn, clockOut: a.clockOut, shiftId: a.shiftId }
      else {
        const cur = byDate[d]
        if (a.clockIn && (!cur.clockIn || a.clockIn < cur.clockIn)) cur.clockIn = a.clockIn
        if (a.clockOut && (!cur.clockOut || a.clockOut > cur.clockOut)) cur.clockOut = a.clockOut
        if (a.status==='present') cur.status = 'present'
        if (a.shiftId) cur.shiftId = a.shiftId
      }
    }
    const [y,m] = month.split('-').map(n=>parseInt(n||'0'))
    const totalDays = new Date(y, m, 0).getDate()
    let list: Array<{ date:string; clockIn?:string; clockOut?:string; status:string; shiftId?:string }>
    if (showAllDays){
      list = []
      for (let d=1; d<=totalDays; d++){
        const date = `${month}-${String(d).padStart(2,'0')}`
        const rec = byDate[date]
        list.push({ date, clockIn: rec?.clockIn, clockOut: rec?.clockOut, status: rec?.status || (rec ? 'present' : 'absent'), shiftId: rec?.shiftId })
      }
    } else {
      list = Object.entries(byDate)
        .map(([date,v])=> ({ date, clockIn: v.clockIn, clockOut: v.clockOut, status: v.status || 'present', shiftId: v.shiftId }))
    }
    list.sort((a,b)=> (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    return list
  }, [att, selectedStaffId, month, showAllDays])

  const selectedStaff = useMemo(()=> staff.find(s=>s.id===selectedStaffId) || null, [staff, selectedStaffId])

  const saveQuick = async (date: string, type:'in'|'out') => {
    if (!selectedStaffId) return
    const dayRecs = att.filter(x=> String(x.staffId)===String(selectedStaffId) && x.date===date)
    const alreadyIn = dayRecs.some(r=> !!r.clockIn)
    const alreadyOut = dayRecs.some(r=> !!r.clockOut)
    if ((type==='in' && alreadyIn) || (type==='out' && alreadyOut)) return
    const payload: any = { staffId: selectedStaffId, date, status: 'present' }
    if (type==='in') payload.clockIn = nowTime(); else payload.clockOut = nowTime()
    await hospitalApi.upsertAttendance(payload)
    // refresh
    const to = new Date(Number(month.slice(0,4)), Number(month.slice(5,7)), 0)
    const toStr = `${to.getFullYear()}-${String(month.slice(5,7)).padStart(2,'0')}-${String(to.getDate()).padStart(2,'0')}`
    const res = await hospitalApi.listAttendance({ from: `${month}-01`, to: toStr, staffId: selectedStaffId })
    setAtt((res.items||[]).map((x:any)=>({ id: x._id || `${x.staffId}-${x.date}-${x.shiftId||''}`, staffId: String(x.staffId), date: x.date, shiftId: x.shiftId, status: x.status, clockIn: x.clockIn, clockOut: x.clockOut, notes: x.notes })))
  }

  const exportCsv = () => {
    const rowsCsv = [['Month','Staff','Date','Shift','Status','Clock In','Clock Out','Hours']]
    const [year, mon] = month.split('-').map(n=>parseInt(n||'0'))
    const totalDays = new Date(year, mon, 0).getDate()

    const byDate: Record<string, { clockIn?: string; clockOut?: string; status: string; shiftId?: string }> = {}
    for (const a of att.filter(x => String(x.staffId) === String(selectedStaffId))) {
      const d = a.date
      if (!byDate[d]) byDate[d] = { status: a.status, clockIn: a.clockIn, clockOut: a.clockOut, shiftId: a.shiftId }
      else {
        const cur = byDate[d]
        if (a.clockIn && (!cur.clockIn || a.clockIn < cur.clockIn)) cur.clockIn = a.clockIn
        if (a.clockOut && (!cur.clockOut || a.clockOut > cur.clockOut)) cur.clockOut = a.clockOut
        if (a.status === 'present') cur.status = 'present'
        if (a.shiftId) cur.shiftId = a.shiftId
      }
    }

    for (let d=1; d<=totalDays; d++){
      const date = `${month}-${String(d).padStart(2,'0')}`
      const rec = byDate[date]
      const status = rec?.status || 'absent'
      const shiftId = rec?.shiftId || selectedStaff?.shiftId
      const clockIn = rec?.clockIn
      const clockOut = rec?.clockOut
      const minutes = (status==='present' && clockIn && clockOut) ? Math.max(0, toMinutes(clockOut) - toMinutes(clockIn)) : 0
      rowsCsv.push([month, selectedStaff?.name||'', date, shiftName(shiftId), status, to12Hour(clockIn)||'', to12Hour(clockOut)||'', fmtHours(minutes)])
    }
    const csv = rowsCsv.map(r=> r.map(x=>`"${String(x).replace(/"/g,'""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `hospital_monthly_${month}_${selectedStaff?.name||''}.csv`; a.click(); URL.revokeObjectURL(a.href)
  }

  const [exportingAll, setExportingAll] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)

  const loadJsPDF = () => new Promise<any>((resolve, reject) => {
    const w: any = window as any
    if (w.jspdf && w.jspdf.jsPDF) return resolve(w.jspdf)
    const s = document.createElement('script')
    s.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js'
    s.onload = () => resolve((window as any).jspdf)
    s.onerror = reject
    document.head.appendChild(s)
  })

  const exportAllStaffPdf = async () => {
    if (!staff.length) return
    setExportingPdf(true)
    try {
      const from = `${month}-01`
      const to = new Date(Number(month.slice(0,4)), Number(month.slice(5,7)), 0)
      const toStr = `${to.getFullYear()}-${String(month.slice(5,7)).padStart(2,'0')}-${String(to.getDate()).padStart(2,'0')}`
      
      // Fetch all attendance for the month
      const res = await hospitalApi.listAttendance({ from, to: toStr, limit: 10000 })
      const allAtt = (res.items||[]).map((x:any)=>({
        staffId: String(x.staffId),
        date: x.date,
        status: x.status,
        clockIn: x.clockIn,
        clockOut: x.clockOut,
        shiftId: x.shiftId
      }))

      // Group by staff and date
      const byStaffDate: Record<string, Record<string, { clockIn?:string; clockOut?:string; status:string; shiftId?:string }>> = {}
      for (const a of allAtt) {
        if (!byStaffDate[a.staffId]) byStaffDate[a.staffId] = {}
        const byDate = byStaffDate[a.staffId]
        if (!byDate[a.date]) byDate[a.date] = { status: a.status, clockIn: a.clockIn, clockOut: a.clockOut, shiftId: a.shiftId }
        else {
          const cur = byDate[a.date]
          if (a.clockIn && (!cur.clockIn || a.clockIn < cur.clockIn)) cur.clockIn = a.clockIn
          if (a.clockOut && (!cur.clockOut || a.clockOut > cur.clockOut)) cur.clockOut = a.clockOut
          if (a.status === 'present') cur.status = 'present'
          if (a.shiftId) cur.shiftId = a.shiftId
        }
      }

      // Get total days in month
      const [year, mon] = month.split('-').map(n => parseInt(n || '0'))
      const totalDays = new Date(year, mon, 0).getDate()

      const jspdf = await loadJsPDF()
      const { jsPDF } = jspdf
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      const margin = 10
      const pageW = doc.internal.pageSize.getWidth()
      const pageH = doc.internal.pageSize.getHeight()

      const shiftStartMinutes = (id?: string) => {
        const s = id ? shiftById[id] : undefined
        return s?.start ? toMinutes(String(s.start)) : undefined
      }
      const isLate = (shiftId: string | undefined, clockIn: string | undefined) => {
        if (!clockIn) return false
        const start = shiftStartMinutes(shiftId)
        if (start === undefined) return false
        return toMinutes(clockIn) > start
      }

      const cols = [
        { title: 'Staff', width: 36 },
        { title: 'Date', width: 26 },
        { title: 'Shift', width: 28 },
        { title: 'Status', width: 20 },
        { title: 'Clock In', width: 22 },
        { title: 'Clock Out', width: 22 },
        { title: 'Hours', width: 18 },
      ] as const

      let yPos = margin + 10
      const drawHeader = (y0: number, isFirstPage: boolean) => {
        if (isFirstPage) {
          doc.setFont('times', 'normal')
          doc.setFontSize(16)
          doc.text('Staff Monthly Report', margin, margin + 4)
          doc.setFontSize(10)
          doc.text(`Month: ${month}`, pageW - margin - 40, margin + 4)
          doc.setLineWidth(0.3)
          doc.line(margin, margin + 8, pageW - margin, margin + 8)
          y0 = margin + 14
        } else {
          y0 = margin
        }
        doc.setFontSize(10)
        doc.setLineWidth(0.2)
        let xx = margin
        for (const c of cols) {
          doc.setFont('times', 'bold')
          doc.text(c.title, xx + 1, y0)
          xx += c.width
        }
        doc.line(margin, y0 + 2, pageW - margin, y0 + 2)
        return y0 + 6
      }

      yPos = drawHeader(yPos, true)
      doc.setFont('times', 'normal')
      doc.setFontSize(9)

      for (const s of staff) {
        const byDate = byStaffDate[s.id] || {}
        let presentCount = 0
        let absentCount = 0
        let lateCount = 0
        // Generate all days of the month
        for (let d = 1; d <= totalDays; d++) {
          const date = `${month}-${String(d).padStart(2, '0')}`
          const rec = byDate[date]
          const status = rec?.status || 'absent'
          const shiftId = rec?.shiftId || s.shiftId
          const clockIn = rec?.clockIn
          const clockOut = rec?.clockOut

          if (status === 'present') {
            presentCount += 1
            if (isLate(shiftId, clockIn)) lateCount += 1
          } else if (status === 'absent') {
            absentCount += 1
          }
          
          if (yPos > pageH - margin - 15) {
            doc.addPage()
            yPos = drawHeader(margin, false)
          }
          const minutes = (status === 'present' && clockIn && clockOut) ? Math.max(0, toMinutes(clockOut) - toMinutes(clockIn)) : 0
          const data = [s.name, date, shiftName(shiftId), status, to12Hour(clockIn) || '', to12Hour(clockOut) || '', fmtHours(minutes)]
          let xx = margin
          for (let i = 0; i < cols.length; i++) {
            doc.text(String(data[i] || ''), xx + 1, yPos)
            xx += cols[i].width
          }
          yPos += 5
        }

        if (yPos > pageH - margin - 15) {
          doc.addPage()
          yPos = drawHeader(margin, false)
        }
        doc.setFont('times', 'bold')
        doc.text(`Totals: Present ${presentCount} | Absent ${absentCount} | Late ${lateCount}`, margin + 1, yPos)
        doc.setFont('times', 'normal')
        yPos += 7
        // Add spacing between staff
        yPos += 3
      }

      doc.save(`hospital_all_staff_report_${month}.pdf`)
    } catch (e) {
      console.error('Export all staff PDF failed:', e)
    } finally {
      setExportingPdf(false)
    }
  }

  const exportAllStaffCsv = async () => {
    if (!staff.length) return
    setExportingAll(true)
    try {
      const from = `${month}-01`
      const to = new Date(Number(month.slice(0,4)), Number(month.slice(5,7)), 0)
      const toStr = `${to.getFullYear()}-${String(month.slice(5,7)).padStart(2,'0')}-${String(to.getDate()).padStart(2,'0')}`
      
      // Fetch all attendance for the month (no staffId filter)
      const res = await hospitalApi.listAttendance({ from, to: toStr, limit: 10000 })
      const allAtt = (res.items||[]).map((x:any)=>({
        staffId: String(x.staffId),
        date: x.date,
        status: x.status,
        clockIn: x.clockIn,
        clockOut: x.clockOut,
        shiftId: x.shiftId
      }))

      // Group by staff and date
      const byStaffDate: Record<string, Record<string, { clockIn?:string; clockOut?:string; status:string; shiftId?:string }>> = {}
      for (const a of allAtt) {
        if (!byStaffDate[a.staffId]) byStaffDate[a.staffId] = {}
        const byDate = byStaffDate[a.staffId]
        if (!byDate[a.date]) byDate[a.date] = { status: a.status, clockIn: a.clockIn, clockOut: a.clockOut, shiftId: a.shiftId }
        else {
          const cur = byDate[a.date]
          if (a.clockIn && (!cur.clockIn || a.clockIn < cur.clockIn)) cur.clockIn = a.clockIn
          if (a.clockOut && (!cur.clockOut || a.clockOut > cur.clockOut)) cur.clockOut = a.clockOut
          if (a.status === 'present') cur.status = 'present'
          if (a.shiftId) cur.shiftId = a.shiftId
        }
      }

      // Get total days in month
      const [yearCsv, monCsv] = month.split('-').map(n => parseInt(n || '0'))
      const totalDays = new Date(yearCsv, monCsv, 0).getDate()

      // Build CSV rows
      const rowsCsv = [['Month','Staff','Date','Shift','Status','Clock In','Clock Out','Hours']]
      for (const s of staff) {
        const byDate = byStaffDate[s.id] || {}
        // Generate all days of the month
        for (let d = 1; d <= totalDays; d++) {
          const date = `${month}-${String(d).padStart(2, '0')}`
          const rec = byDate[date]
          const status = rec?.status || 'absent'
          const shiftId = rec?.shiftId || s.shiftId
          const clockIn = rec?.clockIn
          const clockOut = rec?.clockOut
          const minutes = (status === 'present' && clockIn && clockOut) ? Math.max(0, toMinutes(clockOut) - toMinutes(clockIn)) : 0
          rowsCsv.push([month, s.name, date, shiftName(shiftId), status, to12Hour(clockIn) || '', to12Hour(clockOut) || '', fmtHours(minutes)])
        }
      }

      const csv = rowsCsv.map(r => r.map(x => `"${String(x).replace(/"/g,'""')}"`).join(',')).join('\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `hospital_monthly_all_staff_${month}.csv`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch (e) {
      console.error('Export all staff failed:', e)
    } finally {
      setExportingAll(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="text-xl font-bold text-slate-800">Staff Monthly</div>
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-sm text-slate-700">Staff</label>
            <select value={selectedStaffId} onChange={e=>setSelectedStaffId(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm min-w-[220px]">
              {staff.map(s => (<option key={s.id} value={s.id}>{s.name}</option>))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-700">Month</label>
            <input type="month" value={month} onChange={e=>setMonth(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div className="ml-auto flex items-end gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={showAllDays} onChange={e=>setShowAllDays(e.target.checked)} />
              Show all days
            </label>
            <button onClick={exportCsv} className="btn-outline-navy">Export CSV</button>
            <button onClick={exportAllStaffCsv} disabled={exportingAll} className="btn-outline-navy">{exportingAll ? 'Exporting...' : 'Export All CSV'}</button>
            <button onClick={exportAllStaffPdf} disabled={exportingPdf} className="btn-outline-navy">{exportingPdf ? 'Exporting...' : 'Export All PDF'}</button>
            <button onClick={()=> setReportOpen(true)} className="btn">Staff Report</button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 font-medium text-slate-800">Monthly View - {month}</div>
        <div className="space-y-2">
          {days.map(d => {
            const canIn = !d.clockIn
            const canOut = !d.clockOut
            return (
            <div key={d.date} className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="text-slate-800">{new Date(d.date).toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</div>
                <div className={`text-xs rounded px-2 py-0.5 ${d.status==='present'?'bg-emerald-100 text-emerald-700': d.status==='leave'?'bg-amber-100 text-amber-700':'bg-rose-100 text-rose-700'}`}>{d.status}</div>
                <div className="text-xs text-slate-500">{shiftName(d.shiftId)}</div>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div>
                  <div className="text-slate-500">Check in</div>
                  <div className="text-slate-800">{to12Hour(d.clockIn) || '—'}</div>
                </div>
                <div>
                  <div className="text-slate-500">Check out</div>
                  <div className="text-slate-800">{to12Hour(d.clockOut) || '—'}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button disabled={!canIn} onClick={()=>saveQuick(d.date,'in')} className={`rounded-md border px-2 py-1 text-xs ${canIn? 'border-slate-300 hover:bg-slate-50' : 'border-slate-200 text-slate-400 cursor-not-allowed'}`}>Check In</button>
                  <button disabled={!canOut} onClick={()=>saveQuick(d.date,'out')} className={`rounded-md border px-2 py-1 text-xs ${canOut? 'border-slate-300 hover:bg-slate-50' : 'border-slate-200 text-slate-400 cursor-not-allowed'}`}>Check Out</button>
                </div>
              </div>
            </div>
          )})}
          {days.length===0 && (<div className="text-center text-slate-500 py-8">No attendance records for this month</div>)}
        </div>
      </div>

      <Hospital_StaffReportDialog open={reportOpen} onClose={()=>setReportOpen(false)} staffList={staff as any} initialMonth={month} initialStaffId={selectedStaffId || undefined} />
    </div>
  )
}
