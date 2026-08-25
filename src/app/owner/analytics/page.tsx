'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard } from '@/components/ui/stat-card'
import { PageLoading } from '@/components/ui/loading'
import { UpgradeGate } from '@/components/ui/upgrade-gate'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, AreaChart, Area
} from 'recharts'
import { BarChart3, Clock, Star, TrendingUp } from 'lucide-react'

interface AnalyticsData {
  occupancyRate: number; totalSeats: number; occupiedSeats: number
  dailyBookings: Array<{ label: string; count: number }>
  popularSeats: Array<{ seatId: string; label: string; bookings: number }>
  peakHours: Array<{ hour: string; bookings: number }>
  membershipGrowth: Array<{ label: string; count: number }>
  upgradeRequired?: boolean
  error?: string
}

export default function OwnerAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/owner/analytics').then(r => r.json()).then(setData).finally(() => setLoading(false))
  }, [])

  if (loading) return <PageLoading />

  if (data?.upgradeRequired) {
    return <UpgradeGate message={data.error ?? 'Analytics requires Level 1 or higher. Refer more libraries to unlock.'} />
  }

  const peakHour = data?.peakHours.reduce((max, h) => h.bookings > max.bookings ? h : max, { hour: '—', bookings: 0 })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
        <p className="text-slate-500 text-sm">Insights into your library's performance</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Occupancy Rate" value={`${data?.occupancyRate ?? 0}%`}
          subtitle={`${data?.occupiedSeats}/${data?.totalSeats} seats`}
          icon={<BarChart3 className="h-5 w-5" />} accentColor="bg-indigo-500" />
        <StatCard title="Peak Hour" value={peakHour?.hour ?? '—'}
          subtitle={`${peakHour?.bookings} bookings`}
          icon={<Clock className="h-5 w-5" />} accentColor="bg-violet-500" />
        <StatCard title="Most Popular Seat" value={data?.popularSeats[0]?.label ?? '—'}
          subtitle={`${data?.popularSeats[0]?.bookings ?? 0} bookings (30d)`}
          icon={<Star className="h-5 w-5" />} accentColor="bg-amber-500" />
        <StatCard title="Membership Growth" value={`${data?.membershipGrowth[data.membershipGrowth.length - 1]?.count ?? 0}`}
          subtitle="New this month"
          icon={<TrendingUp className="h-5 w-5" />} accentColor="bg-emerald-500" />
      </div>

      {/* Daily Bookings */}
      <Card>
        <CardHeader><CardTitle>Daily Bookings — Last 30 Days</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={data?.dailyBookings ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={4} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip />
              <Area type="monotone" dataKey="count" stroke="#6366f1" fill="#eef2ff" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Peak Hours */}
        <Card>
          <CardHeader><CardTitle>Peak Hours</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data?.peakHours.filter(h => h.bookings > 0) ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="bookings" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Popular Seats */}
        <Card>
          <CardHeader><CardTitle>Most Popular Seats (Last 30 Days)</CardTitle></CardHeader>
          <CardContent>
            {data?.popularSeats.length === 0 ? (
              <p className="text-center py-8 text-slate-400 text-sm">No booking data yet</p>
            ) : (
              <div className="space-y-3">
                {data?.popularSeats.map((s, i) => (
                  <div key={s.seatId} className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm">Seat {s.label}</span>
                        <span className="text-sm font-bold text-indigo-600">{s.bookings}</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full">
                        <div className="h-1.5 bg-indigo-500 rounded-full"
                          style={{ width: `${(s.bookings / (data.popularSeats[0]?.bookings || 1)) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Membership Growth */}
      <Card>
        <CardHeader><CardTitle>Membership Growth — Last 6 Months</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data?.membershipGrowth ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}
