'use client'

import { useEffect, useState } from 'react'
import { StatCard } from '@/components/ui/stat-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageLoading } from '@/components/ui/loading'
import { EmptyState } from '@/components/ui/empty-state'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { Armchair, Users, BookOpen, Clock, AlertTriangle, Share2, TrendingUp, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/auth-context'
import { LEVEL_LABELS, LEVEL_COLORS, LEVEL_BENEFITS } from '@/lib/referral'
import type { OwnerMembershipLevel } from '@/lib/referral'

interface OwnerStats {
  seats: { total: number; available: number; occupied: number; reserved: number; maintenance: number }
  bookings: { today: number }
  students: { active: number }
  memberships: { active: number; expiringSoon: number }
  revenue: { today: number; monthly: number }
}

interface Booking {
  id: string; status: string; startTime: string; endTime: string
  totalAmount: number
  student: { user: { name: string; mobile: string } }
  seat: { label: string }
  plan?: { name: string; price: number } | null
  planNameSnapshot?: string | null
  planPriceSnapshot?: number | null
}

interface ReferralSummary {
  ownerMembershipLevel: OwnerMembershipLevel
  levelLabel: string
  qualifiedCount: number
  pendingCount: number
  nextLevel: OwnerMembershipLevel | null
  nextLevelLabel: string | null
  nextLevelThreshold: number
  needed: number
  referralUrl: string | null
}

export default function OwnerDashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState<OwnerStats | null>(null)
  const [library, setLibrary] = useState<{ name: string; status: string; city: string } | null>(null)
  const [recentBookings, setRecentBookings] = useState<Booking[]>([])
  const [referral, setReferral] = useState<ReferralSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/owner/stats').then(r => r.json()),
      fetch('/api/owner/library').then(r => r.json()),
      fetch('/api/owner/bookings?limit=5').then(r => r.json()),
      fetch('/api/owner/referral').then(r => r.json()),
    ]).then(([s, l, b, ref]) => {
      setStats(s)
      setLibrary(l.library)
      setRecentBookings(b.bookings ?? [])
      setReferral(ref)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <PageLoading />

  const isPending = library?.status === 'PENDING_VERIFICATION'
  const isSuspended = library?.status === 'SUSPENDED'
  const level = referral?.ownerMembershipLevel ?? 'STANDARD'
  const benefits = LEVEL_BENEFITS[level]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Welcome, {user?.name?.split(' ')[0]} 👋</h1>
        <div className="flex items-center gap-2 mt-1">
          <p className="text-slate-500 text-sm">{library?.name}</p>
          {library?.status && (
            <Badge variant={
              library.status === 'ACTIVE' ? 'active' :
              library.status === 'PENDING_VERIFICATION' ? 'pending' : 'suspended'
            }>
              {library.status.replace('_', ' ')}
            </Badge>
          )}
        </div>
      </div>

      {/* Referral Membership Card */}
      {referral && (
        <Card className="border-2 border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              {/* Left — level info + progress */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-3">
                  <Share2 className="h-5 w-5 text-violet-600 shrink-0" />
                  <h3 className="font-bold text-slate-900">Referral Membership</h3>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${LEVEL_COLORS[level]}`}>
                    {LEVEL_LABELS[level]}
                  </span>
                </div>

                {/* Current level features */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3">
                  {benefits.features.map((f, i) => (
                    <span key={i} className="flex items-center gap-1 text-xs text-slate-600">
                      <CheckCircle className="h-3 w-3 text-emerald-500 shrink-0" /> {f}
                    </span>
                  ))}
                </div>

                <div className="grid sm:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Qualified Libraries</p>
                    <p className="font-bold text-2xl text-slate-900 tabular-nums">{referral.qualifiedCount}</p>
                  </div>
                  {referral.nextLevel && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Next Level</p>
                      <p className="font-bold text-slate-900">{referral.nextLevelLabel}</p>
                      <p className="text-xs text-slate-500">{referral.needed} more verified {referral.needed === 1 ? 'library' : 'libraries'} needed</p>
                    </div>
                  )}
                  {referral.pendingCount > 0 && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Pending Review</p>
                      <p className="font-bold text-amber-600 tabular-nums">{referral.pendingCount}</p>
                    </div>
                  )}
                </div>

                {referral.nextLevel && (
                  <div className="mt-3 max-w-xs">
                    <div className="h-1.5 bg-violet-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-violet-500 rounded-full transition-all"
                        style={{ width: `${Math.min(100, (referral.qualifiedCount / referral.nextLevelThreshold) * 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {referral.qualifiedCount} / {referral.nextLevelThreshold} for {referral.nextLevelLabel}
                    </p>
                  </div>
                )}
              </div>

              {/* Right — actions */}
              <div className="shrink-0 flex flex-col gap-2">
                <Link href="/owner/subscription">
                  <Button size="sm" variant="outline" className="gap-1.5 w-full">
                    <TrendingUp className="h-3.5 w-3.5" /> View Details
                  </Button>
                </Link>
                {referral.referralUrl && (
                  <Button
                    size="sm"
                    className="gap-1.5 w-full bg-violet-600 hover:bg-violet-700"
                    onClick={() => {
                      navigator.clipboard.writeText(referral.referralUrl!)
                        .catch(() => {})
                    }}
                  >
                    <Share2 className="h-3.5 w-3.5" /> Copy Referral Link
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status Alerts */}
      {isPending && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
          <Clock className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-800">Library Pending Approval</p>
            <p className="text-sm text-amber-700 mt-0.5">Your library is under review. You'll be notified once approved.</p>
          </div>
        </div>
      )}
      {isSuspended && (
        <div className="rounded-2xl bg-red-50 border border-red-200 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-800">Library Suspended</p>
            <p className="text-sm text-red-700 mt-0.5">Contact platform support to resolve this issue.</p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Total Seats" value={stats?.seats?.total ?? 0}
          subtitle={`${stats?.seats?.available ?? 0} available`} icon={<Armchair className="h-5 w-5" />}
          accentColor="bg-violet-500" />
        <StatCard title="Today's Bookings" value={stats?.bookings?.today ?? 0}
          icon={<BookOpen className="h-5 w-5" />} accentColor="bg-indigo-500" />
        <StatCard title="Active Students" value={stats?.students?.active ?? 0}
          icon={<Users className="h-5 w-5" />} accentColor="bg-emerald-500" />
        <StatCard title="Today's Revenue" value={formatCurrency(stats?.revenue?.today ?? 0)}
          subtitle={`${formatCurrency(stats?.revenue?.monthly ?? 0)} this month`}
          icon={<TrendingUp className="h-5 w-5" />} accentColor="bg-amber-500" />
      </div>

      {/* Seat mini-status */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Available', val: stats?.seats?.available ?? 0, color: 'text-emerald-600 bg-emerald-50' },
          { label: 'Occupied',  val: stats?.seats?.occupied  ?? 0, color: 'text-indigo-600 bg-indigo-50'  },
          { label: 'Reserved',  val: stats?.seats?.reserved  ?? 0, color: 'text-violet-600 bg-violet-50'  },
          { label: 'Maintenance', val: stats?.seats?.maintenance ?? 0, color: 'text-amber-600 bg-amber-50' },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl ${s.color} p-4`}>
            <p className="text-xs font-medium opacity-70">{s.label}</p>
            <p className="text-2xl font-bold tabular-nums mt-1">{s.val}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Bookings */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle>Recent Bookings</CardTitle>
            <Link href="/owner/bookings"><Button variant="ghost" size="sm">View all</Button></Link>
          </CardHeader>
          <CardContent>
            {recentBookings.length === 0 ? (
              <EmptyState icon={<BookOpen className="h-6 w-6" />} title="No bookings yet"
                description="Bookings will appear here once students start booking seats." />
            ) : (
              <div className="space-y-3">
                {recentBookings.map(b => {
                  const planName = b.plan?.name || b.planNameSnapshot || 'Direct Booking'
                  const planPrice = Number(b.plan?.price || b.planPriceSnapshot || 0)
                  const totalAmount = Number(b.totalAmount)
                  return (
                    <div key={b.id} className="rounded-xl border border-slate-100 p-4 hover:shadow-sm transition-shadow">
                      <div className="flex items-start gap-3">
                        <div className="rounded-xl bg-indigo-100 p-2 text-indigo-600 font-bold text-sm w-10 h-10 flex items-center justify-center shrink-0">
                          {b.seat.label}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className="font-medium text-sm text-slate-900">{b.student.user.name}</p>
                            <Badge variant={b.status === 'CONFIRMED' ? 'active' : b.status === 'CANCELLED' ? 'suspended' : 'secondary'}>
                              {b.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-500 mb-1">{formatDateTime(b.startTime)}</p>
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-emerald-600 font-medium">{planName}</p>
                            <div className="text-right">
                              <p className="text-sm font-bold text-slate-900">{formatCurrency(totalAmount)}</p>
                              {planPrice > 0 && planPrice !== totalAmount && (
                                <p className="text-xs text-slate-400">plan: {formatCurrency(planPrice)}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick actions */}
        <Card>
          <CardHeader><CardTitle>Quick Actions</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {[
                { href: '/owner/seats',       label: 'Edit Seat Layout',  color: 'bg-violet-50 text-violet-700 hover:bg-violet-100' },
                { href: '/owner/bookings',    label: 'View Bookings',     color: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100' },
                { href: '/owner/memberships', label: 'Pricing Plans',      color: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' },
                { href: '/owner/library',     label: 'Edit Library Info', color: 'bg-amber-50 text-amber-700 hover:bg-amber-100' },
              ].map(a => (
                <Link key={a.href} href={a.href}>
                  <div className={`rounded-2xl ${a.color} px-4 py-4 text-sm font-medium text-center cursor-pointer transition-colors`}>
                    {a.label}
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
