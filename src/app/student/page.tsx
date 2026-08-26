'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { PageLoading } from '@/components/ui/loading'
import { EmptyState } from '@/components/ui/empty-state'
import { Badge } from '@/components/ui/badge'
import { formatDate, formatTime, getMembershipExpiryLabel, formatCurrency } from '@/lib/utils'
import Link from 'next/link'
import { MapPin, Clock, BookOpen, CreditCard, ArrowRight, Calendar } from 'lucide-react'

interface DashboardData {
  activeMemberships: Array<{
    id: string; endDate: string; status: string
    library: { id: string; name: string; city: string; phone: string; photos: Array<{ url: string }> }
    plan: { name: string }
  }>
  upcomingBookings: Array<{
    id: string; startTime: string; endTime: string; status: string
    library: { name: string; city: string }
    seat: { label: string; seatType: string }
  }>
  activeBooking: {
    id: string; startTime: string; endTime: string
    library: { name: string }
    seat: { label: string }
  } | null
  recentPayments: Array<{
    id: string; amount: number; status: string; createdAt: string
    booking?: { library: { name: string } } | null
    membership?: { library: { name: string }; plan: { name: string } } | null
  }>
}

export default function StudentDashboard() {
  const { user } = useAuth()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/student/dashboard').then(r => r.json()).then(setData).finally(() => setLoading(false))
  }, [])

  if (loading) return <PageLoading />

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  return (
    <div className="space-y-4 px-4 py-4">
      {/* Greeting */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">{greeting()}, {user?.name?.split(' ')[0]} 👋</h1>
        <p className="text-sm text-slate-500 mt-0.5">Ready to study today?</p>
      </div>

      {/* Active Booking */}
      {data?.activeBooking && (
        <div className="rounded-2xl bg-indigo-600 p-4 text-white">
          <div className="flex items-center gap-2 mb-2">
            <div className="rounded-lg bg-white/20 p-1.5">
              <BookOpen className="h-3.5 w-3.5" />
            </div>
            <span className="text-sm font-semibold">Currently Studying</span>
          </div>
          <p className="font-bold text-lg">{data.activeBooking.library.name}</p>
          <p className="text-indigo-200 text-sm">Seat {data.activeBooking.seat.label}</p>
          <div className="flex items-center gap-1.5 mt-2 text-indigo-100 text-sm">
            <Clock className="h-3.5 w-3.5" />
            {formatTime(data.activeBooking.startTime)} — {formatTime(data.activeBooking.endTime)}
          </div>
        </div>
      )}

      {/* Quick Action */}
      <Link href="/student/explore">
        <div className="rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 p-4 text-white flex items-center gap-3 cursor-pointer hover:opacity-95 transition-opacity">
          <div className="rounded-xl bg-white/20 p-2.5">
            <MapPin className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="font-bold">Find a Library Near You</p>
            <p className="text-indigo-200 text-sm mt-0.5">Book a seat in minutes</p>
          </div>
          <ArrowRight className="h-5 w-5 text-indigo-200" />
        </div>
      </Link>

      {/* Active Memberships - LEGACY DATA ONLY (for reference) */}
      {/* FIX 16, 17: Memberships are DEPRECATED. Access is booking-driven. */}
      {/* This section shows legacy membership records only - they do NOT grant library access. */}
      {(data?.activeMemberships.length ?? 0) > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-slate-900">Legacy Memberships</h2>
            <Link href="/student/expiry" className="text-xs text-indigo-600 font-medium">View expiry</Link>
          </div>
          <div className="space-y-2">
            {data!.activeMemberships.map(m => {
              const expiry = getMembershipExpiryLabel(m.endDate)
              return (
                <div key={m.id} className="rounded-2xl bg-white border border-slate-100 p-4 flex items-center gap-3 shadow-sm">
                  <div className="rounded-xl bg-indigo-50 p-2.5 shrink-0">
                    <CreditCard className="h-4 w-4 text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-slate-900 truncate">{m.library.name}</p>
                    <p className="text-xs text-slate-500">{m.plan.name} (legacy)</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-xs font-bold ${expiry.urgent ? 'text-red-500' : 'text-slate-500'}`}>
                      {expiry.label}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">{formatDate(m.endDate)}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Upcoming Bookings */}
      {(data?.upcomingBookings.length ?? 0) > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-slate-900">Upcoming Bookings</h2>
            <Link href="/student/bookings" className="text-xs text-indigo-600 font-medium">View all</Link>
          </div>
          <div className="space-y-2">
            {data!.upcomingBookings.map(b => (
              <div key={b.id} className="rounded-2xl bg-white border border-slate-100 p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-sm text-slate-900">{b.library.name}</p>
                    <p className="text-xs text-slate-500">{b.library.city}</p>
                  </div>
                  <Badge variant="secondary" className="text-xs">{b.seat.label}</Badge>
                </div>
                <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatDate(b.startTime)} · {formatTime(b.startTime)} — {formatTime(b.endTime)}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* No bookings CTA */}
      {(data?.activeMemberships.length ?? 0) === 0 && (data?.upcomingBookings.length ?? 0) === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center">
          <BookOpen className="h-10 w-10 mx-auto text-slate-300 mb-3" />
          <p className="font-semibold text-slate-700">Start your study journey</p>
          <p className="text-sm text-slate-400 mt-1 mb-4">Find a library near you and book a seat to get started.</p>
          <Link href="/student/explore">
            <button className="rounded-xl bg-indigo-600 text-white px-6 py-2.5 text-sm font-medium hover:bg-indigo-700 transition-colors">
              Explore Libraries
            </button>
          </Link>
        </div>
      )}

      {/* Recent Payments */}
      {(data?.recentPayments.length ?? 0) > 0 && (
        <section>
          <h2 className="font-bold text-slate-900 mb-3">Recent Payments</h2>
          <div className="space-y-2">
            {data!.recentPayments.map(p => (
              <div key={p.id} className="rounded-2xl bg-white border border-slate-100 p-4 flex items-center gap-3 shadow-sm">
                <div className="rounded-xl bg-emerald-50 p-2.5 shrink-0">
                  <CreditCard className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {p.membership?.library?.name ?? p.booking?.library?.name ?? 'Payment'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {p.membership ? `${p.membership.plan.name}` : 'Seat booking'}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-slate-900">{formatCurrency(p.amount)}</p>
                  <Badge variant={p.status === 'PAID' ? 'active' : 'pending'} className="text-[10px] mt-0.5">
                    {p.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
