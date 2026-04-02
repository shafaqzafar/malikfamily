import { useMemo, useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import Diagnostic_TokenSlip from '../../components/diagnostic/Diagnostic_TokenSlip'
import type { DiagnosticTokenSlipData } from '../../components/diagnostic/Diagnostic_TokenSlip'
import { corporateApi, diagnosticApi, hospitalApi, labApi, receptionApi } from '../../utils/api'
import Toast from '../../components/ui/Toast'

type SearchOption = { value: string; label: string }
function MultiSelect({ options, selectedIds, onToggle, placeholder }: { options: SearchOption[]; selectedIds: string[]; onToggle: (id: string) => void; placeholder?: string }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current) return
      if (!ref.current.contains(e.target as any)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return options.filter(o => !q || o.label.toLowerCase().includes(q)).slice(0, 100)
  }, [options, query])
  const selectedLabels = useMemo(() => {
    return selectedIds.map(id => options.find(o => o.value === id)?.label).filter(Boolean)
  }, [options, selectedIds])
  return (
    <div ref={ref} className="relative">
      <div
        onClick={() => setOpen(o => !o)}
        className="w-full min-h-[42px] rounded-md border border-slate-300 px-3 py-2 cursor-pointer flex flex-wrap gap-1 items-center dark:bg-slate-900 dark:border-slate-700"
      >
        {selectedLabels.length > 0 ? (
          selectedLabels.map((label, idx) => (
            <span key={idx} className="inline-flex items-center gap-1 rounded bg-violet-100 px-2 py-0.5 text-xs dark:bg-violet-900/30 dark:text-violet-300">
              {label}
              <button type="button" onClick={e => { e.stopPropagation(); onToggle(selectedIds[idx]) }} className="hover:text-violet-700">×</button>
            </span>
          ))
        ) : (
          <span className="text-slate-400 dark:text-slate-500">{placeholder || 'Select...'}</span>
        )}
        <span className="ml-auto text-slate-500">▾</span>
      </div>
      {open && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg dark:bg-slate-800 dark:border-slate-700">
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search..."
            className="w-full border-b border-slate-200 px-3 py-2 text-sm outline-none dark:bg-slate-900 dark:border-slate-700 dark:text-white"
            onClick={e => e.stopPropagation()}
          />
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">No results</div>
          ) : filtered.map(opt => (
            <button
              type="button"
              key={String(opt.value)}
              onClick={() => onToggle(String(opt.value))}
              className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50"
            >
              <div className="text-sm text-slate-800 dark:text-slate-200">{opt.label}</div>
              {selectedIds.includes(String(opt.value)) ? <span className="text-xs text-violet-600">✓</span> : null}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Diagnostic_TokenGenerator() {
  const location = useLocation() as any
  const navState = (location && (location.state || null)) || null
  // Patient details
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [mrn, setMrn] = useState('')
  const [age, setAge] = useState('')
  const [gender, setGender] = useState('')
  const [guardianRel, setGuardianRel] = useState('')
  const [guardianName, setGuardianName] = useState('')
  const [cnic, setCnic] = useState('')
  const [address, setAddress] = useState('')
  // Referral context (optional)
  const [fromReferralId, setFromReferralId] = useState<string>('')
  const [requestedTests, setRequestedTests] = useState<string[]>([])
  const [referringConsultant, setReferringConsultant] = useState('')

  // Tests (from backend)
  type Test = { id: string; name: string; price: number }
  const [tests, setTests] = useState<Test[]>([])
  const [selected, setSelected] = useState<string[]>([])
  useEffect(() => {
    let mounted = true
      ; (async () => {
        try {
          const res = await diagnosticApi.listTests({ limit: 1000 }) as any
          const arr = (res?.items || res || []).map((t: any) => ({ id: String(t._id || t.id), name: t.name, price: Number(t.price || 0) }))
          if (mounted) setTests(arr)
        } catch { if (mounted) setTests([]) }
      })()
    return () => { mounted = false }
  }, [])
  // Apply navState patient autofill and requested tests
  useEffect(() => {
    try {
      const st = navState || {}
      if (st?.patient) {
        const p = st.patient
        if (p.fullName) setFullName(String(p.fullName))
        if (p.phone) setPhone(String(p.phone))
        if (p.mrn) setMrn(String(p.mrn))
        if (p.gender) setGender(String(p.gender))
        if (p.address) setAddress(String(p.address))
        if (p.fatherName) setGuardianName(String(p.fatherName))
        if (p.guardianRelation) setGuardianRel(String(p.guardianRelation))
        if (p.cnic) setCnic(String(p.cnic))
      }
      if (Array.isArray(st?.requestedTests)) setRequestedTests(st.requestedTests.map((x: any) => String(x)))
      if (st?.fromReferralId) setFromReferralId(String(st.fromReferralId))
      if (st?.referringConsultant) setReferringConsultant(String(st.referringConsultant))
    } catch { }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location?.key])

  // Phone-based autofill (moved out of effect for global scope)
  async function autoFillByPhone(phoneNumber: string) {
    const digits = (phoneNumber || '').replace(/\D+/g, '')
    if (!digits || digits.length < 10) return
    try {
      const r: any = await labApi.searchPatients({ phone: digits, limit: 10 })
      const list: any[] = Array.isArray(r?.patients) ? r.patients : []
      if (list.length > 1) {
        setPhonePatients(list)
        setShowPhonePicker(true)
      } else if (list.length === 1) {
        const p = list[0]
        setSelectedPatient(p)
        setFullName(p.fullName || '')
        setPhone(p.phoneNormalized || '')
        setMrn(p.mrn || mrn)
        setAge((p.age != null && p.age !== '') ? String(p.age) : '')
        if (p.gender) setGender(String(p.gender))
        setGuardianName(p.fatherName || '')
        if (p.guardianRel) setGuardianRel(String(p.guardianRel))
        setAddress(p.address || '')
        setCnic(p.cnicNormalized || p.cnic || '')
      }
    } catch { }
  }

  function onPhoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    setPhone(v)
    skipLookupKeyRef.current = null; lastPromptKeyRef.current = null
      ; (window as any)._diagPhoneDeb && clearTimeout((window as any)._diagPhoneDeb)
    const digits = (v || '').replace(/\D+/g, '')
    // Incremental suggestions after 3+ digits
    if ((window as any)._diagPhoneSuggestDeb) clearTimeout((window as any)._diagPhoneSuggestDeb)
    if (digits.length >= 3) {
      ; (window as any)._diagPhoneSuggestDeb = setTimeout(() => runPhoneSuggestLookup(digits), 250)
    } else {
      setPhoneSuggestItems([])
      setPhoneSuggestOpen(false)
    }
    if (digits.length >= 10) {
      ; (window as any)._diagPhoneDeb = setTimeout(() => autoFillByPhone(v), 500)
    }
  }

  async function runPhoneSuggestLookup(digits: string) {
    try {
      phoneSuggestQueryRef.current = digits
      const r: any = await labApi.searchPatients({ phone: digits, limit: 8 })
      const list: any[] = Array.isArray(r?.patients) ? r.patients : []
      if (phoneSuggestQueryRef.current !== digits) return
      setPhoneSuggestItems(list)
      setPhoneSuggestOpen(list.length > 0)
    } catch {
      setPhoneSuggestItems([])
      setPhoneSuggestOpen(false)
    }
  }

  function selectPhoneSuggestion(p: any) {
    setSelectedPatient(p)
    setFullName(p.fullName || '')
    setPhone(p.phoneNormalized || '')
    setMrn(p.mrn || mrn)
    setAge((p.age != null && p.age !== '') ? String(p.age) : '')
    if (p.gender) setGender(String(p.gender))
    setGuardianName(p.fatherName || '')
    if (p.guardianRel) setGuardianRel(String(p.guardianRel))
    setAddress(p.address || '')
    setCnic(p.cnicNormalized || p.cnic || '')
    setPhoneSuggestOpen(false)
  }

  async function runNameSuggestLookup(nameQuery: string) {
    try {
      nameSuggestQueryRef.current = nameQuery
      const r: any = await labApi.searchPatients({ name: nameQuery, limit: 8 })
      const list: any[] = Array.isArray(r?.patients) ? r.patients : []
      if (nameSuggestQueryRef.current !== nameQuery) return
      setNameSuggestItems(list)
      setNameSuggestOpen(list.length > 0)
    } catch {
      setNameSuggestItems([])
      setNameSuggestOpen(false)
    }
  }

  function selectNameSuggestion(p: any) {
    setSelectedPatient(p)
    setFullName(p.fullName || '')
    setPhone(p.phoneNormalized || '')
    setMrn(p.mrn || mrn)
    setAge((p.age != null && p.age !== '') ? String(p.age) : '')
    if (p.gender) setGender(String(p.gender))
    setGuardianName(p.fatherName || '')
    if (p.guardianRel) setGuardianRel(String(p.guardianRel))
    setAddress(p.address || '')
    setCnic(p.cnicNormalized || p.cnic || '')
    setNameSuggestOpen(false)
  }

  function onNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newName = e.target.value
    setFullName(newName)
    skipLookupKeyRef.current = null
    lastPromptKeyRef.current = null
    setNameSuggestOpen(false)
    const trimmed = newName.trim()
    if (trimmed.length >= 2) {
      clearTimeout((window as any).diagNameSuggestTimeout)
        ; (window as any).diagNameSuggestTimeout = setTimeout(() => {
        runNameSuggestLookup(trimmed)
      }, 300)
    } else {
      setNameSuggestItems([])
      setNameSuggestOpen(false)
    }
  }
  // When tests list is loaded or requestedTests changes, preselect those tests
  useEffect(() => {
    if (!requestedTests.length || !tests.length) return
    const set = new Set(requestedTests.map(s => String(s).trim().toLowerCase()))
    const ids = tests.filter(t => set.has(String(t.name).trim().toLowerCase())).map(t => t.id)
    if (ids.length) {
      // don't duplicate existing selections
      setSelected(prev => Array.from(new Set([...prev, ...ids])))
    }
  }, [requestedTests, tests])
  // Corporate billing (declare early so it's available to pricing helpers)
  const [companies, setCompanies] = useState<Array<{ id: string; name: string }>>([])
  const [corpCompanyId, setCorpCompanyId] = useState('')
  const [corpPreAuthNo, setCorpPreAuthNo] = useState('')
  const [corpCoPayPercent, setCorpCoPayPercent] = useState('')
  const [corpCoverageCap] = useState('')
  // Corporate effective pricing map for DIAG tests
  const [corpTestPriceMap, setCorpTestPriceMap] = useState<Record<string, number>>({})


  const getEffectivePrice = (id: string): number => {
    const base = Number((tests.find(t => t.id === id)?.price) || 0)
    if (!corpCompanyId) return base
    const v = corpTestPriceMap[id]
    return v != null ? v : base
  }

  const selectedTests = useMemo(() => selected.map(id => tests.find(t => t.id === id)).filter(Boolean) as Test[], [selected, tests])
  const subtotal = useMemo(() => selectedTests.reduce((s, t) => s + getEffectivePrice(t.id), 0), [selectedTests, corpCompanyId, corpTestPriceMap])
  const [discount, setDiscount] = useState('0')
  const net = Math.max(0, subtotal - (Number(discount) || 0))
  const [receivedAmount, setReceivedAmount] = useState('0')
  const receivedNum = Math.max(0, Math.min(net, Number(receivedAmount) || 0))
  const receivableNum = Math.max(0, net - receivedNum)

  // Auto-set received amount to full net amount when tests are selected or net changes
  useEffect(() => {
    setReceivedAmount(String(net))
  }, [net])

  // Corporate billing (load companies)
  // Recompute corporate pricing after corpCompanyId is declared
  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!corpCompanyId) { setCorpTestPriceMap({}); return }
      try {
        const r = await corporateApi.listRateRules({ companyId: corpCompanyId, scope: 'DIAG' }) as any
        const rules: any[] = (r?.rules || []).filter((x: any) => x && x.active !== false)
        const today = new Date().toISOString().slice(0, 10)
        const valid = rules.filter((x: any) => (!x.effectiveFrom || String(x.effectiveFrom).slice(0, 10) <= today) && (!x.effectiveTo || today <= String(x.effectiveTo).slice(0, 10)))
        const def = valid.filter(x => x.ruleType === 'default').sort((a: any, b: any) => (a.priority ?? 100) - (b.priority ?? 100))[0] || null
        const apply = (base: number, rule: any) => {
          const mode = rule?.mode; const val = Number(rule?.value || 0)
          if (mode === 'fixedPrice') return Math.max(0, val)
          if (mode === 'percentDiscount') return Math.max(0, base - (base * (val / 100)))
          if (mode === 'fixedDiscount') return Math.max(0, base - val)
          return base
        }
        const map: Record<string, number> = {}
        for (const t of tests) {
          const base = Number(t.price || 0)
          const specific = valid.filter(x => x.ruleType === 'test' && String(x.refId) === String(t.id)).sort((a: any, b: any) => (a.priority ?? 100) - (b.priority ?? 100))[0] || null
          const rule = specific || def
          map[t.id] = rule ? apply(base, rule) : base
        }
        if (!cancelled) setCorpTestPriceMap(map)
      } catch { if (!cancelled) setCorpTestPriceMap({}) }
    }
    load()
    return () => { cancelled = true }
  }, [corpCompanyId, tests])
  useEffect(() => {
    let mounted = true
      ; (async () => {
        try {
          const res = await corporateApi.listCompanies() as any
          if (!mounted) return
          const arr = (res?.companies || []).map((c: any) => ({ id: String(c._id || c.id), name: c.name }))
          setCompanies(arr)
        } catch { }
      })()
    return () => { mounted = false }
  }, [])

  // Selected existing patient (from Lab_Patient collection)
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null)
  const [confirmPatient, setConfirmPatient] = useState<null | { summary: string; patient: any; key: string }>(null)
  const [focusAfterConfirm, setFocusAfterConfirm] = useState<null | 'phone' | 'name'>(null)
  const phoneRef = useRef<HTMLInputElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const skipLookupKeyRef = useRef<string | null>(null)
  const lastPromptKeyRef = useRef<string | null>(null)
  const autoMrnAppliedRef = useRef<boolean>(false)
  const [phonePatients, setPhonePatients] = useState<any[]>([])
  const [showPhonePicker, setShowPhonePicker] = useState(false)
  const [phoneSuggestOpen, setPhoneSuggestOpen] = useState(false)
  const [phoneSuggestItems, setPhoneSuggestItems] = useState<any[]>([])
  const phoneSuggestWrapRef = useRef<HTMLDivElement>(null)
  const phoneSuggestQueryRef = useRef<string>('')

  // Track if user explicitly chose to create new patient (to force creation even if phone exists)
  const [forceCreatePatient, setForceCreatePatient] = useState(false)

  // Toast notifications
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null)

  // Name search suggestions
  const [nameSuggestOpen, setNameSuggestOpen] = useState(false)
  const [nameSuggestItems, setNameSuggestItems] = useState<any[]>([])
  const nameSuggestWrapRef = useRef<HTMLDivElement>(null)
  const nameSuggestQueryRef = useRef<string>('')

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!phoneSuggestWrapRef.current) return
      if (!phoneSuggestWrapRef.current.contains(e.target as any)) setPhoneSuggestOpen(false)
      if (!nameSuggestWrapRef.current) return
      if (!nameSuggestWrapRef.current.contains(e.target as any)) setNameSuggestOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  // If coming from a referral and MRN is present, fetch full patient by MRN to prefill all fields
  useEffect(() => {
    if (autoMrnAppliedRef.current) return
    if (!fromReferralId || !mrn || selectedPatient) return
    let cancelled = false
      ; (async () => {
        try {
          const r: any = await labApi.getPatientByMrn(mrn)
          if (cancelled) return
          const p = r?.patient || r
          if (!p) return
          setSelectedPatient(p)
          setFullName(p.fullName || '')
          setPhone(p.phoneNormalized || '')
          setMrn(p.mrn || mrn)
          setAge((p.age != null && p.age !== '') ? String(p.age) : '')
          if (p.gender) setGender(String(p.gender))
          setGuardianName(p.fatherName || '')
          if (p.guardianRel) {
            const g = String(p.guardianRel).toUpperCase()
            const mapped = (g === 'FATHER' || g === 'S/O' || g === 'SON') ? 'S/O' : ((g === 'MOTHER' || g === 'D/O' || g === 'DAUGHTER') ? 'D/O' : g)
            setGuardianRel(mapped)
          }
          setAddress(p.address || '')
          setCnic(p.cnicNormalized || p.cnic || '')
          autoMrnAppliedRef.current = true
        } catch { }
      })()
    return () => { cancelled = true }
  }, [fromReferralId, mrn, selectedPatient])

  // Slip modal
  const [slipOpen, setSlipOpen] = useState(false)
  const [slipData, setSlipData] = useState<DiagnosticTokenSlipData | null>(null)

  async function lookupExistingByPhoneAndName(source: 'phone' | 'name' = 'phone') {
    const digits = (phone || '').replace(/\D+/g, '')
    const nameEntered = (fullName || '').trim()
    if (!digits || !nameEntered) return
    try {
      const norm = (s: string) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ')
      const key = `${digits}|${norm(nameEntered)}`
      if (skipLookupKeyRef.current === key || lastPromptKeyRef.current === key) return
      const r: any = await labApi.searchPatients({ phone: digits, limit: 10 })
      const list: any[] = Array.isArray(r?.patients) ? r.patients : []
      if (!list.length) return
      const p = list.find(x => norm(x.fullName) === norm(nameEntered))
      if (!p) return // no exact name match; don't prompt
      const summary = [
        `Found existing patient. Apply details?`,
        `MRN: ${p.mrn || '-'}`,
        `Name: ${p.fullName || '-'}`,
        `Phone: ${p.phoneNormalized || digits}`,
        `Age: ${p.age ?? (age?.trim() || '-')}`,
        p.gender ? `Gender: ${p.gender}` : null,
        p.address ? `Address: ${p.address}` : null,
        p.fatherName ? `Guardian: ${p.fatherName}` : null,
        `Guardian Relation: ${p.guardianRel || (guardianRel || '-')}`,
        p.cnicNormalized ? `CNIC: ${p.cnicNormalized}` : null,
      ].filter(Boolean).join('\n')
      setTimeout(() => { setFocusAfterConfirm(source); lastPromptKeyRef.current = key; setConfirmPatient({ summary, patient: p, key }) }, 0)
    } catch { }
  }

  async function onMrnKeyDown(e: any) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const code = (mrn || '').trim()
    if (!code) return
    try {
      const r: any = await labApi.getPatientByMrn(code)
      const p = r?.patient || r
      if (!p) { alert('No patient found for this MR number'); return }
      setSelectedPatient(p)
      setFullName(p.fullName || '')
      setPhone(p.phoneNormalized || '')
      setMrn(p.mrn || code)
      setAge((p.age != null && p.age !== '') ? String(p.age) : '')
      if (p.gender) setGender(String(p.gender))
      setGuardianName(p.fatherName || '')
      if (p.guardianRel) {
        const g = String(p.guardianRel).toUpperCase()
        const mapped = (g === 'FATHER' || g === 'S/O' || g === 'SON') ? 'S/O' : ((g === 'MOTHER' || g === 'D/O' || g === 'DAUGHTER') ? 'D/O' : g)
        setGuardianRel(mapped)
      }
      setAddress(p.address || '')
      setCnic(p.cnicNormalized || p.cnic || '')
    } catch {
      setToast({ type: 'error', message: 'No patient found for this MR number' })
    }
  }

  const clearPatientFieldsKeepPhone = () => {
    setSelectedPatient(null)
    setFullName('')
    setMrn('')
    setAge('')
    setGender('')
    setGuardianRel('')
    setGuardianName('')
    setCnic('')
    setAddress('')
    setShowPhonePicker(false)
    setForceCreatePatient(true) // Mark that we want to force create a new patient
    setTimeout(() => { try { nameRef.current?.focus() } catch {} }, 50)
  }

  const generateToken = async () => {
    if (!fullName.trim() || !phone.trim() || selectedTests.length === 0) return
    try {
      // Resolve patient in Lab_Patient collection
      let patient = selectedPatient
      if (patient) {
        const patch: any = {}
        if ((fullName || '') !== (patient.fullName || '')) patch.fullName = fullName
        if ((guardianName || '') !== (patient.fatherName || '')) patch.fatherName = guardianName
        if ((gender || '') !== (patient.gender || '')) patch.gender = gender
        if ((address || '') !== (patient.address || '')) patch.address = address
        if ((phone || '') !== (patient.phoneNormalized || '')) patch.phone = phone
        if ((cnic || '') !== (patient.cnicNormalized || '')) patch.cnic = cnic
        if (Object.keys(patch).length) {
          const upd = await labApi.updatePatient(String(patient._id), patch) as any
          patient = upd?.patient || patient
        }
      } else {
        const fr = await labApi.findOrCreatePatient({ fullName: fullName.trim(), guardianName: guardianName || undefined, phone: phone || undefined, cnic: cnic || undefined, gender: gender || undefined, address: address || undefined, age: age || undefined, guardianRel: guardianRel || undefined, forceCreate: forceCreatePatient }) as any
        patient = fr?.patient
        setForceCreatePatient(false) // Reset after using
      }
      if (!patient?._id) throw new Error('Failed to resolve patient')

      // Create diagnostic order
      const testIds = selected
      const slipRows = selectedTests.map(t => ({ name: t.name, price: getEffectivePrice(t.id) }))
      const created = window.location.pathname.startsWith('/reception')
        ? await receptionApi.createDiagnosticOrder({
          patientId: String(patient._id),
          patient: {
            mrn: patient.mrn || undefined,
            fullName: fullName.trim(),
            phone: phone || undefined,
            age: age || undefined,
            gender: gender || undefined,
            address: address || undefined,
            guardianRelation: guardianRel || undefined,
            guardianName: guardianName || undefined,
            cnic: cnic || undefined,
          },
          tests: testIds,
          subtotal,
          discount: Number(discount) || 0,
          net,
          receivedAmount: receivedNum,
          referringConsultant: referringConsultant || undefined,
          ...(corpCompanyId ? { corporateId: corpCompanyId } : {}),
          ...(corpPreAuthNo ? { corporatePreAuthNo: corpPreAuthNo } : {}),
          ...(corpCoPayPercent ? { corporateCoPayPercent: Number(corpCoPayPercent) } : {}),
          ...(corpCoverageCap ? { corporateCoverageCap: Number(corpCoverageCap) } : {}),
          portal: 'reception',
        } as any)
        : await diagnosticApi.createOrder({
        patientId: String(patient._id),
        patient: {
          mrn: patient.mrn || undefined,
          fullName: fullName.trim(),
          phone: phone || undefined,
          age: age || undefined,
          gender: gender || undefined,
          address: address || undefined,
          guardianRelation: guardianRel || undefined,
          guardianName: guardianName || undefined,
          cnic: cnic || undefined,
        },
        tests: testIds,
        subtotal,
        discount: Number(discount) || 0,
        net,
        receivedAmount: receivedNum,
        referringConsultant: referringConsultant || undefined,
        ...(corpCompanyId ? { corporateId: corpCompanyId } : {}),
        ...(corpPreAuthNo ? { corporatePreAuthNo: corpPreAuthNo } : {}),
        ...(corpCoPayPercent ? { corporateCoPayPercent: Number(corpCoPayPercent) } : {}),
        ...(corpCoverageCap ? { corporateCoverageCap: Number(corpCoverageCap) } : {}),
        portal: window.location.pathname.startsWith('/reception') ? 'reception' : 'diagnostic',
      } as any) as any

      // If we are processing a referral, mark it completed
      if (fromReferralId) {
        try { await hospitalApi.updateReferralStatus(fromReferralId, 'completed') } catch { }
      }

      const tokenNo = created?.tokenNo || created?.order?.tokenNo || 'N/A'
      const createdAt = created?.createdAt || created?.order?.createdAt || new Date().toISOString()
      const data: DiagnosticTokenSlipData = {
        tokenNo,
        patientName: fullName.trim(),
        phone: phone.trim(),
        age: age || undefined,
        gender: gender || undefined,
        mrn: patient.mrn || mrn || undefined,
        guardianRel: guardianRel || undefined,
        guardianName: guardianName || undefined,
        cnic: cnic || undefined,
        address: address || undefined,
        tests: slipRows,
        subtotal,
        discount: Number(discount) || 0,
        payable: net,
        createdAt,
      }
      setSlipData(data)
      setSlipOpen(true)
      setToast({ type: 'success', message: `Token ${data.tokenNo} generated successfully` })
    } catch (e: any) {
      setToast({ type: 'error', message: e?.message || 'Failed to create order' })
    }
  }

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900 dark:bg-[#0b1220] dark:text-slate-100">
      <div className="p-4 sm:p-6">
        <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Token Generator</h2>
      <form onSubmit={e => { e.preventDefault(); generateToken() }} className="mt-6 space-y-8">
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Patient Information */}
          <div className="rounded-lg border border-slate-200 bg-white p-4 dark:bg-slate-800 dark:border-slate-700">
            <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Patient Information</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Phone</label>
                <div ref={phoneSuggestWrapRef} className="relative">
                  <input
                    className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200 dark:bg-slate-900 dark:border-slate-700 dark:text-white dark:placeholder-slate-500"
                    placeholder="Type phone to search"
                    value={phone}
                    maxLength={11}
                    onChange={onPhoneChange}
                    onBlur={() => lookupExistingByPhoneAndName('phone')}
                    onFocus={() => { if (phoneSuggestItems.length > 0) setPhoneSuggestOpen(true) }}
                    ref={phoneRef}
                  />
                  {phoneSuggestOpen && (
                    <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg dark:bg-slate-800 dark:border-slate-700">
                      {phoneSuggestItems.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">No results</div>
                      ) : (
                        phoneSuggestItems.map((p: any, idx: number) => (
                          <button
                            type="button"
                            key={p._id || idx}
                            onClick={() => selectPhoneSuggestion(p)}
                            className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50"
                          >
                            <div className="text-sm font-medium text-slate-800 dark:text-slate-200">{p.fullName || 'Unnamed'} <span className="text-xs text-slate-500 dark:text-slate-400">{p.mrn || '-'}</span></div>
                            <div className="text-xs text-slate-600 dark:text-slate-400">{p.phoneNormalized || ''} • Age: {p.age || '-'} • {p.gender || '-'}</div>
                            {p.address && <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{p.address}</div>}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Patient Name</label>
                <div ref={nameSuggestWrapRef} className="relative">
                  <input className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200 dark:bg-slate-900 dark:border-slate-700 dark:text-white dark:placeholder-slate-500" placeholder="Type name to search" value={fullName} onChange={onNameChange} onBlur={() => lookupExistingByPhoneAndName('name')} onFocus={() => { if (nameSuggestItems.length > 0) setNameSuggestOpen(true) }} ref={nameRef} />
                  {nameSuggestOpen && (
                    <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg dark:bg-slate-800 dark:border-slate-700">
                      {nameSuggestItems.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">No results</div>
                      ) : (
                        nameSuggestItems.map((p: any, idx: number) => (
                          <button
                            type="button"
                            key={p._id || idx}
                            onClick={() => selectNameSuggestion(p)}
                            className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50"
                          >
                            <div className="text-sm font-medium text-slate-800 dark:text-slate-200">{p.fullName || 'Unnamed'} <span className="text-xs text-slate-500 dark:text-slate-400">{p.mrn || '-'}</span></div>
                            <div className="text-xs text-slate-600 dark:text-slate-400">{p.phoneNormalized || ''} • Age: {p.age || '-'} • {p.gender || '-'}</div>
                            {p.address && <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{p.address}</div>}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Search by MR Number</label>
                <input className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200 dark:bg-slate-900 dark:border-slate-700 dark:text-white dark:placeholder-slate-500" placeholder="Enter MR# (e.g., MR-15)" value={mrn} onChange={e => setMrn(e.target.value)} onKeyDown={onMrnKeyDown} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Age</label>
                <input className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200 dark:bg-slate-900 dark:border-slate-700 dark:text-white dark:placeholder-slate-500" placeholder="e.g., 25" value={age} onChange={e => setAge(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Gender</label>
                <select className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200 dark:bg-slate-900 dark:border-slate-700 dark:text-white" value={gender} onChange={e => setGender(e.target.value)}>
                  <option value="">Select gender</option>
                  <option className="dark:bg-slate-900">Male</option>
                  <option className="dark:bg-slate-900">Female</option>
                  <option className="dark:bg-slate-900">Other</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Guardian</label>
                <select className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200 dark:bg-slate-900 dark:border-slate-700 dark:text-white" value={guardianRel} onChange={e => setGuardianRel(e.target.value)}>
                  <option value="">S/O or D/O</option>
                  <option className="dark:bg-slate-900" value="S/O">S/O</option>
                  <option className="dark:bg-slate-900" value="D/O">D/O</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Guardian Name</label>
                <input className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200 dark:bg-slate-900 dark:border-slate-700 dark:text-white dark:placeholder-slate-500" placeholder="Father/Guardian Name" value={guardianName} onChange={e => setGuardianName(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">CNIC</label>
                <input className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200 dark:bg-slate-900 dark:border-slate-700 dark:text-white dark:placeholder-slate-500" placeholder="13-digit CNIC (no dashes)" value={cnic} onChange={e => setCnic(e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Address</label>
                <textarea className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200 dark:bg-slate-900 dark:border-slate-700 dark:text-white dark:placeholder-slate-500" rows={3} placeholder="Residential Address" value={address} onChange={e => setAddress(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Tests & Billing */}
          <div className="rounded-lg border border-slate-200 bg-white p-4 dark:bg-slate-800 dark:border-slate-700">
            <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Tests & Billing</h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Select Tests</label>
                <MultiSelect
                  options={tests.map(t => ({ value: t.id, label: `${t.name} (PKR ${getEffectivePrice(t.id).toLocaleString()})` }))}
                  selectedIds={selected}
                  onToggle={id => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
                  placeholder="Select tests..."
                />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Billing Type</label>
                  <select value={corpCompanyId ? 'Corporate' : 'Cash'} onChange={e => { if (e.target.value !== 'Corporate') setCorpCompanyId('') }} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200 dark:bg-slate-900 dark:border-slate-700 dark:text-white">
                    <option>Cash</option>
                    <option>Card</option>
                    <option>Corporate</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Referring Consultant</label>
                  <input value={referringConsultant} onChange={e => setReferringConsultant(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200 dark:bg-slate-900 dark:border-slate-700 dark:text-white dark:placeholder-slate-500" placeholder="Optional" />
                </div>
              </div>
              {corpCompanyId && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Corporate Company</label>
                    <select value={corpCompanyId} onChange={e => setCorpCompanyId(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200 dark:bg-slate-900 dark:border-slate-700 dark:text-white">
                      <option value="">None</option>
                      {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Pre-Auth No</label>
                    <input value={corpPreAuthNo} onChange={e => setCorpPreAuthNo(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200 dark:bg-slate-900 dark:border-slate-700 dark:text-white dark:placeholder-slate-500" placeholder="Optional" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Co-Pay %</label>
                    <input value={corpCoPayPercent} onChange={e => setCorpCoPayPercent(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200 dark:bg-slate-900 dark:border-slate-700 dark:text-white dark:placeholder-slate-500" placeholder="0-100" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Fee Details */}
        <section className="rounded-lg border border-slate-200 bg-white p-4 dark:bg-slate-800 dark:border-slate-700">
          <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Fee Details</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Subtotal</label>
              <div className="flex h-10 items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300">PKR {subtotal.toLocaleString()}</div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Discount</label>
              <input value={discount} onChange={e => setDiscount(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200 dark:bg-slate-900 dark:border-slate-700 dark:text-white dark:placeholder-slate-500" placeholder="0" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Net Amount</label>
              <div className="flex h-10 items-center rounded-md border border-emerald-200 bg-emerald-50 px-3 text-sm font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-400">PKR {net.toLocaleString()}</div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Received</label>
              <input value={receivedAmount} onChange={e => setReceivedAmount(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200 dark:bg-slate-900 dark:border-slate-700 dark:text-white dark:placeholder-slate-500" placeholder="0" />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-slate-600 dark:text-slate-400">Pending: <span className="font-semibold text-slate-800 dark:text-slate-200">PKR {receivableNum.toLocaleString()}</span></div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => { setFullName(''); setPhone(''); setMrn(''); setAge(''); setGender(''); setGuardianRel(''); setGuardianName(''); setCnic(''); setAddress(''); setSelected([]); setDiscount('0'); setReceivedAmount('0'); setCorpCompanyId(''); setSelectedPatient(null) }} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700">Reset Form</button>
              <button type="submit" disabled={!fullName || !phone || selectedTests.length === 0} className="rounded-md bg-violet-700 px-4 py-2 text-sm font-medium text-white hover:bg-violet-800 disabled:opacity-40 dark:bg-violet-600 dark:hover:bg-violet-700">Generate Token</button>
            </div>
          </div>
        </section>
      </form>
      </div>

      {/* Slip modal */}
      {slipOpen && slipData && (
        <Diagnostic_TokenSlip open={slipOpen} onClose={() => setSlipOpen(false)} data={slipData} />
      )}
      <Toast toast={toast} onClose={() => setToast(null)} />
      {showPhonePicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl ring-1 ring-black/5">
            <div className="border-b border-slate-200 px-5 py-3 text-base font-semibold text-slate-800">Select Patient (Phone: {phone})</div>
            <div className="max-h-96 overflow-y-auto p-2">
              {phonePatients.map((p, idx) => (
                <button key={p._id || idx} onClick={() => {
                  setSelectedPatient(p)
                  setFullName(p.fullName || '')
                  setPhone(p.phoneNormalized || '')
                  setMrn(p.mrn || '')
                  setAge((p.age != null && p.age !== '') ? String(p.age) : '')
                  if (p.gender) setGender(String(p.gender))
                  setGuardianName(p.fatherName || '')
                  if (p.guardianRel) setGuardianRel(String(p.guardianRel))
                  setAddress(p.address || '')
                  setCnic(p.cnicNormalized || p.cnic || '')
                  setShowPhonePicker(false)
                }} className="mb-2 w-full rounded-lg border border-slate-200 p-3 text-left hover:bg-slate-50">
                  <div className="text-sm font-medium text-slate-800">{p.fullName || 'Unnamed'}</div>
                  <div className="text-xs text-slate-600">MRN: {p.mrn || '-'} • Age: {p.age || '-'} • {p.gender || '-'}</div>
                  {p.address && <div className="text-xs text-slate-500 truncate">{p.address}</div>}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
              <button onClick={() => setShowPhonePicker(false)} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm">Cancel</button>
              <button onClick={clearPatientFieldsKeepPhone} className="rounded-md bg-violet-700 px-3 py-1.5 text-sm font-medium text-white">Create New Patient</button>
            </div>
          </div>
        </div>
      )}
      {confirmPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-2xl ring-1 ring-black/5">
            <div className="border-b border-slate-200 px-5 py-3 text-base font-semibold text-slate-800">Confirm Patient</div>
            <div className="px-5 py-4 text-sm whitespace-pre-wrap text-slate-700">{confirmPatient.summary}</div>
            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
              <button onClick={() => { if (confirmPatient) skipLookupKeyRef.current = confirmPatient.key; setConfirmPatient(null); setTimeout(() => { if (focusAfterConfirm === 'phone') phoneRef.current?.focus(); else if (focusAfterConfirm === 'name') nameRef.current?.focus(); setFocusAfterConfirm(null) }, 0) }} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm">Cancel</button>
              <button onClick={() => {
                const p = confirmPatient.patient
                try {
                  setSelectedPatient(p)
                  setFullName(p.fullName || '')
                  setPhone(p.phoneNormalized || '')
                  setMrn(p.mrn || '')
                  setAge((p.age != null && p.age !== '') ? String(p.age) : '')
                  if (p.gender) setGender(String(p.gender))
                  setGuardianName(p.fatherName || '')
                  if (p.guardianRel) setGuardianRel(String(p.guardianRel))
                  setAddress(p.address || '')
                  setCnic(p.cnicNormalized || p.cnic || '')
                } finally { if (confirmPatient) skipLookupKeyRef.current = confirmPatient.key; setConfirmPatient(null) }
              }} className="rounded-md bg-violet-700 px-3 py-1.5 text-sm font-medium text-white">Apply</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
