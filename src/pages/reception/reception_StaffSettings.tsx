import { useEffect, useMemo, useState } from 'react'
import { receptionApi } from '../../utils/api'

type Shift = {
  id: string
  name: string
  start: string
  end: string
}

export default function Reception_StaffSettings(){
  const [shifts, setShifts] = useState<Shift[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(()=>{
    let mounted = true
    ;(async () => {
      try {
        const res = await receptionApi.listShifts()
        if (!mounted) return
        const mapped: Shift[] = (res.items||[]).map((x:any)=>({
          id: x._id,
          name: x.name,
          start: x.start,
          end: x.end,
        }))
        setShifts(mapped)
      } catch(e){ console.error(e) }
    })()
    return ()=>{ mounted = false }
  }, [])

  const update = (i: number, patch: Partial<Shift>) => {
    setShifts(s => { const next = [...s]; next[i] = { ...next[i], ...patch } as Shift; return next })
  }

  const addShift = async () => {
    const created = await receptionApi.createShift({ name: `Shift ${shifts.length+1}`, start: '09:00', end: '17:00' })
    setShifts(s => [...s, {
      id: created._id,
      name: created.name,
      start: created.start,
      end: created.end,
    }])
  }
  const removeShift = async (id: string) => {
    await receptionApi.deleteShift(id)
    setShifts(s => s.filter(x=>x.id!==id))
  }

  const save = async () => {
    setSaving(true)
    try {
      await Promise.all(shifts.map(sh => receptionApi.updateShift(sh.id, {
        name: sh.name,
        start: sh.start,
        end: sh.end,
      })))
    } finally {
      setTimeout(()=>setSaving(false), 300)
    }
  }

  const total = useMemo(()=> shifts.length, [shifts.length])

  return (
    <div className="space-y-4">
      <div className="text-xl font-bold text-slate-800 dark:text-slate-100">Staff Settings</div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <div className="text-lg font-semibold text-slate-800 dark:text-slate-100">Shifts</div>
          <div className="ml-auto text-sm text-slate-600 dark:text-slate-400">Total: {total}</div>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shifts.map((sh, i)=> (
            <div key={sh.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <input value={sh.name} onChange={e=>update(i,{ name: e.target.value })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100" placeholder="Shift name" />
                <button onClick={()=>removeShift(sh.id)} className="rounded-md border border-rose-200 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-900/30">Remove</button>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <label className="block">
                  <span className="block text-xs text-slate-600 dark:text-slate-400">Start</span>
                  <input type="time" value={sh.start} onChange={e=>update(i,{ start: e.target.value })} className="w-full rounded-md border border-slate-300 px-2 py-1 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100" />
                </label>
                <label className="block">
                  <span className="block text-xs text-slate-600 dark:text-slate-400">End</span>
                  <input type="time" value={sh.end} onChange={e=>update(i,{ end: e.target.value })} className="w-full rounded-md border border-slate-300 px-2 py-1 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100" />
                </label>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button onClick={addShift} className="btn-outline-navy">Add Shift</button>
          <button onClick={save} disabled={saving} className="btn disabled:opacity-50">{saving? 'Saving...' : 'Save Shifts'}</button>
        </div>
        <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">Tip: Night shift that ends next day is supported by using an end time smaller than start time (e.g., 20:00 to 08:00).</div>
      </div>
    </div>
  )
}
