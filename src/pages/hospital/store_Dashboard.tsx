import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { hospitalApi } from '../../utils/api'

type AlertSummary = {
  lowStock: number
  outOfStock: number
  expiringSoon: number
  expired: number
}

type DashboardStats = {
  totalItems: number
  totalStockValue: number
  totalSuppliers: number
  pendingPayments: number
  todayPurchases: number
  todayIssues: number
}

export default function Store_Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalItems: 0,
    totalStockValue: 0,
    totalSuppliers: 0,
    pendingPayments: 0,
    todayPurchases: 0,
    todayIssues: 0,
  })
  const [alerts, setAlerts] = useState<AlertSummary>({
    lowStock: 0,
    outOfStock: 0,
    expiringSoon: 0,
    expired: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await hospitalApi.storeDashboard() as any
        if (!cancelled) {
          setStats(res.stats || stats)
          setAlerts(res.alerts || alerts)
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

  const quickLinks = [
    { to: '/hospital/store/purchase', label: 'New Purchase', icon: '📦', color: 'bg-sky-600' },
    { to: '/hospital/store/issues', label: 'Issue to Dept', icon: '📤', color: 'bg-emerald-600' },
    { to: '/hospital/store/suppliers', label: 'Suppliers', icon: '🏭', color: 'bg-violet-600' },
    { to: '/hospital/store/inventory', label: 'Inventory', icon: '📋', color: 'bg-amber-600' },
  ]

  const formatCurrency = (n: number) => new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(n)

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-slate-800">Store & Inventory Dashboard</h2>
      <p className="mt-1 text-slate-500">Manage purchases, stock, and department distribution</p>

      {loading ? (
        <div className="mt-8 text-center text-slate-500">Loading...</div>
      ) : (
        <>
          {/* Alert Banner */}
          {(alerts.lowStock > 0 || alerts.outOfStock > 0 || alerts.expired > 0) && (
            <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4">
              <div className="flex items-center gap-2 text-rose-700">
                <span className="text-xl">⚠️</span>
                <span className="font-semibold">Attention Required</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-4 text-sm">
                {alerts.outOfStock > 0 && (
                  <Link to="/hospital/store/alerts?type=out_of_stock" className="rounded-full bg-rose-600 px-3 py-1 text-white">
                    {alerts.outOfStock} Out of Stock
                  </Link>
                )}
                {alerts.lowStock > 0 && (
                  <Link to="/hospital/store/alerts?type=low_stock" className="rounded-full bg-amber-500 px-3 py-1 text-white">
                    {alerts.lowStock} Low Stock
                  </Link>
                )}
                {alerts.expiringSoon > 0 && (
                  <Link to="/hospital/store/alerts?type=expiring_soon" className="rounded-full bg-orange-500 px-3 py-1 text-white">
                    {alerts.expiringSoon} Expiring Soon
                  </Link>
                )}
                {alerts.expired > 0 && (
                  <Link to="/hospital/store/alerts?type=expired" className="rounded-full bg-red-700 px-3 py-1 text-white">
                    {alerts.expired} Expired
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            {quickLinks.map(link => (
              <Link
                key={link.to}
                to={link.to}
                className={`flex items-center gap-3 rounded-xl ${link.color} px-4 py-3 text-white shadow-sm transition hover:scale-[1.02] hover:shadow-md`}
              >
                <span className="text-2xl">{link.icon}</span>
                <span className="font-medium">{link.label}</span>
              </Link>
            ))}
          </div>

          {/* Stats Grid */}
          <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-sm text-slate-500">Total Items</div>
              <div className="mt-1 text-2xl font-bold text-slate-800">{stats.totalItems}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-sm text-slate-500">Stock Value</div>
              <div className="mt-1 text-2xl font-bold text-emerald-600">{formatCurrency(stats.totalStockValue)}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-sm text-slate-500">Suppliers</div>
              <div className="mt-1 text-2xl font-bold text-slate-800">{stats.totalSuppliers}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-sm text-slate-500">Pending Payments</div>
              <div className="mt-1 text-2xl font-bold text-rose-600">{formatCurrency(stats.pendingPayments)}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-sm text-slate-500">Today Purchases</div>
              <div className="mt-1 text-2xl font-bold text-sky-600">{formatCurrency(stats.todayPurchases)}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-sm text-slate-500">Today Issues</div>
              <div className="mt-1 text-2xl font-bold text-violet-600">{formatCurrency(stats.todayIssues)}</div>
            </div>
          </div>

          {/* Reports Links */}
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-slate-800">Reports</h3>
            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
              <Link to="/hospital/store/reports" className="rounded-lg border border-slate-200 bg-white p-3 text-sm hover:bg-slate-50">
                📊 Current Stock Report
              </Link>
              <Link to="/hospital/store/reports" className="rounded-lg border border-slate-200 bg-white p-3 text-sm hover:bg-slate-50">
                📈 Department Usage
              </Link>
              <Link to="/hospital/store/reports" className="rounded-lg border border-slate-200 bg-white p-3 text-sm hover:bg-slate-50">
                ⏰ Expiry Report
              </Link>
              <Link to="/hospital/store/reports" className="rounded-lg border border-slate-200 bg-white p-3 text-sm hover:bg-slate-50">
                📉 Monthly Consumption
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
