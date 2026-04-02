import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { hospitalApi } from '../../utils/api'
import Doctor_IpdReferralForm from '../../components/doctor/Doctor_IpdReferralForm'
import { X } from 'lucide-react'

import ErDailyMonitoring from '../../components/hospital/Hospital_ErDailyMonitoring'
import ErMedication from '../../components/hospital/Hospital_ErMedication'
import ErConsultantNotes from '../../components/hospital/Hospital_ErConsultantNotes'

function Tab({ label, active, onClick }: { label: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-3 py-1 text-sm ${active ? 'bg-slate-200 text-slate-900' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
    >
      {label}
    </button>
  )
}

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
    <div className="relative w-full" ref={ref}>
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
        <div className="absolute z-[100] mt-1 max-h-48 w-full min-w-[200px] overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-xl">
          {filtered.map(svc => (
            <button
              key={svc.id || svc._id}
              type="button"
              className="w-full px-3 py-2 text-left hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
              onClick={() => {
                onSelect(svc)
                setQ(svc.name || svc.description)
                setOpen(false)
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-900">{svc.name || svc.description}</span>
                <span className="text-xs text-slate-500">Rs{svc.price || svc.amount}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Hospital_EmergencyChart(){
  const { id } = useParams()
  const navigate = useNavigate()

  const tokenId = String(id || '')

  const [openCharge, setOpenCharge] = useState(false)
  const [editCharge, setEditCharge] = useState<null | { id: string; description: string; qty: number; unitPrice: number }>(null)

  const [tab, setTab] = useState<'monitoring'|'consult'|'meds'|'billing'>('monitoring')
  const [openAdvance, setOpenAdvance] = useState(false)

  const [loadingEnc, setLoadingEnc] = useState(false)
  const [encounterId, setEncounterId] = useState<string>('')
  const [mrn, setMrn] = useState<string>('')
  const [charges, setCharges] = useState<Array<{ id: string; description: string; qty: number; unitPrice: number; amount: number; date?: string }>>([])
  const [loadingCharges, setLoadingCharges] = useState(false)
  const [payments, setPayments] = useState<any[]>([])

  const [svcCatalog, setSvcCatalog] = useState<Array<{ id: string; name: string; price: number }>>([])

  const [toast, setToast] = useState<{ type: 'success'|'error'|'info'; message: string } | null>(null)
  const [confirmDel, setConfirmDel] = useState<{ open: boolean; chargeId: string } | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 3000)
    return () => window.clearTimeout(t)
  }, [toast])

  useEffect(() => {
    let cancelled = false
    async function load(){
      if (!tokenId) return
      setLoadingEnc(true)
      try{
        const res: any = await hospitalApi.getToken(tokenId)
        const t: any = res?.token
        const encId = String(t?.encounterId || '')
        const pmrn = String(t?.patientId?.mrn || t?.mrn || '')
        if (!cancelled){
          setEncounterId(encId)
          setMrn(pmrn)
        }
      }catch{
        if (!cancelled){ setEncounterId(''); setMrn('') }
      }finally{
        if (!cancelled) setLoadingEnc(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [tokenId])

  async function reloadCharges(){
    if (!encounterId) { setCharges([]); return }
    setLoadingCharges(true)
    try{
      const res: any = await hospitalApi.listErCharges(encounterId, { limit: 200 })
      const rows: any[] = res?.charges || []
      setCharges(rows.map((c: any) => ({
        id: String(c._id || c.id),
        description: String(c.description || ''),
        qty: Number(c.qty || 0),
        unitPrice: Number(c.unitPrice || 0),
        amount: Number(c.amount || 0),
        date: c.date ? String(c.date) : (c.createdAt ? String(c.createdAt) : ''),
      })))
    }catch{
      setCharges([])
    }finally{
      setLoadingCharges(false)
    }
  }

  async function reloadBillingSummary(){
    if (!encounterId) { setPayments([]); return }
    try{
      const payRes = await hospitalApi.erListPayments(encounterId, { limit: 500 })
      setPayments(payRes?.payments || [])
    }catch{
      setPayments([])
    }
  }

  useEffect(() => { reloadCharges(); reloadBillingSummary() }, [encounterId])

  useEffect(() => {
    if (tab !== 'billing' || !encounterId) return
    const t = setInterval(() => {
      reloadBillingSummary().catch(()=>{})
    }, 5000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, encounterId])

  useEffect(() => {
    let cancelled = false
    async function loadSvc(){
      try{
        const res: any = await hospitalApi.listErServices({ active: true, limit: 200 })
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

  const total = useMemo(() => (charges || []).reduce((s, c) => s + Number(c.amount || 0), 0), [charges])
  const advances = useMemo(() => payments.filter(p => String(p.method || '').toLowerCase() === 'advance'), [payments])
  const settlements = useMemo(() => payments.filter(p => String(p.method || '').toLowerCase() === 'advance settlement'), [payments])
  const nonAdvancePayments = useMemo(() => payments.filter(p => !['advance', 'advance settlement'].includes(String(p.method || '').toLowerCase())), [payments])
  
  const advanceTotalRaw = useMemo(() => advances.reduce((s, p) => s + Number(p.amount || 0), 0), [advances])
  const settlementTotal = useMemo(() => settlements.reduce((s, p) => s + Number(p.amount || 0), 0), [settlements])
  
  const advanceTotal = Math.max(0, advanceTotalRaw - settlementTotal)
  const paid = useMemo(() => nonAdvancePayments.reduce((s, p) => s + Number(p.amount || 0), 0), [nonAdvancePayments]) + settlementTotal
  
  const outstandingBeforeAdvance = Math.max(0, total - paid)
  const advanceUsed = Math.min(advanceTotal, outstandingBeforeAdvance)
  const advanceRemaining = Math.max(0, advanceTotal - advanceUsed)
  const netDue = Math.max(0, outstandingBeforeAdvance - advanceUsed)

  const payStatus = useMemo(() => {
    const t = total
    const p = paid
    const pen = outstandingBeforeAdvance
    if (t <= 0) return 'Unpaid'
    if (pen <= 0) return 'Paid'
    if (p > 0) return 'Partial'
    return 'Unpaid'
  }, [total, paid, outstandingBeforeAdvance])

  const goReferral = () => {
    setShowReferralDialog(true)
  }

  const [showReferralDialog, setShowReferralDialog] = useState(false)

  const chargesWithAlloc = useMemo(() => {
    const sorted = [...(charges || [])].sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : 0
      const db = b.date ? new Date(b.date).getTime() : 0
      return da - db
    })
    let remainingPaid = Math.max(0, Number(paid || 0))
    const alloc = sorted.map(c => {
      const amt = Math.max(0, Number(c.amount || 0))
      const paidHere = Math.min(amt, remainingPaid)
      const remaining = Math.max(0, amt - paidHere)
      remainingPaid = Math.max(0, remainingPaid - paidHere)
      const rowStatus = amt <= 0 ? 'Unpaid' : remaining <= 0 ? 'Paid' : paidHere > 0 ? 'Partial' : 'Unpaid'
      return { ...c, rowPaid: paidHere, rowRemaining: remaining, rowStatus }
    })
    const byId = new Map(alloc.map(a => [a.id, a]))
    return (charges || []).map(c => byId.get(c.id) || ({ ...c, rowPaid: 0, rowRemaining: Number(c.amount || 0), rowStatus: 'Unpaid' } as any))
  }, [charges, paid])

  async function saveAdvance(d: { amount: number; method: string; refNo?: string; notes?: string }) {
    if (!encounterId) return
    const amt = Number(d.amount || 0)
    if (amt <= 0) { setToast({ type: 'error', message: 'Advance amount must be greater than 0' }); return }
    try {
      await hospitalApi.erCreatePayment(encounterId, {
        amount: amt,
        method: 'Advance',
        refNo: d.refNo || '',
        notes: d.notes || '',
        receivedBy: 'hospital',
      } as any)
      setOpenAdvance(false)
      await reloadBillingSummary()
      setToast({ type: 'success', message: 'Advance recorded' })
    } catch (e: any) { setToast({ type: 'error', message: e?.message || 'Failed to record advance' }) }
  }

  async function settleFromAdvance(amount: number, chargeLabel: string) {
    if (!encounterId) return
    if (advanceTotal <= 0) { setToast({ type: 'error', message: 'No advance credit available' }); return }
    const amt = Math.min(amount, advanceTotal)
    try {
      await hospitalApi.erCreatePayment(encounterId, {
        amount: amt,
        method: 'Advance Settlement',
        notes: `Settled for: ${chargeLabel}`,
        receivedBy: 'hospital',
      } as any)
      await reloadBillingSummary()
      setToast({ type: 'success', message: 'Settled from advance' })
    } catch (e: any) { setToast({ type: 'error', message: e?.message || 'Failed to settle' }) }
  }

  const discharge = () => {
    if (!encounterId) { setToast({ type: 'error', message: 'Encounter not loaded yet' }); return }
    navigate(`/hospital/discharge/${encounterId}`)
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-slate-900">Emergency Token #{tokenId || '-'}</div>
            <div className="mt-1 text-sm text-slate-600">This page will use ER encounter APIs after backend confirmation.</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={goReferral} className="rounded-md bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700">Refer to IPD</button>
            <button onClick={discharge} className="rounded-md bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700">Discharge</button>
            <button onClick={()=>navigate('/hospital/emergency')} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Back</button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-1">
          <Tab label="Daily Monitoring" active={tab==='monitoring'} onClick={()=>setTab('monitoring')} />
          <Tab label="Consultant Notes" active={tab==='consult'} onClick={()=>setTab('consult')} />
          <Tab label="Medication" active={tab==='meds'} onClick={()=>setTab('meds')} />
          <Tab label="Billing" active={tab==='billing'} onClick={()=>setTab('billing')} />
        </div>
      </div>

      {tab==='monitoring' && (<ErDailyMonitoring encounterId={encounterId} />)}
      {tab==='consult' && (<ErConsultantNotes encounterId={encounterId} />)}
      {tab==='meds' && (<ErMedication encounterId={encounterId} />)}
      {tab==='billing' && (
        <div className="space-y-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <div className="text-sm font-semibold text-slate-800">ER Billing</div>
                <div className="text-xs text-slate-500">
                  Token: {tokenId || '-'} {mrn ? `• MRN: ${mrn}` : ''} • Status: <span className={payStatus==='Paid' ? 'font-semibold text-emerald-700' : payStatus==='Partial' ? 'font-semibold text-amber-700' : 'font-semibold text-rose-700'}>{payStatus}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button disabled={!encounterId || loadingEnc} onClick={()=>setOpenCharge(true)} className="btn disabled:opacity-50">Add Service</button>
                <button disabled={!encounterId || loadingEnc} onClick={()=>setOpenAdvance(true)} className="btn-outline-navy disabled:opacity-50">Add Advance</button>
                <button disabled={!encounterId || loadingCharges} onClick={async()=>{ await reloadCharges(); await reloadBillingSummary() }} className="btn-outline-navy disabled:opacity-50">Refresh</button>
              </div>
            </div>

            {encounterId && (
              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-5">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Total</div>
                  <div className="text-xl font-bold text-slate-900">Rs{total.toFixed(0)}</div>
                </div>
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-rose-700 font-bold">Outstanding</div>
                  <div className="text-xl font-bold text-rose-700">Rs{outstandingBeforeAdvance.toFixed(0)}</div>
                </div>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-emerald-700 font-bold">Paid</div>
                  <div className="text-xl font-bold text-emerald-700">Rs{paid.toFixed(0)}</div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Advance</div>
                  <div className="text-xl font-bold text-slate-900">Rs{advanceTotal.toFixed(0)}</div>
                  {advanceRemaining > 0 && <div className="text-[10px] font-medium text-indigo-600">Credit: Rs{advanceRemaining.toFixed(0)}</div>}
                </div>
                <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-indigo-700 font-bold">Net Due</div>
                  <div className="text-xl font-bold text-indigo-700">Rs{netDue.toFixed(0)}</div>
                </div>
              </div>
            )}

            {advances.length > 0 && (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-slate-700">Advances</div>
                  <div className="font-bold text-slate-900">Rs{advanceTotal.toFixed(0)}</div>
                </div>
                {advanceRemaining > 0 && (
                  <div className="mt-1 text-xs text-indigo-600 font-medium">Remaining credit: Rs{advanceRemaining.toFixed(0)}</div>
                )}
                <div className="mt-2 overflow-x-auto text-xs">
                  <table className="min-w-full">
                    <thead className="text-slate-500 font-medium">
                      <tr>
                        <th className="px-2 py-1 text-left">Date</th>
                        <th className="px-2 py-1 text-left">Ref</th>
                        <th className="px-2 py-1 text-left">Notes</th>
                        <th className="px-2 py-1 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {advances.map((a: any) => (
                        <tr key={String(a._id || a.id)}>
                          <td className="px-2 py-1">{a.receivedAt ? new Date(a.receivedAt).toLocaleString() : '-'}</td>
                          <td className="px-2 py-1">{a.refNo || '-'}</td>
                          <td className="px-2 py-1">{a.notes || '-'}</td>
                          <td className="px-2 py-1 text-right">Rs{Number(a.amount || 0).toFixed(0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {!encounterId ? (
              <div className="mt-3 text-sm text-rose-600">{loadingEnc ? 'Loading encounter…' : 'Encounter not found for this token.'}</div>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-700">
                    <tr>
                      <th className="px-3 py-2 font-medium">Date</th>
                      <th className="px-3 py-2 font-medium">Service</th>
                      <th className="px-3 py-2 font-medium">Qty</th>
                      <th className="px-3 py-2 font-medium">Rate</th>
                      <th className="px-3 py-2 font-medium">Amount</th>
                      <th className="px-3 py-2 font-medium">Paid</th>
                      <th className="px-3 py-2 font-medium">Remaining</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {loadingCharges ? (
                      <tr><td colSpan={9} className="px-3 py-6 text-center text-slate-500">Loading…</td></tr>
                    ) : chargesWithAlloc.length === 0 ? (
                      <tr><td colSpan={9} className="px-3 py-6 text-center text-slate-500">No services added.</td></tr>
                    ) : chargesWithAlloc.map((c: any) => (
                      <tr key={c.id}>
                        <td className="px-3 py-2 text-xs text-slate-500">{c.date ? new Date(c.date).toLocaleString() : '-'}</td>
                        <td className="px-3 py-2">{c.description}</td>
                        <td className="px-3 py-2">{c.qty}</td>
                        <td className="px-3 py-2">Rs{Number(c.unitPrice||0).toFixed(0)}</td>
                        <td className="px-3 py-2 font-medium">Rs{Number(c.amount||0).toFixed(0)}</td>
                        <td className="px-3 py-2">Rs{Number(c.rowPaid||0).toFixed(0)}</td>
                        <td className="px-3 py-2">Rs{Number(c.rowRemaining||0).toFixed(0)}</td>
                        <td className="px-3 py-2">
                          <span className={c.rowStatus==='Paid' ? 'rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700' : c.rowStatus==='Partial' ? 'rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700' : 'rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700'}>
                            {c.rowStatus}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            {!c.rowRemaining || c.rowRemaining <= 0 ? (
                               <span className="text-xs text-slate-400 font-medium">Fully Settled</span>
                            ) : (
                              <>
                                <button
                                  onClick={()=>setEditCharge({ id: c.id, description: c.description, qty: c.qty, unitPrice: c.unitPrice })}
                                  className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
                                >
                                  Edit
                                </button>
                                {advanceTotal > 0 && (
                                  <button
                                    onClick={()=>settleFromAdvance(c.rowRemaining, c.description)}
                                    className="rounded-md border border-indigo-300 bg-indigo-50 px-2 py-1 text-xs text-indigo-700 hover:bg-indigo-100"
                                  >
                                    Settle from Advance
                                  </button>
                                )}
                              </>
                            )}
                            <button
                              onClick={async()=>{
                                setConfirmDel({ open: true, chargeId: c.id })
                              }}
                              className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-3 flex items-center justify-end gap-3 text-sm">
                  <div className="text-slate-600">Total</div>
                  <div className="text-base font-semibold text-slate-900">Rs{Number(total||0).toFixed(0)}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {editCharge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <form
            onSubmit={async (e)=>{
              e.preventDefault()
              try{
                const fd = new FormData(e.currentTarget)
                const description = String(fd.get('description') || '').trim()
                const qty = Number(fd.get('qty') || 1)
                const unitPrice = Number(fd.get('unitPrice') || 0)
                if (!description){ setToast({ type: 'error', message: 'Service is required' }); return }
                await hospitalApi.updateErCharge(editCharge.id, { description, qty, unitPrice })
                setEditCharge(null)
                await reloadCharges()
                await reloadBillingSummary()
                setToast({ type: 'success', message: 'Service updated' })
              }catch(err:any){
                setToast({ type: 'error', message: err?.message || 'Failed to update service' })
              }
            }}
            className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/5"
          >
            <div className="border-b border-slate-200 px-5 py-3 font-semibold text-slate-800">Edit Service</div>
            <div className="space-y-3 px-5 py-4 text-sm">
              <label className="block text-xs font-medium text-slate-600">Service</label>
              <input
                name="description"
                defaultValue={editCharge.description}
                placeholder="Select or type service"
                list="er-service-suggestions"
                className="w-full rounded-md border border-slate-300 px-3 py-2"
                onChange={(e)=>{
                  try{
                    const v = String(e.currentTarget.value||'').trim().toLowerCase()
                    const m = svcCatalog.find(s => String(s.name||'').trim().toLowerCase() === v)
                    if (!m) return
                    const form = e.currentTarget.form
                    const amtEl = form?.querySelector<HTMLInputElement>('input[name="unitPrice"]')
                    if (amtEl && (!amtEl.value || Number(amtEl.value) === 0)) amtEl.value = String(m.price || 0)
                  }catch{}
                }}
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600">Qty</label>
                  <input name="qty" type="number" defaultValue={editCharge.qty} className="w-full rounded-md border border-slate-300 px-3 py-2" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600">Rate</label>
                  <input name="unitPrice" type="number" defaultValue={editCharge.unitPrice} className="w-full rounded-md border border-slate-300 px-3 py-2" />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
              <button type="button" onClick={()=>setEditCharge(null)} className="btn-outline-navy">Cancel</button>
              <button type="submit" className="btn">Save</button>
            </div>
          </form>
        </div>
      )}

      {confirmDel?.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/5">
            <div className="border-b border-slate-200 px-5 py-3 font-semibold text-slate-800">Confirm</div>
            <div className="px-5 py-4 text-sm text-slate-700">Delete this service charge?</div>
            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
              <button type="button" onClick={()=>setConfirmDel(null)} className="btn-outline-navy">Cancel</button>
              <button
                type="button"
                onClick={async()=>{
                  const id = confirmDel.chargeId
                  setConfirmDel(null)
                  try{
                    await hospitalApi.deleteErCharge(id)
                    await reloadCharges()
                    await reloadBillingSummary()
                    setToast({ type: 'success', message: 'Deleted' })
                  }catch(e:any){
                    setToast({ type: 'error', message: e?.message || 'Failed to delete' })
                  }
                }}
                className="btn"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {openCharge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <form
            data-er-charge-form="true"
            onSubmit={async (e)=>{
              e.preventDefault()
              if (!encounterId) return
              const fd = new FormData(e.currentTarget)
              const description = String(fd.get('description') || '').trim()
              const qty = Number(fd.get('qty') || 1)
              const unitPrice = Number(fd.get('unitPrice') || 0)
              if (!description){ setToast({ type: 'error', message: 'Service is required' }); return }
              try{
                await hospitalApi.createErCharge(encounterId, { description, qty, unitPrice, billedBy: 'hospital' })
                setOpenCharge(false)
                await reloadCharges()
                await reloadBillingSummary()
                setToast({ type: 'success', message: 'Service added' })
              }catch(e: any){
                setToast({ type: 'error', message: e?.message || 'Failed to add service' })
              }
            }}
            className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/5"
          >
            <div className="border-b border-slate-200 px-5 py-3 font-semibold text-slate-800">Add Service</div>
            <div className="space-y-3 px-5 py-4 text-sm">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Service</label>
                <ServiceSelect
                  svcCatalog={svcCatalog}
                  onSelect={(svc) => {
                    const form = document.querySelector('form[data-er-charge-form="true"]')
                    if (!form) return
                    const rateEl = form.querySelector<HTMLInputElement>('input[name="unitPrice"]')
                    if (rateEl) rateEl.value = String(svc.price || 0)
                  }}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600">Qty</label>
                  <input name="qty" type="number" defaultValue={1} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600">Rate</label>
                  <input name="unitPrice" type="number" defaultValue={0} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
              <button type="button" onClick={()=>setOpenCharge(false)} className="btn-outline-navy">Cancel</button>
              <button type="submit" className="btn">Add</button>
            </div>
          </form>
        </div>
      )}

      {showReferralDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
              <div className="font-semibold text-slate-800">Refer to IPD</div>
              <button
                type="button"
                onClick={() => setShowReferralDialog(false)}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5">
              <Doctor_IpdReferralForm
                mrn={mrn || ''}
                onSaved={() => {
                  setShowReferralDialog(false)
                  setToast({ type: 'success', message: 'IPD referral created successfully' })
                }}
              />
            </div>
          </div>
        </div>
      )}

      {openAdvance && (
        <AdvanceDialog open={openAdvance} onClose={()=>setOpenAdvance(false)} onSave={saveAdvance} />
      )}

      {toast && (
        <div className="fixed right-4 top-16 z-[60] max-w-sm">
          <div className={toast.type==='success' ? 'rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 shadow' : toast.type==='error' ? 'rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 shadow' : 'rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow'}>
            <div className="flex items-start justify-between gap-3">
              <div>{toast.message}</div>
              <button type="button" className="text-slate-500 hover:text-slate-700" onClick={()=>setToast(null)}>×</button>
            </div>
          </div>
        </div>
      )}
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
