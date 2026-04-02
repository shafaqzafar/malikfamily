import React, { useEffect, useMemo, useRef, useState } from 'react'
import { hospitalApi } from '../../utils/api'
import Toast, { type ToastState } from '../ui/Toast'

function ServiceSelect({ svcCatalog, onSelect, initialValue = '' }: { svcCatalog: any[], onSelect: (svc: any) => void, initialValue?: string }) {
  const [q, setQ] = useState(initialValue)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    const s = q.toLowerCase().trim()
    if (!s) return svcCatalog
    return svcCatalog.filter(svc => (svc.label || svc.name || '').toLowerCase().includes(s))
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
        name="label"
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
              key={svc.id || svc._id || svc.label}
              type="button"
              className="w-full px-3 py-2 text-left hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
              onClick={() => {
                onSelect(svc)
                setQ(svc.label || svc.name)
                setOpen(false)
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-900">{svc.label || svc.name}</span>
                <span className="text-xs text-slate-500">Rs{svc.amount || svc.price}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Billing({ encounterId }: { encounterId: string }){
  const [charges, setCharges] = useState<Array<{ id: string; label: string; amount: number; paidAmount: number; remaining: number }>>([])
  const [payments, setPayments] = useState<Array<{ id: string; amount: number; method?: string; refNo?: string; receivedAt?: string; notes?: string }>>([])
  const [open, setOpen] = useState(false)
  const [openAdvance, setOpenAdvance] = useState(false)
  const [toast, setToast] = useState<ToastState>(null)

  useEffect(()=>{ if(encounterId){ reload() } }, [encounterId])

  async function reload(){
    try{
      const [bi, pay] = await Promise.all([
        hospitalApi.listIpdBillingItems(encounterId, { limit: 500 }) as any,
        hospitalApi.listIpdPayments(encounterId, { limit: 500 }) as any,
      ])
      const crows = (bi.items || []).map((i: any)=>({ id: String(i._id), label: i.description || '', amount: Number(i.amount || 0), paidAmount: Number(i.paidAmount || 0), remaining: Number(i.remaining != null ? i.remaining : Math.max(0, Number(i.amount||0)-Number(i.paidAmount||0))) }))
      const prows = (pay.payments || []).map((p: any)=>({
        id: String(p._id),
        amount: Number(p.amount || 0),
        method: p.method,
        refNo: p.refNo,
        receivedAt: p.receivedAt,
        notes: p.notes,
      }))
      setCharges(crows); setPayments(prows)
    }catch{}
  }

  const total = charges.reduce((a,c)=>a+c.amount,0)
  const advances = payments.filter(p => String(p.method || '').toLowerCase() === 'advance')
  const settlements = payments.filter(p => String(p.method || '').toLowerCase() === 'advance settlement')
  const nonAdvancePayments = payments.filter(p => !['advance', 'advance settlement'].includes(String(p.method || '').toLowerCase()))
  
  const advanceTotalRaw = advances.reduce((s, p) => s + Number(p.amount || 0), 0)
  const settlementTotal = settlements.reduce((s, p) => s + Number(p.amount || 0), 0)
  
  const advanceTotal = Math.max(0, advanceTotalRaw - settlementTotal)
  const paid = nonAdvancePayments.reduce((a,c)=>a+c.amount,0) + settlementTotal
  
  const outstandingBeforeAdvance = Math.max(0, total - paid)
  const advanceUsed = Math.min(advanceTotal, outstandingBeforeAdvance)
  const advanceRemaining = Math.max(0, advanceTotal - advanceUsed)
  const netDue = Math.max(0, outstandingBeforeAdvance - advanceUsed)

  async function save(d: { label: string; amount: number }){
    try{
      await hospitalApi.createIpdBillingItem(encounterId, { type: 'service', description: d.label, qty: 1, unitPrice: d.amount, amount: d.amount })
      setOpen(false); await reload()
      setToast({ type: 'success', message: 'Charge added' })
    }catch(e: any){ setToast({ type: 'error', message: e?.message || 'Failed to add charge' }) }
  }

  async function markPaid(amount: number){
    if (outstandingBeforeAdvance <= 0) return
    const amt = Number(amount || 0)
    if (amt <= 0) return
    if (amt > outstandingBeforeAdvance){ setToast({ type: 'error', message: 'Cannot pay more than outstanding' }); return }
    try{ await hospitalApi.createIpdPayment(encounterId, { amount: amt }); await reload(); setToast({ type: 'success', message: 'Payment recorded' }) }catch(e: any){ setToast({ type: 'error', message: e?.message || 'Failed to record payment' }) }
  }

  async function saveAdvance(d: { amount: number; method: string; refNo?: string; notes?: string }){
    const amt = Number(d.amount || 0)
    if (amt <= 0){ setToast({ type: 'error', message: 'Advance amount must be greater than 0' }); return }
    try{
      await hospitalApi.createIpdPayment(encounterId, {
        amount: amt,
        method: 'Advance',
        refNo: d.refNo || '',
        notes: d.notes || '',
        receivedBy: d.method || '',
      } as any)
      setOpenAdvance(false)
      await reload()
      setToast({ type: 'success', message: 'Advance recorded' })
    }catch(e: any){ setToast({ type: 'error', message: e?.message || 'Failed to record advance' }) }
  }

  async function settleFromAdvance(amount: number, chargeLabel: string){
    if (advanceRemaining <= 0) { setToast({ type: 'error', message: 'No advance credit available' }); return }
    const amt = Math.min(amount, advanceRemaining)
    try{
      await hospitalApi.createIpdPayment(encounterId, { 
        amount: amt, 
        method: 'Advance Settlement',
        notes: `Settled for: ${chargeLabel}`
      } as any)
      await reload()
      setToast({ type: 'success', message: 'Settled from advance' })
    }catch(e: any){ setToast({ type: 'error', message: e?.message || 'Failed to settle' }) }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs font-medium text-slate-700">Total</div>
          <div className="text-2xl font-bold text-slate-900">Rs{total.toFixed(0)}</div>
        </div>
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
          <div className="text-xs font-medium text-rose-700">Outstanding</div>
          <div className="text-2xl font-bold text-rose-700">Rs{outstandingBeforeAdvance.toFixed(0)}</div>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <div className="text-xs font-medium text-emerald-700">Paid</div>
          <div className="text-2xl font-bold text-emerald-700">Rs{paid.toFixed(0)}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs font-medium text-slate-700">Advance</div>
          <div className="text-2xl font-bold text-slate-900">Rs{advanceTotal.toFixed(0)}</div>
          {advanceRemaining > 0 && (
            <div className="mt-1 text-xs text-slate-600">Remaining credit: Rs{advanceRemaining.toFixed(0)}</div>
          )}
        </div>
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
          <div className="text-xs font-medium text-indigo-700">Net Due</div>
          <div className="text-2xl font-bold text-indigo-700">Rs{netDue.toFixed(0)}</div>
        </div>
      </div>

      {advances.length > 0 && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
          <div className="flex items-center justify-between">
            <div className="font-medium text-slate-700">Advances</div>
            <div className="font-semibold text-slate-900">Rs{advanceTotal.toFixed(0)}</div>
          </div>
          <div className="mt-2 overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="text-slate-600">
                <tr>
                  <th className="px-2 py-1 font-medium">Date</th>
                  <th className="px-2 py-1 font-medium">Ref</th>
                  <th className="px-2 py-1 font-medium">Notes</th>
                  <th className="px-2 py-1 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {advances.map(a => (
                  <tr key={a.id}>
                    <td className="px-2 py-1">{a.receivedAt ? new Date(String(a.receivedAt)).toLocaleString() : '-'}</td>
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

      <div className="mt-4 overflow-x-auto">
        {charges.length === 0 ? (
          <div className="text-slate-500">No billing entries yet.</div>
        ) : (
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="px-3 py-2 font-medium">Label</th>
                <th className="px-3 py-2 font-medium">Amount</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {charges.map(c => {
                const isFullyPaid = c.remaining <= 0 && c.paidAmount > 0
                const isPartiallyPaid = c.paidAmount > 0 && c.remaining > 0
                const isUnpaid = c.paidAmount <= 0
                const disabled = c.remaining <= 0
                return (
                  <tr key={c.id}>
                    <td className="px-3 py-2">{c.label}</td>
                    <td className="px-3 py-2">Rs{c.amount.toFixed(0)}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        {isFullyPaid && (
                          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">Paid</span>
                        )}
                        {isPartiallyPaid && (
                          <>
                            <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700">Partial</span>
                            <span className="text-xs text-slate-500">Rs{c.remaining.toFixed(0)} remaining</span>
                          </>
                        )}
                        {isUnpaid && (
                          <button disabled={disabled} onClick={()=>markPaid(c.amount)} className={`rounded-md border border-slate-300 px-2 py-1 text-xs ${disabled? 'opacity-50 cursor-not-allowed':''}`}>{disabled? 'Paid' : 'Mark as Paid'}</button>
                        )}
                        {!disabled && advanceTotal > 0 && c.remaining > 0 && (
                          <button onClick={()=>settleFromAdvance(c.remaining, c.label)} className="rounded-md border border-indigo-300 bg-indigo-50 px-2 py-1 text-xs text-indigo-700 hover:bg-indigo-100">Settle from Advance</button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
      <div className="mt-3">
        <div className="flex flex-wrap gap-2">
          <button onClick={()=>setOpen(true)} className="btn">Add Charge</button>
          <button onClick={()=>setOpenAdvance(true)} className="btn-outline-navy">Add Advance</button>
          {advanceTotal > 0 && outstandingBeforeAdvance > 0 && (
            <button onClick={()=>settleFromAdvance(outstandingBeforeAdvance, 'Full Outstanding')} className="btn-outline-navy border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100">Settle All from Advance</button>
          )}
        </div>
      </div>
      <ChargeDialog open={open} onClose={()=>setOpen(false)} onSave={save} />
      <AdvanceDialog open={openAdvance} onClose={()=>setOpenAdvance(false)} onSave={saveAdvance} />
      <Toast toast={toast} onClose={()=>setToast(null)} />
    </div>
  )
}

function ChargeDialog({ open, onClose, onSave }: { open: boolean; onClose: ()=>void; onSave: (d: { label: string; amount: number })=>void }){
  if(!open) return null
  const [svcCatalog, setSvcCatalog] = useState<any[]>([])

  useEffect(() => {
    let cancelled = false
    async function loadSvc(){
      try{
        const res: any = await hospitalApi.listErServices({ active: true, limit: 500 })
        const rows: any[] = res?.services || []
        if (cancelled) return
        setSvcCatalog(rows.map((r:any)=>({ id: String(r._id||r.id), label: String(r.name||''), amount: Number(r.price||0) })))
      }catch{
        if (!cancelled) setSvcCatalog([])
      }
    }
    loadSvc()
    return ()=>{ cancelled = true }
  }, [])

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    onSave({ label: String(fd.get('label')||''), amount: parseFloat(String(fd.get('amount')||'0')) || 0 })
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <form data-charge-form="true" onSubmit={submit} className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/5">
        <div className="border-b border-slate-200 px-5 py-3 font-semibold text-slate-800">Add Charge</div>
        <div className="space-y-3 px-5 py-4 text-sm">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Label</label>
            <ServiceSelect
              svcCatalog={svcCatalog}
              onSelect={(svc) => {
                const form = document.querySelector('form[data-charge-form="true"]')
                if (!form) return
                const amtEl = form.querySelector<HTMLInputElement>('input[name="amount"]')
                if (amtEl) amtEl.value = String(svc.amount || svc.price || 0)
              }}
            />
          </div>
          <label htmlFor="charge-amount" className="block text-xs font-medium text-slate-600">Amount</label>
          <input id="charge-amount" name="amount" type="number" step="0.01" placeholder="e.g. 1000" className="w-full rounded-md border border-slate-300 px-3 py-2" />
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <button type="button" onClick={onClose} className="btn-outline-navy">Cancel</button>
          <button type="submit" className="btn">Save</button>
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
