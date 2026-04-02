import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { hospitalApi } from '../../utils/api'

type Alert = {
  id: string
  type: 'low_stock' | 'out_of_stock' | 'expiring_soon' | 'expired'
  itemId: string
  itemName: string
  batchNo?: string
  batchId?: string
  currentStock: number
  minStock?: number
  expiry?: string
  daysUntilExpiry?: number
  message: string
  status: 'active' | 'acknowledged' | 'resolved'
  createdAt: string
}

const ALERT_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: string }> = {
  low_stock: { label: 'Low Stock', color: 'text-amber-700', bgColor: 'bg-amber-50', icon: '🟡' },
  out_of_stock: { label: 'Out of Stock', color: 'text-rose-700', bgColor: 'bg-rose-50', icon: '🔴' },
  expiring_soon: { label: 'Expiring Soon', color: 'text-orange-700', bgColor: 'bg-orange-50', icon: '🟠' },
  expired: { label: 'Expired', color: 'text-red-800', bgColor: 'bg-red-100', icon: '⚫' },
}

export default function Store_Alerts() {
  const [searchParams] = useSearchParams()
  const typeFilter = searchParams.get('type') || ''

  const [alerts, setAlerts] = useState<Alert[]>([])
  const [typeFilterState, setTypeFilterState] = useState(typeFilter)
  const [statusFilter, setStatusFilter] = useState('active')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await hospitalApi.listStoreAlerts() as any
        if (!cancelled) {
          const alertList = (res.alerts || res.data || res || []).map((a: any) => ({
            id: String(a._id || a.id),
            type: a.type,
            itemId: a.itemId,
            itemName: a.itemName,
            batchNo: a.batchNo,
            batchId: a.batchId,
            currentStock: a.currentStock || 0,
            minStock: a.minStock,
            expiry: a.expiry,
            daysUntilExpiry: a.daysUntilExpiry,
            message: a.message,
            status: a.status || 'active',
            createdAt: a.createdAt,
          })) as Alert[]
          setAlerts(alertList)
        }
      } catch {
        // API not ready - show empty state
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const filtered = useMemo(() => {
    return alerts.filter(a => {
      if (typeFilterState && a.type !== typeFilterState) return false
      if (statusFilter && a.status !== statusFilter) return false
      return true
    })
  }, [alerts, typeFilterState, statusFilter])

  const acknowledgeAlert = async (id: string) => {
    try {
      await hospitalApi.acknowledgeStoreAlert(id)
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'acknowledged' as const } : a))
    } catch {
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'acknowledged' as const } : a))
    }
  }

  const resolveAlert = async (id: string) => {
    try {
      await hospitalApi.resolveStoreAlert(id)
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'resolved' as const } : a))
    } catch {
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'resolved' as const } : a))
    }
  }

  const summary = {
    low_stock: alerts.filter(a => a.type === 'low_stock' && a.status === 'active').length,
    out_of_stock: alerts.filter(a => a.type === 'out_of_stock' && a.status === 'active').length,
    expiring_soon: alerts.filter(a => a.type === 'expiring_soon' && a.status === 'active').length,
    expired: alerts.filter(a => a.type === 'expired' && a.status === 'active').length,
  }

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-800">Stock Alerts</h2>
        <Link to="/hospital/store/inventory" className="text-sm text-sky-700 hover:underline">
          ← Back to Inventory
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {Object.entries(ALERT_CONFIG).map(([type, config]) => (
          <button
            key={type}
            onClick={() => setTypeFilterState(typeFilterState === type ? '' : type)}
            className={`rounded-lg border p-4 text-left transition ${typeFilterState === type ? 'ring-2 ring-violet-500' : ''} ${config.bgColor}`}
          >
            <div className="flex items-center gap-2">
              <span className="text-xl">{config.icon}</span>
              <span className={`text-sm font-medium ${config.color}`}>{config.label}</span>
            </div>
            <div className={`mt-1 text-2xl font-bold ${config.color}`}>{summary[type as keyof typeof summary]}</div>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="mt-4 flex gap-3">
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="active">Active</option>
          <option value="acknowledged">Acknowledged</option>
          <option value="resolved">Resolved</option>
          <option value="">All</option>
        </select>
        {typeFilterState && (
          <button onClick={() => setTypeFilterState('')} className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">
            Clear Filter
          </button>
        )}
      </div>

      {loading ? (
        <div className="mt-8 text-center text-slate-500">Loading...</div>
      ) : (
        <div className="mt-5 space-y-3">
          {filtered.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500">
              No alerts found
            </div>
          ) : (
            filtered.map(alert => {
              const config = ALERT_CONFIG[alert.type]
              return (
                <div key={alert.id} className={`rounded-lg border ${config.bgColor} p-4`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <span className="mt-1 text-2xl">{config.icon}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold ${config.color}`}>{config.label}</span>
                          {alert.status !== 'active' && (
                            <span className={`rounded px-2 py-0.5 text-xs ${alert.status === 'acknowledged' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                              {alert.status}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-slate-800">{alert.itemName}</div>
                        {alert.batchNo && <div className="text-sm text-slate-500">Batch: {alert.batchNo}</div>}
                        <div className="mt-1 text-sm text-slate-600">{alert.message}</div>
                        <div className="mt-2 flex gap-4 text-xs text-slate-400">
                          <span>Stock: {alert.currentStock}</span>
                          {alert.minStock && <span>Min: {alert.minStock}</span>}
                          {alert.expiry && <span>Expiry: {alert.expiry}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {alert.status === 'active' && (
                        <button
                          onClick={() => acknowledgeAlert(alert.id)}
                          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs hover:bg-white"
                        >
                          Acknowledge
                        </button>
                      )}
                      {alert.status !== 'resolved' && (
                        <button
                          onClick={() => resolveAlert(alert.id)}
                          className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs text-white hover:bg-emerald-700"
                        >
                          Resolve
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
