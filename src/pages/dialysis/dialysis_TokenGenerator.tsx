import { useEffect, useMemo, useRef, useState } from 'react'

type Patient = {
  _id: string
  fullName: string
  phone: string
  mrn: string
  age?: string
  gender?: string
}

export default function Dialysis_TokenGenerator() {
  const [form, setForm] = useState({
    phone: '',
    mrNumber: '',
    patientName: '',
    age: '',
    gender: '',
    sessionType: 'hemodialysis',
    shift: 'morning',
    machineId: '',
    dialyzer: '',
    duration: '4',
    notes: '',
    fee: '',
    discount: '0',
  })

  const [loading, setLoading] = useState(false)
  const [machines, setMachines] = useState<Array<{ _id: string; name: string; status: string }>>([])
  const [showSlip, setShowSlip] = useState(false)
  const [slipData, setSlipData] = useState<any>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [suggestions, setSuggestions] = useState<Patient[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const suggestRef = useRef<HTMLDivElement>(null)

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    // Load machines (mock data for now)
    setMachines([
      { _id: '1', name: 'Machine 1', status: 'available' },
      { _id: '2', name: 'Machine 2', status: 'available' },
      { _id: '3', name: 'Machine 3', status: 'available' },
      { _id: '4', name: 'Machine 4', status: 'maintenance' },
    ])
  }, [])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (suggestRef.current && !suggestRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const update = (key: keyof typeof form, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const finalFee = useMemo(() => {
    const fee = parseFloat(form.fee || '0')
    const discount = parseFloat(form.discount || '0')
    return Math.max(fee - discount, 0)
  }, [form.fee, form.discount])

  async function searchPatients(query: string) {
    // TODO: Implement actual API call
    // Mock data for now
    const mockPatients: Patient[] = [
      { _id: '1', fullName: 'Ahmed Khan', phone: '03001234567', mrn: 'D001', age: '45', gender: 'Male' },
      { _id: '2', fullName: 'Fatima Ali', phone: '03009876543', mrn: 'D002', age: '52', gender: 'Female' },
    ]
    const filtered = mockPatients.filter(p => 
      p.fullName.toLowerCase().includes(query.toLowerCase()) ||
      p.phone.includes(query) ||
      p.mrn.toLowerCase().includes(query.toLowerCase())
    )
    setSuggestions(filtered)
    setShowSuggestions(filtered.length > 0)
  }

  function selectPatient(p: Patient) {
    setForm(prev => ({
      ...prev,
      patientName: p.fullName,
      phone: p.phone,
      mrNumber: p.mrn,
      age: p.age || '',
      gender: p.gender || '',
    }))
    setShowSuggestions(false)
    showToast('success', 'Patient selected')
  }

  async function onPhoneChange(phone: string) {
    const digits = phone.replace(/\D+/g, '').slice(0, 11)
    update('phone', digits)
    if (digits.length >= 3) {
      searchPatients(digits)
    } else {
      setShowSuggestions(false)
    }
  }

  async function onNameChange(name: string) {
    update('patientName', name)
    if (name.trim().length >= 2) {
      searchPatients(name.trim())
    } else {
      setShowSuggestions(false)
    }
  }

  const reset = () => {
    setForm({
      phone: '',
      mrNumber: '',
      patientName: '',
      age: '',
      gender: '',
      sessionType: 'hemodialysis',
      shift: 'morning',
      machineId: '',
      dialyzer: '',
      duration: '4',
      notes: '',
      fee: '',
      discount: '0',
    })
  }

  const generateToken = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!form.patientName.trim()) {
      showToast('error', 'Patient name is required')
      return
    }
    if (!form.phone || form.phone.length < 10) {
      showToast('error', 'Valid phone number is required')
      return
    }

    setLoading(true)
    try {
      // TODO: Implement actual API call
      // Mock token creation
      const tokenNo = `D${Date.now().toString().slice(-6)}`
      
      const slip = {
        tokenNo,
        patientName: form.patientName,
        phone: form.phone,
        mrn: form.mrNumber,
        age: form.age,
        gender: form.gender,
        sessionType: form.sessionType,
        shift: form.shift,
        machine: machines.find(m => m._id === form.machineId)?.name || 'N/A',
        duration: form.duration,
        amount: parseFloat(form.fee || '0'),
        discount: parseFloat(form.discount || '0'),
        payable: finalFee,
        createdAt: new Date().toISOString(),
      }

      setSlipData(slip)
      setShowSlip(true)
      showToast('success', `Token ${tokenNo} generated successfully`)
      reset()
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to generate token')
    } finally {
      setLoading(false)
    }
  }

  const sessionTypes = [
    { value: 'hemodialysis', label: 'Hemodialysis' },
    { value: 'peritoneal', label: 'Peritoneal Dialysis' },
    { value: 'sustained', label: 'Sustained Low-Efficiency Dialysis (SLED)' },
  ]

  const shifts = [
    { value: 'morning', label: 'Morning (6AM - 10AM)' },
    { value: 'afternoon', label: 'Afternoon (12PM - 4PM)' },
    { value: 'evening', label: 'Evening (6PM - 10PM)' },
  ]

  return (
    <div className="min-h-[70dvh] rounded-xl bg-gradient-to-br from-teal-500/20 via-cyan-300/20 to-emerald-300/20 p-6">
      {toast && (
        <div className={`fixed right-4 top-4 z-50 rounded-xl border px-4 py-3 shadow-lg ${
          toast.type === 'success' 
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800' 
            : 'border-rose-200 bg-rose-50 text-rose-800'
        }`}>
          {toast.message}
        </div>
      )}

      <div className="mx-auto w-full max-w-4xl rounded-xl bg-white p-6 shadow-lg">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Dialysis Token Generator</h1>
            <p className="text-slate-600 mt-1">Generate tokens for dialysis sessions</p>
          </div>
          <div className="rounded-full bg-teal-100 px-4 py-2 text-sm font-medium text-teal-700">
            New Token
          </div>
        </div>

        <form onSubmit={generateToken} className="space-y-6">
          {/* Patient Information */}
          <div className="rounded-xl border border-slate-200 p-5">
            <h3 className="mb-4 text-sm font-semibold text-slate-800">Patient Information</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="relative" ref={suggestRef}>
                <label className="mb-1 block text-xs font-medium text-slate-600">Phone</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => onPhoneChange(e.target.value)}
                  placeholder="03XX-XXXXXXX"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                />
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute z-20 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg">
                    {suggestions.map(p => (
                      <button
                        type="button"
                        key={p._id}
                        onClick={() => selectPatient(p)}
                        className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-50"
                      >
                        <div>
                          <div className="text-sm font-medium text-slate-800">{p.fullName}</div>
                          <div className="text-xs text-slate-500">{p.phone} • MRN: {p.mrn}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">MR Number</label>
                <input
                  value={form.mrNumber}
                  onChange={e => update('mrNumber', e.target.value)}
                  placeholder="MRN"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                />
              </div>

              <div className="relative">
                <label className="mb-1 block text-xs font-medium text-slate-600">Patient Name</label>
                <input
                  value={form.patientName}
                  onChange={e => onNameChange(e.target.value)}
                  placeholder="Full name"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Age</label>
                <input
                  value={form.age}
                  onChange={e => update('age', e.target.value)}
                  placeholder="Age"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Gender</label>
                <select
                  value={form.gender}
                  onChange={e => update('gender', e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                >
                  <option value="">Select</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
          </div>

          {/* Session Details */}
          <div className="rounded-xl border border-slate-200 p-5">
            <h3 className="mb-4 text-sm font-semibold text-slate-800">Session Details</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Session Type</label>
                <select
                  value={form.sessionType}
                  onChange={e => update('sessionType', e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                >
                  {sessionTypes.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Shift</label>
                <select
                  value={form.shift}
                  onChange={e => update('shift', e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                >
                  {shifts.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Machine</label>
                <select
                  value={form.machineId}
                  onChange={e => update('machineId', e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                >
                  <option value="">Select Machine</option>
                  {machines.filter(m => m.status === 'available').map(m => (
                    <option key={m._id} value={m._id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Dialyzer Type</label>
                <input
                  value={form.dialyzer}
                  onChange={e => update('dialyzer', e.target.value)}
                  placeholder="e.g., F8, F10"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Duration (hours)</label>
                <select
                  value={form.duration}
                  onChange={e => update('duration', e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                >
                  <option value="3">3 hours</option>
                  <option value="4">4 hours</option>
                  <option value="5">5 hours</option>
                  <option value="6">6 hours</option>
                </select>
              </div>

              <div className="sm:col-span-2 lg:col-span-1">
                <label className="mb-1 block text-xs font-medium text-slate-600">Notes</label>
                <input
                  value={form.notes}
                  onChange={e => update('notes', e.target.value)}
                  placeholder="Special instructions"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                />
              </div>
            </div>
          </div>

          {/* Billing */}
          <div className="rounded-xl border border-slate-200 p-5">
            <h3 className="mb-4 text-sm font-semibold text-slate-800">Billing</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Session Fee (Rs.)</label>
                <input
                  type="number"
                  value={form.fee}
                  onChange={e => update('fee', e.target.value)}
                  placeholder="0"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Discount (Rs.)</label>
                <input
                  type="number"
                  value={form.discount}
                  onChange={e => update('discount', e.target.value)}
                  placeholder="0"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Payable Amount</label>
                <div className="rounded-md border border-teal-300 bg-teal-50 px-3 py-2 text-lg font-bold text-teal-700">
                  Rs. {finalFee.toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={reset}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Reset
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-teal-600 px-6 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
            >
              {loading ? 'Generating...' : 'Generate Token'}
            </button>
          </div>
        </form>
      </div>

      {/* Token Slip Modal */}
      {showSlip && slipData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="bg-gradient-to-r from-teal-500 to-cyan-500 px-5 py-4 text-white">
              <div className="text-lg font-bold">Dialysis Token</div>
              <div className="text-2xl font-black">{slipData.tokenNo}</div>
            </div>
            
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs text-slate-500">Patient</div>
                  <div className="font-semibold text-slate-800">{slipData.patientName}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Phone</div>
                  <div className="font-semibold text-slate-800">{slipData.phone}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">MRN</div>
                  <div className="font-semibold text-slate-800">{slipData.mrn || 'N/A'}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Age/Gender</div>
                  <div className="font-semibold text-slate-800">{slipData.age || '-'} / {slipData.gender || '-'}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Session Type</div>
                  <div className="font-semibold text-slate-800 capitalize">{slipData.sessionType}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Shift</div>
                  <div className="font-semibold text-slate-800 capitalize">{slipData.shift}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Machine</div>
                  <div className="font-semibold text-slate-800">{slipData.machine}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Duration</div>
                  <div className="font-semibold text-slate-800">{slipData.duration} hours</div>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Session Fee</span>
                  <span className="font-medium">Rs. {slipData.amount.toLocaleString()}</span>
                </div>
                {slipData.discount > 0 && (
                  <div className="flex justify-between text-sm text-rose-600">
                    <span>Discount</span>
                    <span>- Rs. {slipData.discount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold text-teal-700">
                  <span>Payable</span>
                  <span>Rs. {slipData.payable.toLocaleString()}</span>
                </div>
              </div>

              <div className="text-xs text-slate-500 text-center">
                {new Date(slipData.createdAt).toLocaleString()}
              </div>
            </div>

            <div className="flex gap-2 border-t border-slate-200 px-5 py-3">
              <button
                onClick={() => window.print()}
                className="flex-1 rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
              >
                Print
              </button>
              <button
                onClick={() => setShowSlip(false)}
                className="flex-1 rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
