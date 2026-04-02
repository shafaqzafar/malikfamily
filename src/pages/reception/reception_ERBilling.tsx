import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { hospitalApi } from '../../utils/api'
import { fmtDateTime12 } from '../../utils/timeFormat'
import Hospital_ErPaymentSlip from '../../components/hospital/Hospital_ErPaymentSlip'
import Toast, { type ToastState } from '../../components/ui/Toast'

function getReceptionUser(){
  try{
    const s = localStorage.getItem('reception.session')
    if (!s) return 'reception'
    const obj = JSON.parse(s)
    return obj?.username || obj?.name || 'reception'
  }catch{ return 'reception' }
}

function currency(n: number){ return `Rs ${Number(n||0).toFixed(2)}` }

function ServiceSelect({ svcCatalog, onSelect, initialValue = '' }: { svcCatalog: any[], onSelect: (svc: any) => void, initialValue?: string }) {
  const [q, setQ] = useState(initialValue)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    const s = q.toLowerCase().trim()
    if (!s) return svcCatalog
    return svcCatalog.filter(svc => (svc.name || svc.description || '').toLowerCase().includes(s))
  }, [svcCatalog, q])

  useEffect(() => {
    const clickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', clickOutside)
    return () => document.removeEventListener('mousedown', clickOutside)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <input
        name="description"
        value={q}
        autoComplete="off"
        onChange={e => { setQ(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder="Search service..."
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-[70] mt-1 max-h-60 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg">
          {filtered.map(svc => (
            <button
              key={svc.id || svc._id}
              type="button"
              className="flex w-full flex-col px-3 py-2 text-left hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
              onClick={() => {
                onSelect(svc)
                setQ(svc.name || svc.description)
                setOpen(false)
              }}
            >
              <div className="text-sm font-medium text-slate-900">{svc.name || svc.description}</div>
              <div className="text-xs text-slate-500">Rs{svc.price || svc.amount}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Reception_ERBilling(){
  const [params] = useSearchParams()
  const preTokenId = String(params.get('tokenId') || '')

  const [q, setQ] = useState('')
  const [list, setList] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const [tokenId, setTokenId] = useState<string>(preTokenId)
  const [token, setToken] = useState<any|null>(null)
  const [encounterId, setEncounterId] = useState<string>('')

  const [charges, setCharges] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])

  const [method, setMethod] = useState('Cash')
  const [refNo, setRefNo] = useState('')
  const [collecting, setCollecting] = useState(false)
  const [collectAmount, setCollectAmount] = useState<string>('')
  const [toast, setToast] = useState<ToastState>(null)

  const [allocMode, setAllocMode] = useState<'auto'|'manual'>('auto')
  const [allocSelected, setAllocSelected] = useState<Record<string, boolean>>({})
  const [allocAmounts, setAllocAmounts] = useState<Record<string, string>>({})

  const panelRef = useRef<HTMLDivElement|null>(null)
  const [flash, setFlash] = useState(false)
  const [showPanel, setShowPanel] = useState<boolean>(!!preTokenId)
  const [openAdvance, setOpenAdvance] = useState(false)
  const [openCharge, setOpenCharge] = useState(false)
  const [svcCatalog, setSvcCatalog] = useState<any[]>([])

  const [slipOpen, setSlipOpen] = useState(false)
  const [slipData, setSlipData] = useState<any|null>(null)

  useEffect(() => {
    let cancelled = false
    async function loadSvc(){
      try{
        const res: any = await hospitalApi.listErServices({ active: true, limit: 500 })
        const rows: any[] = res?.services || []
        if (cancelled) return
        setSvcCatalog(rows.map((r:any)=>({ id: String(r._id||r.id), name: String(r.name||''), price: Number(r.price||0) })))
      }catch{
        if (!cancelled) setSvcCatalog([])
      }
    }
    loadSvc()
    return ()=>{ cancelled = true }
  }, [])

  useEffect(()=>{ if(preTokenId){ setTokenId(preTokenId); setShowPanel(true) } }, [preTokenId])

  useEffect(()=>{ if (tokenId) loadToken(tokenId) }, [tokenId])

  useEffect(()=>{
    if (!token) return
    try { panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) } catch {}
    setFlash(true)
    const t = setTimeout(()=> setFlash(false), 1600)
    return ()=> clearTimeout(t)
  }, [token])

  useEffect(()=>{
    let timer: any
    const run = () => { search().catch(()=>{}) }
    run()
    timer = setInterval(run, 15000)
    return ()=> { if (timer) clearInterval(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function search(){
    setLoading(true)
    try{
      const depRes: any = await hospitalApi.listDepartments().catch(()=>({ departments: [] }))
      const deps: any[] = depRes?.departments || []
      const erDep = deps.find(d => String(d?.name||'').trim().toLowerCase() === 'emergency')
      const departmentId = erDep ? String(erDep._id) : ''

      const res: any = await hospitalApi.listTokens({ status: 'queued', departmentId })
      const rows: any[] = res?.tokens || []
      const filtered = q.trim()
        ? rows.filter(t => {
          const s = q.trim().toLowerCase()
          const pat = t.patientId || {}
          return String(t.tokenNo||'').toLowerCase().includes(s) ||
            String(pat.fullName||'').toLowerCase().includes(s) ||
            String(pat.mrn||'').toLowerCase().includes(s)
        })
        : rows

      setList(filtered.map(t => ({
        id: String(t._id),
        tokenNo: t.tokenNo || '-',
        patientName: t.patientId?.fullName || t.patientName || '-',
        mrn: t.patientId?.mrn || t.mrn || '-',
        doctor: t.doctorId?.name || '-',
        createdAt: t.createdAt || t.dateIso,
      })))

      if (!tokenId && filtered.length){
        setTokenId(String(filtered[0]._id))
      }
    }catch{ setList([]) }
    setLoading(false)
  }

  function openCart(id: string){
    setTokenId(id)
    setShowPanel(true)
  }

  async function loadToken(id: string){
    try{
      const tRes: any = await hospitalApi.getToken(id)
      const t = tRes?.token
      setToken(t || null)
      const encId = String(t?.encounterId || '')
      setEncounterId(encId)
      if (encId){
        const [ch, pay] = await Promise.all([
          hospitalApi.erListBillingItems(encId, { limit: 500 }) as any,
          hospitalApi.erListPayments(encId, { limit: 500 }) as any,
        ])
        setCharges(ch?.items || [])
        setPayments(pay?.payments || [])
      } else {
        setCharges([]); setPayments([]);
      }
    }catch{
      setToken(null)
      setEncounterId('')
      setCharges([])
      setPayments([])
    }
  }

  const total = useMemo(() => (charges || []).reduce((s, c) => s + Number(c.amount || 0), 0), [charges])
  const totalPaidFromCharges = useMemo(() => (charges || []).reduce((s, c) => s + Number(c.paidAmount || 0), 0), [charges])
  const advances = useMemo(() => payments.filter(p => String(p.method || '').toLowerCase() === 'advance'), [payments])
  const settlements = useMemo(() => payments.filter(p => String(p.method || '').toLowerCase() === 'advance settlement'), [payments])
  
  const advanceTotalRaw = useMemo(() => advances.reduce((s, p) => s + Number(p.amount || 0), 0), [advances])
  const settlementTotal = useMemo(() => settlements.reduce((s, p) => s + Number(p.amount || 0), 0), [settlements])
  
  const advanceTotal = Math.max(0, advanceTotalRaw - settlementTotal)
  const paid = totalPaidFromCharges + settlementTotal

  const outstandingBeforeAdvance = Math.max(0, total - paid)
  const advanceUsed = Math.min(advanceTotal, outstandingBeforeAdvance)
  const advanceRemaining = Math.max(0, advanceTotal - advanceUsed)
  const netDue = Math.max(0, outstandingBeforeAdvance - advanceUsed)
  const pending = outstandingBeforeAdvance

  useEffect(()=>{ setCollectAmount(pending.toFixed(2)) }, [tokenId, total, paid])

  async function settleFromAdvance(amount: number, chargeLabel: string){
    if (!encounterId) return
    if (advanceTotal <= 0) { setToast({ type: 'error', message: 'No advance credit available' }); return }
    const amt = Math.min(amount, advanceTotal)
    try{
      const portal = window.location.pathname.startsWith('/reception') ? 'reception' : 'hospital'
      await hospitalApi.erCreatePayment(encounterId, { 
        amount: amt, 
        method: 'Advance Settlement',
        notes: `Settled for: ${chargeLabel}`,
        receivedBy: getReceptionUser(),
        portal
      } as any)
      await loadToken(tokenId)
      setToast({ type: 'success', message: 'Settled from advance' })
    }catch(e: any){ setToast({ type: 'error', message: e?.message || 'Failed to settle' }) }
  }

  async function collect(){
    if (!tokenId || !encounterId) return
    const amt = Math.max(0, parseFloat(String(collectAmount||'0')) || 0)
    if (amt <= 0) return
    if (amt > pending){ setToast({ type: 'error', message: 'Collect exceeds pending' }); return }
    setCollecting(true)
    try{
      const portal = window.location.pathname.startsWith('/reception') ? 'reception' : 'hospital'
      
      // Build allocations based on mode
      let allocations: Array<{ billingItemId: string; amount: number }> = []
      if (allocMode === 'manual') {
        // Manual: use user-specified amounts
        for (const c of charges) {
          const id = String(c._id || c.id || '')
          if (!allocSelected[id]) continue
          const allocAmt = Math.max(0, parseFloat(allocAmounts[id] || '0') || 0)
          if (allocAmt > 0) allocations.push({ billingItemId: id, amount: allocAmt })
        }
      } else {
        // Auto: distribute FIFO to selected charges (or all if none selected)
        const selectedIds = Object.keys(allocSelected).filter(k => allocSelected[k])
        const eligible = selectedIds.length > 0
          ? charges.filter((c: any) => allocSelected[String(c._id || c.id)])
          : charges
        let left = amt
        for (const c of eligible) {
          if (left <= 0) break
          const id = String(c._id || c.id || '')
          const remaining = Math.max(0, Number(c.amount || 0) - Number(c.paidAmount || 0))
          if (remaining <= 0) continue
          const take = Math.min(remaining, left)
          if (take > 0) {
            allocations.push({ billingItemId: id, amount: take })
            left -= take
          }
        }
      }
      
      const res: any = await hospitalApi.erCreatePayment(encounterId, { amount: amt, method, refNo, receivedBy: getReceptionUser(), portal, allocations } as any)
      const pay = res?.payment

      const [ch2, pay2] = await Promise.all([
        hospitalApi.erListBillingItems(encounterId, { limit: 500 }) as any,
        hospitalApi.erListPayments(encounterId, { limit: 500 }) as any,
      ])
      setCharges(ch2?.items || [])
      setPayments(pay2?.payments || [])
      setAllocSelected({})
      setAllocAmounts({})

      setSlipData({
        encounterId,
        patientName: token?.patientId?.fullName || token?.patientName || '-',
        mrn: token?.patientId?.mrn || token?.mrn || '',
        phone: token?.patientId?.phoneNormalized || token?.phone || '',
        payment: { amount: Number(pay?.amount || amt), method: pay?.method || method, refNo: pay?.refNo || refNo, receivedAt: pay?.receivedAt || pay?.createdAt || new Date().toISOString() },
        totals: pay2?.totals || { total, paid: paid + amt, pending: Math.max(0, pending - amt) },
      })
      setSlipOpen(true)

      setRefNo('')
      setCollectAmount('')
    }catch(e: any){
      setToast({ type: 'error', message: e?.message || 'Failed to record payment' })
    }
    setCollecting(false)
  }

  async function saveAdvance(d: { amount: number; method: string; refNo?: string; notes?: string }) {
    if (!tokenId || !encounterId) return
    const amt = Number(d.amount || 0)
    if (amt <= 0) { setToast({ type: 'error', message: 'Advance amount must be greater than 0' }); return }
    try {
      const portal = window.location.pathname.startsWith('/reception') ? 'reception' : 'hospital'
      await hospitalApi.erCreatePayment(encounterId, {
        amount: amt,
        method: 'Advance',
        refNo: d.refNo || '',
        notes: d.notes || '',
        receivedBy: getReceptionUser(),
        portal
      } as any)
      await loadToken(tokenId)
      setOpenAdvance(false)
      setToast({ type: 'success', message: 'Advance recorded' })
    } catch (e: any) {
      setToast({ type: 'error', message: e?.message || 'Failed to record advance' })
    }
  }

  const patientName = token?.patientId?.fullName || token?.patientName || '-'
  const mrn = token?.patientId?.mrn || token?.mrn || ''
  const pendingLabel = pending <= 0 ? 'Rs 0.00' : currency(pending)

  return (
    <div className="space-y-4 p-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="text-lg font-semibold">ER Billing</div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search by Token, MRN or Patient Name" className="min-w-[320px] flex-1 rounded-md border border-slate-300 px-3 py-2" />
          <button onClick={search} className="btn" disabled={loading}>{loading? 'Searching...' : 'Search'}</button>
        </div>

        <div className="mt-3 overflow-x-auto text-sm">
          <table className="min-w-full">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="px-2 py-2 text-left">Patient</th>
                <th className="px-2 py-2 text-left">MRN</th>
                <th className="px-2 py-2 text-left">Token</th>
                <th className="px-2 py-2 text-left">Doctor</th>
                <th className="px-2 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {list.length===0 ? (
                <tr><td colSpan={5} className="px-2 py-6 text-center text-slate-500">{loading ? 'Loading...' : 'No ER tokens found'}</td></tr>
              ) : list.map(r => (
                <tr key={r.id}>
                  <td className="px-2 py-2">{r.patientName}</td>
                  <td className="px-2 py-2">{r.mrn}</td>
                  <td className="px-2 py-2 font-medium">{r.tokenNo}</td>
                  <td className="px-2 py-2">{r.doctor}</td>
                  <td className="px-2 py-2"><button className="btn-outline-navy" onClick={()=>openCart(r.id)}>Collect</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div ref={panelRef} className={`rounded-xl border border-slate-200 bg-white p-4 ${flash ? 'ring-2 ring-emerald-300' : ''}`}>
        {!showPanel || !tokenId ? (
          <div className="text-sm text-slate-500">Select a patient/token above to open billing.</div>
        ) : !token ? (
          <div className="text-sm text-slate-500">Loading token...</div>
        ) : !encounterId ? (
          <div className="text-sm text-rose-600">No encounter found for this token.</div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="text-lg font-semibold">{patientName}</div>
                <div className="text-xs text-slate-500">{mrn ? `MRN: ${mrn} · ` : ''}Token: {token?.tokenNo || '-'} · Encounter: {encounterId}</div>
                {advanceRemaining > 0 && (
                  <div className="mt-1 text-xs font-medium text-indigo-600">Credit Available: {currency(advanceRemaining)}</div>
                )}
              </div>
              <div className="flex gap-4">
                <div className="text-right">
                  <div className="text-xs text-slate-500">Outstanding</div>
                  <div className="text-xl font-bold text-rose-700">{pendingLabel}</div>
                </div>
                {advanceTotal > 0 && (
                  <div className="text-right">
                    <div className="text-xs text-slate-500">Net Due</div>
                    <div className="text-xl font-bold text-indigo-700">{currency(netDue)}</div>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <button onClick={() => setOpenAdvance(true)} className="btn-outline-navy py-1 px-3">Add Advance</button>
                </div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-semibold">Charges</div>
                  <button onClick={() => setOpenCharge(true)} className="btn-sm py-1 px-3">Add Charge</button>
                </div>
                <div className="mt-2 overflow-x-auto text-sm">
                  <table className="min-w-full">
                    <thead className="bg-slate-50 text-slate-700"><tr><th className="px-2 py-1 text-left">Charge</th><th className="px-2 py-1 text-right">Amount</th><th className="px-2 py-1 text-right">Remaining</th></tr></thead>
                    <tbody className="divide-y">
                      {charges.length===0 ? <tr><td colSpan={3} className="px-2 py-4 text-center text-slate-500">No charges</td></tr> : charges.map((c:any)=>{
                        const isFullyPaid = Number(c.remaining || 0) <= 0 && Number(c.paidAmount || 0) > 0
                        const isPartiallyPaid = Number(c.paidAmount || 0) > 0 && Number(c.remaining || 0) > 0
                        return (
                          <tr key={String(c._id||c.id)}>
                            <td className="px-2 py-1">
                              <div>{c.description || '-'}</div>
                              {isFullyPaid && <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">Paid</span>}
                              {isPartiallyPaid && <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">Partial</span>}
                            </td>
                            <td className="px-2 py-1 text-right">{currency(Number(c.amount||0))}</td>
                            <td className="px-2 py-1 text-right">{currency(Number(c.remaining||0))}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <div className="text-sm font-semibold">Collect Payment</div>
                <div className="mt-2 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <div className="text-slate-600">Pending</div>
                    <div className="font-semibold">{pendingLabel}</div>
                  </div>

                  <div>
                    <div className="text-xs text-slate-600">Method</div>
                    <select value={method} onChange={e=>setMethod(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2">
                      <option>Cash</option>
                      <option>Card</option>
                      <option>Online</option>
                    </select>
                  </div>
                  <div>
                    <div className="text-xs text-slate-600">Reference / Notes</div>
                    <input value={refNo} onChange={e=>setRefNo(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" placeholder="Txn # / Notes" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-600">Collect Amount</div>
                    <input type="number" value={collectAmount} onChange={e=>setCollectAmount(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
                  </div>

                  <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs font-semibold text-slate-700">Apply payment to charges</div>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={()=>setAllocMode('auto')} className={allocMode==='auto' ? 'btn-outline-navy text-xs py-1 px-2' : 'rounded-md border border-slate-300 bg-white px-2 py-1 text-xs'}>Auto</button>
                        <button type="button" onClick={()=>setAllocMode('manual')} className={allocMode==='manual' ? 'btn-outline-navy text-xs py-1 px-2' : 'rounded-md border border-slate-300 bg-white px-2 py-1 text-xs'}>Manual</button>
                      </div>
                    </div>
                    <div className="mt-2 max-h-40 overflow-auto">
                      {(charges || []).map((c:any)=>{
                        const id = String(c?._id||c.id||'')
                        const remaining = Math.max(0, Number(c.remaining != null ? c.remaining : (Number(c.amount||0)-Number(c.paidAmount||0))) || 0)
                        if (!id) return null
                        const disabled = remaining <= 0
                        return (
                          <div key={id} className="flex items-center gap-2 py-1 text-xs">
                            <input type="checkbox" checked={!!allocSelected[id]} disabled={disabled} onChange={e=> setAllocSelected(prev=> ({ ...prev, [id]: e.target.checked }))} />
                            <div className="min-w-0 flex-1 truncate text-slate-700">{String(c.description||'')}</div>
                            <div className="w-[90px] text-right text-slate-600">{currency(remaining)}</div>
                            <input
                              disabled={allocMode !== 'manual' || disabled || !allocSelected[id]}
                              value={allocAmounts[id] ?? ''}
                              onChange={e=> setAllocAmounts(prev=> ({ ...prev, [id]: e.target.value }))}
                              className="w-[90px] rounded border border-slate-300 px-2 py-1 text-right"
                              placeholder="0"
                            />
                          </div>
                        )
                      })}
                    </div>
                    {allocMode === 'manual' && (
                      <div className="mt-2 text-[11px] text-slate-600">Manual mode: enter amounts per selected charge ({'<='} remaining).</div>
                    )}
                    {allocMode === 'auto' && (
                      <div className="mt-2 text-[11px] text-slate-600">Auto mode: collected amount will be distributed FIFO into selected charges.</div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button onClick={collect} disabled={collecting || pending<=0} className="btn flex-1 disabled:opacity-50">{collecting? 'Saving...' : `Collect Payment`}</button>
                    {advanceTotal > 0 && (
                      <button onClick={()=>settleFromAdvance(pending, 'Full Outstanding')} className="btn-outline-navy flex-1">Settle from Advance</button>
                    )}
                  </div>

                  <div className="pt-2">
                    <div className="text-sm font-semibold">Previous Payments</div>
                    <div className="mt-2 overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-slate-50 text-slate-700"><tr><th className="px-2 py-1 text-left">Date</th><th className="px-2 py-1 text-left">Method</th><th className="px-2 py-1 text-left">Performed By</th><th className="px-2 py-1 text-right">Amount</th></tr></thead>
                        <tbody className="divide-y">
                          {payments.length===0 ? <tr><td colSpan={4} className="px-2 py-4 text-center text-slate-500">None</td></tr> : payments.map((p:any)=>(
                            <tr key={String(p._id||p.id)}>
                              <td className="px-2 py-1">{fmtDateTime12(p.receivedAt||p.createdAt||new Date().toISOString())}</td>
                              <td className="px-2 py-1">{p.method || '-'}</td>
                              <td className="px-2 py-1">{p.createdByUsername || p.createdBy || '-'}</td>
                              <td className="px-2 py-1 text-right">{currency(Number(p.amount||0))}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <Hospital_ErPaymentSlip
        open={slipOpen}
        onClose={()=>setSlipOpen(false)}
        data={slipData || { encounterId: '', patientName: '', payment: { amount: 0 }, totals: { total: 0, paid: 0, pending: 0 } }}
        autoPrint
      />

      {openAdvance && (
        <AdvanceDialog open={openAdvance} onClose={()=>setOpenAdvance(false)} onSave={saveAdvance} />
      )}

      {openCharge && (
        <ChargeDialog 
          open={openCharge} 
          onClose={() => setOpenCharge(false)} 
          svcCatalog={svcCatalog}
          onSave={async (d) => {
            if (!encounterId) return
            try {
              await hospitalApi.createErCharge(encounterId, { description: d.description, qty: d.qty, unitPrice: d.unitPrice, billedBy: 'reception' })
              setOpenCharge(false)
              await loadToken(tokenId)
              setToast({ type: 'success', message: 'Charge added' })
            } catch (e: any) {
              setToast({ type: 'error', message: e?.message || 'Failed to add charge' })
            }
          }}
          billingFormRef={panelRef}
        />
      )}

      <Toast toast={toast} onClose={()=>setToast(null)} />
    </div>
  )
}

function ChargeDialog({ open, onClose, onSave, svcCatalog, billingFormRef }: { open: boolean; onClose: ()=>void; onSave: (d: { description: string; qty: number; unitPrice: number })=>void; svcCatalog: any[]; billingFormRef: React.RefObject<HTMLDivElement | null> }){
  if(!open) return null
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    onSave({ 
      description: String(fd.get('description')||''), 
      qty: Number(fd.get('qty')||1),
      unitPrice: parseFloat(String(fd.get('unitPrice')||'0')) || 0 
    })
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <form onSubmit={submit} className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/5">
        <div className="border-b border-slate-200 px-5 py-3 font-semibold text-slate-800">Add Charge</div>
        <div className="space-y-3 px-5 py-4 text-sm">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Service</label>
            <ServiceSelect
              svcCatalog={svcCatalog}
              onSelect={(svc) => {
                const form = billingFormRef.current?.querySelector('form')
                if (!form) return
                const rateEl = form.querySelector<HTMLInputElement>('input[name="unitPrice"]')
                if (rateEl) rateEl.value = String(svc.price || 0)
              }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600">Qty</label>
              <input name="qty" type="number" defaultValue={1} className="w-full rounded-md border border-slate-300 px-3 py-2" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600">Rate</label>
              <input name="unitPrice" type="number" step="0.01" defaultValue={0} className="w-full rounded-md border border-slate-300 px-3 py-2" />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <button type="button" onClick={onClose} className="btn-outline-navy">Cancel</button>
          <button type="submit" className="btn">Add</button>
        </div>
      </form>
    </div>
  )
}

function AdvanceDialog({ open, onClose, onSave }: { open: boolean; onClose: ()=>void; onSave: (d: { amount: number; method: string; refNo?: string; notes?: string })=>void }){
  if(!open) return null
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    onSave({
      amount: parseFloat(String(fd.get('amount')||'0')) || 0,
      method: String(fd.get('method')||'Cash'),
      refNo: String(fd.get('refNo')||''),
      notes: String(fd.get('notes')||''),
    })
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <form onSubmit={submit} className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/5">
        <div className="border-b border-slate-200 px-5 py-3 font-semibold text-slate-800">Add Advance</div>
        <div className="space-y-3 px-5 py-4 text-sm">
          <label htmlFor="adv-amount" className="block text-xs font-medium text-slate-600">Amount</label>
          <input id="adv-amount" name="amount" type="number" step="0.01" placeholder="e.g. 5000" className="w-full rounded-md border border-slate-300 px-3 py-2" />

          <label htmlFor="adv-method" className="block text-xs font-medium text-slate-600">Payment Mode</label>
          <select id="adv-method" name="method" className="w-full rounded-md border border-slate-300 px-3 py-2">
            {['Cash','Card','Bank','Online'].map(m => (<option key={m} value={m}>{m}</option>))}
          </select>

          <label htmlFor="adv-ref" className="block text-xs font-medium text-slate-600">Ref No</label>
          <input id="adv-ref" name="refNo" placeholder="optional" className="w-full rounded-md border border-slate-300 px-3 py-2" />

          <label htmlFor="adv-notes" className="block text-xs font-medium text-slate-600">Notes</label>
          <input id="adv-notes" name="notes" placeholder="optional" className="w-full rounded-md border border-slate-300 px-3 py-2" />
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <button type="button" onClick={onClose} className="btn-outline-navy">Cancel</button>
          <button type="submit" className="btn">Save</button>
        </div>
      </form>
    </div>
  )
}
