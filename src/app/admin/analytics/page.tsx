'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard } from '@/components/ui/stat-card'
import { PageLoading } from '@/components/ui/loading'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, AreaChart, Area
} from 'recharts'
import { Building2, Users, BookOpen, TrendingUp } from 'lucide-react'

interface PlatformStats {
  libraries: { total: number; active: number; pending: number; suspended: number }
  students: { total: number; active: number; newThisMonth: number }
  bookings: { total: number; today: number; upcoming: number }
  revenue: { total: number; monthly: number }
  subscriptions: { active: number; trial: number; expired: number }
}

export default function AdminAnalyticsPage() {
  const [stats, setStats] = useState<PlatformStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/stats').then(r => r.json()).then(setStats).finally(() => setLoading(false))
  }, [])

  if (loading) return <PageLoading />

  // Build chart-friendly data from stats
  const libraryStatusData = [
    { name: 'Active', value: stats?.libraries.active ?? 0, fill: '#22c55e' },
    { name: 'Pending', value: stats?.libraries.pending ?? 0, fill: '#f59e0b' },
    { name: 'Suspended', value: stats?.libraries.suspended ?? 0, fill: '#ef4444' },
  ]

  const subscriptionData = [
    { name: 'Active', value: stats?.subscriptions.active ?? 0 },
    { name: 'Trial', value: stats?.subscriptions.trial ?? 0 },
    { name: 'Expired', value: stats?.subscriptions.expired ?? 0 },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Platform Analytics</h1>
        <p className="text-slate-500 text-sm">Real-time platform-wide statistics</p>
      </div>

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
        <StatCard title="Upcoming Bookings" value={stats?.bookings.upcoming ?? 0}
          icon={<TrendingUp className="h-5 w-5" />} accentColor="bg-amber-500" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Library Status */}
        <Card>
          <CardHeader><CardTitle>Library Status Breakdown</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={libraryStatusData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={70} />
                <Tooltip />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {libraryStatusData.map((entry, index) => (
                    <rect key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Subscriptions */}
        <Card>
          <CardHeader><CardTitle>Owner Subscriptions</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={subscriptionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Summary Cards */}
      <div className="grid sm:grid-cols-3 gap-4">
        <Card className="p-5">
          <p className="text-sm font-medium text-slate-500 mb-1">Active Libraries</p>
          <p className="text-3xl font-bold text-emerald-600">{stats?.libraries.active ?? 0}</p>
          <p className="text-xs text-slate-400 mt-1">
            {stats?.libraries.total ? Math.round(((stats.libraries.active) / stats.libraries.total) * 100) : 0}% of total
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm font-medium text-slate-500 mb-1">New Students This Month</p>
          <p className="text-3xl font-bold text-indigo-600">{stats?.students.newThisMonth ?? 0}</p>
          <p className="text-xs text-slate-400 mt-1">Platform registrations</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm font-medium text-slate-500 mb-1">Trial Subscriptions</p>
          <p className="text-3xl font-bold text-amber-600">{stats?.subscriptions.trial ?? 0}</p>
          <p className="text-xs text-slate-400 mt-1">Library owners on trial</p>
        </Card>
      </div>
    </div>
  )
}
