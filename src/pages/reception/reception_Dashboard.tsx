import { useMemo } from 'react'
import { Ticket, ListChecks, BedSingle, Activity, FlaskConical, ClipboardList, FileText, DollarSign, Clock, Cog, UserCog } from 'lucide-react'
import ModuleCard from '../../components/ModuleCard'

export default function Reception_Dashboard(){
  const cards = useMemo(() => ([
    { to: '/reception/token-generator', title: 'Token Generator', description: 'Generate new tokens for patients', icon: <Ticket className="h-5 w-5 text-white" />, tone: 'emerald' as const },
    { to: '/reception/today-tokens', title: "Today's Tokens", description: 'View and manage daily tokens', icon: <ListChecks className="h-5 w-5 text-white" />, tone: 'sky' as const },

    { to: '/reception/ipd-billing', title: 'IPD Billing', description: 'Create and manage IPD billing', icon: <BedSingle className="h-5 w-5 text-white" />, tone: 'violet' as const },
    { to: '/reception/ipd-transactions', title: 'Recent IPD Payments', description: 'View recent IPD payment transactions', icon: <DollarSign className="h-5 w-5 text-white" />, tone: 'violet' as const },
    { to: '/reception/er-billing', title: 'ER Billing', description: 'Create and manage ER billing', icon: <Activity className="h-5 w-5 text-white" />, tone: 'amber' as const },
    { to: '/reception/er-transactions', title: 'Recent ER Payments', description: 'View recent ER payment transactions', icon: <DollarSign className="h-5 w-5 text-white" />, tone: 'amber' as const },

    { to: '/reception/diagnostic/token-generator', title: 'Diagnostic Tokens', description: 'Generate diagnostic tokens', icon: <FlaskConical className="h-5 w-5 text-white" />, tone: 'teal' as const },
    { to: '/reception/diagnostic/sample-tracking', title: 'Diagnostic Tracking', description: 'Track diagnostic samples', icon: <ClipboardList className="h-5 w-5 text-white" />, tone: 'sky' as const },

    { to: '/reception/my-activity-report', title: 'My Activity Report', description: 'View your daily activity report', icon: <FileText className="h-5 w-5 text-white" />, tone: 'emerald' as const },
    { to: '/reception/staff-settings', title: 'Staff Settings', description: 'Manage shifts and deductions', icon: <Clock className="h-5 w-5 text-white" />, tone: 'sky' as const },
    { to: '/reception/sidebar-permissions', title: 'Sidebar Permissions', description: 'Configure sidebar visibility', icon: <Cog className="h-5 w-5 text-white" />, tone: 'slate' as const },
    { to: '/reception/user-management', title: 'User Management', description: 'Manage users and assign shifts', icon: <UserCog className="h-5 w-5 text-white" />, tone: 'violet' as const },
  ]), [])

  return (
    <div className="p-6">
      <div className="mb-6 rounded-2xl border border-slate-200 bg-linear-to-br from-sky-50 via-violet-50 to-cyan-50 p-5 dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Reception Dashboard</h2>
        <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">Welcome to the reception portal overview</div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {cards.map(c => (
          <ModuleCard
            key={c.to}
            to={c.to}
            title={c.title}
            description={c.description}
            icon={
              <div className="rounded-lg bg-[var(--navy)] p-2">
                {c.icon}
              </div>
            }
            tone={c.tone}
          />
        ))}
      </div>
    </div>
  )
}
