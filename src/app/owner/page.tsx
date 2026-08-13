'use client'

import { useEffect, useState } from 'react'
import { StatCard } from '@/components/ui/stat-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageLoading } from '@/components/ui/loading'
import { EmptyState } from '@/components/ui/empty-state'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { Armchair, Users, BookOpen, CreditCard, Clock, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/auth-context'

interface OwnerStats {
  seats: { total: number; available: number; occupied: number; reserved: number; maintenance: number }
  bookings: { today: number }
  students: { active: number }
  memberships: { active: number; expiringSoon: number }
  revenue: { today: number; monthly: number }
}

interface Booking {
  id: string; status: string; startTime: string; endTime: string
  student: { user: { name: string; mobile: string } }
  seat: { label: string }
}

interface Subscription {
  status: string
  trialEnd: string | null
  endDate: string | null
  plan: {
    name: string
    price: number
    billingCycle: string
  }
}

export default function OwnerDashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState<OwnerStats | null>(null)
  const [library, setLibrary] = useState<{ name: string; status: string; city: string; owner: { subscription: Subscription | null } } | null>(null)
  const [recentBookings, setRecentBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/owner/stats').then(r => r.json()),
      fetch('/api/owner/library').then(r => r.json()),
      fetch('/api/owner/bookings?limit=5').then(r => r.json()),
    ]).then(([s, l, b]) => {
      setStats(s)
      setLibrary(l.library)
      setRecentBookings(b.bookings ?? [])
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <PageLoading />

  const isPending = library?.status === 'PENDING_VERIFICATION'
  const isSuspended = library?.status === 'SUSPENDED'
  const subscription = library?.owner?.subscription
  const subStatus = subscription?.status ?? 'NONE'
  
  // Calculate days remaining
  const getDaysRemaining = (endDate: string | null): number => {
    if (!endDate) return 0
    const end = new Date(endDate)
    const now = new Date()
    return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  }
  
  const trialDays = subscription?.trialEnd ? getDaysRemaining(subscription.trialEnd) : 0
  const expiryDays = subscription?.endDate ? getDaysRemaining(subscription.endDate) : 0

  return (
    <div className="space-y-6">
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

      {/* Subscription Status Card - Prominent */}
      {subscription && (
        <Card className={`border-2 ${
          subStatus === 'TRIAL' && trialDays <= 3 ? 'border-amber-300 bg-amber-50/50' :
          subStatus === 'EXPIRED' ? 'border-red-300 bg-red-50/50' :
          subStatus === 'ACTIVE' && expiryDays <= 7 ? 'border-amber-300 bg-amber-50/50' :
          'border-emerald-300 bg-emerald-50/50'
        }`}>
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <CreditCard className="h-5 w-5 text-slate-600" />
                  <h3 className="font-bold text-slate-900">Platform Subscription</h3>
                  <Badge variant={
                    subStatus === 'ACTIVE' ? 'active' :
                    subStatus === 'TRIAL' ? 'pending' :
                    subStatus === 'EXPIRED' ? 'suspended' : 'secondary'
                  }>
                    {subStatus}
                  </Badge>
                </div>
                
                <div className="grid sm:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Current Plan</p>
                    <p className="font-bold text-slate-900">{subscription.plan.name}</p>
                    <p className="text-xs text-slate-600">
                      {subscription.plan.price === 0 ? 'Free' : `₹${subscription.plan.price}/${subscription.plan.billingCycle === 'MONTHLY' ? 'mo' : 'yr'}`}
                    </p>
                  </div>
                  
                  {subStatus === 'TRIAL' && subscription.trialEnd && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Trial Period</p>
                      <p className={`font-bold ${trialDays <= 3 ? 'text-amber-600' : 'text-slate-900'}`}>
                        {trialDays > 0 ? `${trialDays} days left` : 'Expired'}
                      </p>
                      <p className="text-xs text-slate-600">
                        Ends {new Date(subscription.trialEnd).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                  
                  {subStatus === 'ACTIVE' && subscription.endDate && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Renewal Date</p>
                      <p className={`font-bold ${expiryDays <= 7 ? 'text-amber-600' : 'text-slate-900'}`}>
                        {new Date(subscription.endDate).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-slate-600">
                        {expiryDays > 0 ? `${expiryDays} days remaining` : 'Renew now'}
                      </p>
                    </div>
                  )}
                  
                  {subStatus === 'EXPIRED' && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Status</p>
                      <p className="font-bold text-red-600">Subscription Expired</p>
                      <p className="text-xs text-slate-600">Renew to continue</p>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="shrink-0">
                <Link href="/owner/subscription">
                  <Button 
                    size="sm"
                    variant={
                      subStatus === 'TRIAL' && trialDays <= 3 ? 'default' :
                      subStatus === 'EXPIRED' ? 'default' :
                      'outline'
                    }
                    className={
                      (subStatus === 'TRIAL' && trialDays <= 3) || subStatus === 'EXPIRED'
                        ? 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700'
                        : ''
                    }
                  >
                    {subStatus === 'TRIAL' && trialDays <= 3 ? 'Upgrade Now' :
                     subStatus === 'EXPIRED' ? 'Renew Plan' :
                     subStatus === 'ACTIVE' && expiryDays <= 7 ? 'Renew' :
                     'Manage Plan'}
                  </Button>
                </Link>
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

      {/* Expiring memberships alert */}
      {(stats?.memberships?.expiringSoon ?? 0) > 0 && (
        <div className="rounded-2xl bg-indigo-50 border border-indigo-200 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-indigo-800">{stats!.memberships.expiringSoon} memberships expiring soon</p>
            <p className="text-sm text-indigo-700 mt-0.5">Within the next 5 days.</p>
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
        <StatCard title="Active Members" value={stats?.memberships?.active ?? 0}
          icon={<Users className="h-5 w-5" />} accentColor="bg-emerald-500" />
        <StatCard title="Today's Revenue" value={formatCurrency(stats?.revenue?.today ?? 0)}
          subtitle={`${formatCurrency(stats?.revenue?.monthly ?? 0)} this month`}
          icon={<CreditCard className="h-5 w-5" />} accentColor="bg-amber-500" />
      </div>

      {/* Seat mini-status */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Available', val: stats?.seats?.available ?? 0, color: 'text-emerald-600 bg-emerald-50' },
          { label: 'Occupied', val: stats?.seats?.occupied ?? 0, color: 'text-indigo-600 bg-indigo-50' },
          { label: 'Reserved', val: stats?.seats?.reserved ?? 0, color: 'text-violet-600 bg-violet-50' },
          { label: 'Maintenance', val: stats?.seats?.maintenance ?? 0, color: 'text-amber-600 bg-amber-50' },
        ].map((s) => (
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
                {recentBookings.map((b) => (
                  <div key={b.id} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3">
                    <div className="rounded-xl bg-indigo-100 p-2 text-indigo-600 font-bold text-sm w-10 h-10 flex items-center justify-center shrink-0">
                      {b.seat.label}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-slate-900">{b.student.user.name}</p>
                      <p className="text-xs text-slate-500">{formatDateTime(b.startTime)}</p>
                    </div>
                    <Badge variant={b.status === 'CONFIRMED' ? 'active' : b.status === 'CANCELLED' ? 'suspended' : 'secondary'}>
                      {b.status}
                    </Badge>
                  </div>
                ))}
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
                { href: '/owner/seats', label: 'Edit Seat Layout', color: 'bg-violet-50 text-violet-700 hover:bg-violet-100' },
                { href: '/owner/bookings?action=new', label: 'Add Booking', color: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100' },
                { href: '/owner/memberships', label: 'Membership Plans', color: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' },
                { href: '/owner/library', label: 'Edit Library Info', color: 'bg-amber-50 text-amber-700 hover:bg-amber-100' },
              ].map((a) => (
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
