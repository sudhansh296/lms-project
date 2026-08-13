'use client'

import { useEffect, useState } from 'react'
import { StatCard } from '@/components/ui/stat-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageLoading } from '@/components/ui/loading'
import { Building2, Users, BookOpen, CreditCard, TrendingUp, Clock, CheckCircle, XCircle } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import Link from 'next/link'

interface Stats {
  libraries: { total: number; active: number; pending: number; suspended: number }
  students: { total: number; active: number; newThisMonth: number }
  bookings: { total: number; today: number; upcoming: number }
  revenue: { total: number; monthly: number }
  subscriptions: { active: number; trial: number; expired: number }
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [pendingLibraries, setPendingLibraries] = useState<Array<{ id: string; name: string; city: string; createdAt: string; owner: { user: { name: string } } }>>([])

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/stats').then(r => r.json()),
      fetch('/api/admin/libraries?status=PENDING_VERIFICATION&limit=5').then(r => r.json()),
    ]).then(([s, l]) => {
      setStats(s)
      setPendingLibraries(l.libraries ?? [])
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <PageLoading />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Platform Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">Overview of the entire StudyLib platform</p>
      </div>

      {/* Stats Row 1 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Total Libraries" value={stats?.libraries.total ?? 0}
          subtitle={`${stats?.libraries.active} active`} icon={<Building2 className="h-5 w-5" />}
          accentColor="bg-indigo-500" />
        <StatCard title="Total Students" value={stats?.students.total ?? 0}
          subtitle={`+${stats?.students.newThisMonth} this month`} icon={<Users className="h-5 w-5" />}
          accentColor="bg-violet-500" />
        <StatCard title="Total Bookings" value={stats?.bookings.total ?? 0}
          subtitle={`${stats?.bookings.today} today`} icon={<BookOpen className="h-5 w-5" />}
          accentColor="bg-emerald-500" />
        <StatCard title="Total Revenue" value={formatCurrency(stats?.revenue.total ?? 0)}
          subtitle={`${formatCurrency(stats?.revenue.monthly ?? 0)} this month`}
          icon={<CreditCard className="h-5 w-5" />} accentColor="bg-amber-500" />
      </div>

      {/* Stats Row 2 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        {[
          { label: 'Active Libraries', val: stats?.libraries.active ?? 0, color: 'text-emerald-600' },
          { label: 'Pending Review', val: stats?.libraries.pending ?? 0, color: 'text-amber-600' },
          { label: 'Suspended', val: stats?.libraries.suspended ?? 0, color: 'text-red-500' },
          { label: "Today's Bookings", val: stats?.bookings.today ?? 0, color: 'text-indigo-600' },
          { label: 'Active Subscriptions', val: stats?.subscriptions.active ?? 0, color: 'text-emerald-600' },
          { label: 'Trial Subscriptions', val: stats?.subscriptions.trial ?? 0, color: 'text-amber-600' },
        ].map((s) => (
          <Card key={s.label} className="p-4">
            <p className="text-xs text-slate-500">{s.label}</p>
            <p className={`text-xl font-bold mt-1 tabular-nums ${s.color}`}>{s.val}</p>
          </Card>
        ))}
      </div>

      {/* Pending Libraries */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-500" />
            Pending Approvals
            {stats?.libraries.pending ? (
              <Badge variant="warning">{stats.libraries.pending}</Badge>
            ) : null}
          </CardTitle>
          <Link href="/admin/libraries?status=PENDING_VERIFICATION" className="text-sm text-indigo-600 hover:underline">View all</Link>
        </CardHeader>
        <CardContent>
          {pendingLibraries.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              <CheckCircle className="h-8 w-8 mx-auto mb-2 text-emerald-400" />
              No pending approvals
            </div>
          ) : (
            <div className="space-y-3">
              {pendingLibraries.map((lib) => (
                <div key={lib.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3 hover:bg-slate-50 transition-colors">
                  <div>
                    <p className="font-medium text-sm text-slate-900">{lib.name}</p>
                    <p className="text-xs text-slate-500">{lib.city} · Owner: {lib.owner?.user?.name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="pending">Pending</Badge>
                    <Link href={`/admin/libraries/${lib.id}`}
                      className="text-xs text-indigo-600 hover:underline font-medium">Review</Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Links */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { href: '/admin/libraries', label: 'Manage Libraries', icon: Building2, color: 'bg-indigo-50 text-indigo-600' },
          { href: '/admin/students', label: 'View Students', icon: Users, color: 'bg-violet-50 text-violet-600' },
          { href: '/admin/revenue', label: 'Revenue Report', icon: TrendingUp, color: 'bg-emerald-50 text-emerald-600' },
          { href: '/admin/analytics', label: 'Platform Analytics', icon: BarChart3, color: 'bg-amber-50 text-amber-600' },
        ].map(({ href, label, icon: Icon, color }) => (
          <Link key={href} href={href}>
            <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer group">
              <div className={`rounded-xl ${color} p-2.5 w-fit mb-3 group-hover:scale-110 transition-transform`}>
                <Icon className="h-4 w-4" />
              </div>
              <p className="font-medium text-sm text-slate-900">{label}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}

function BarChart3(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="18" y="3" width="4" height="18" rx="1" /><rect x="10" y="8" width="4" height="13" rx="1" />
      <rect x="2" y="13" width="4" height="8" rx="1" />
    </svg>
  )
}
