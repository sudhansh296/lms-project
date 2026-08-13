'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageLoading } from '@/components/ui/loading'
import { EmptyState } from '@/components/ui/empty-state'
import { CreditCard, Calendar, Phone } from 'lucide-react'
import { formatDate, getMembershipExpiryLabel, formatCurrency } from '@/lib/utils'
import Link from 'next/link'

interface Membership {
  id: string; status: string; startDate: string; endDate: string; paidAmount: number
  library: { id: string; name: string; city: string; phone?: string; photos: Array<{ url: string }> }
  plan: { name: string; durationDays: number; benefits: string[] }
  payment: { status: string; amount: number } | null
}

export default function StudentMembershipsPage() {
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/student/memberships').then(r => r.json()).then(d => {
      setMemberships(d.memberships ?? [])
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <PageLoading />

  const active = memberships.filter(m => m.status === 'ACTIVE')
  const expired = memberships.filter(m => m.status !== 'ACTIVE')

  return (
    <div className="px-4 py-4 space-y-4">
      <h1 className="text-xl font-bold text-slate-900">Memberships</h1>

      {memberships.length === 0 ? (
        <EmptyState
          icon={<CreditCard className="h-8 w-8" />}
          title="No memberships yet"
          description="Book a seat at any library — your membership is activated automatically after payment."
          action={{ label: 'Explore Libraries', onClick: () => window.location.href = '/student/explore' }}
        />
      ) : (
        <div className="space-y-4">
          {/* Active */}
          {active.length > 0 && (
            <section>
              <h2 className="text-sm font-bold text-slate-700 mb-2">Active</h2>
              <div className="space-y-3">
                {active.map(m => <MembershipCard key={m.id} m={m} />)}
              </div>
            </section>
          )}

          {/* Expired */}
          {expired.length > 0 && (
            <section>
              <h2 className="text-sm font-bold text-slate-500 mb-2">Expired / Cancelled</h2>
              <div className="space-y-3 opacity-70">
                {expired.map(m => <MembershipCard key={m.id} m={m} />)}
              </div>
            </section>
          )}
        </div>
      )}

      <div className="pt-2">
        <Link href="/student/explore">
          <Button variant="outline" className="w-full">
            <Calendar className="h-4 w-4" /> Book a Seat
          </Button>
        </Link>
      </div>
    </div>
  )
}

function MembershipCard({ m }: { m: Membership }) {
  const expiry = getMembershipExpiryLabel(m.endDate)
  return (
    <div className="rounded-2xl bg-white border border-slate-100 overflow-hidden shadow-sm">
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <p className="font-bold text-slate-900">{m.library.name}</p>
            <p className="text-xs text-slate-500 mt-0.5">{m.library.city}</p>
          </div>
          <Badge variant={m.status === 'ACTIVE' ? 'active' : 'suspended'}>{m.status}</Badge>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs mb-3">
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <p className="text-slate-400 mb-0.5">Plan</p>
            <p className="font-bold text-slate-900">{m.plan.name}</p>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <p className="text-slate-400 mb-0.5">Paid</p>
            <p className="font-bold text-slate-900">{formatCurrency(m.paidAmount)}</p>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <p className="text-slate-400 mb-0.5">Start</p>
            <p className="font-bold text-slate-900">{formatDate(m.startDate)}</p>
          </div>
          <div className={`rounded-xl px-3 py-2 ${expiry.urgent ? 'bg-red-50' : 'bg-slate-50'}`}>
            <p className={`mb-0.5 ${expiry.urgent ? 'text-red-400' : 'text-slate-400'}`}>Expiry</p>
            <p className={`font-bold text-xs ${expiry.urgent ? 'text-red-600' : 'text-slate-900'}`}>
              {expiry.label}
            </p>
          </div>
        </div>

        {m.plan.benefits.length > 0 && (
          <div className="space-y-1">
            {m.plan.benefits.slice(0, 3).map((b, i) => (
              <p key={i} className="text-xs text-slate-500">✓ {b}</p>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-slate-100 px-4 py-2.5 flex items-center justify-between">
        {m.library.phone && (
          <a href={`tel:${m.library.phone}`} className="text-xs text-indigo-600 font-medium flex items-center gap-1">
            <Phone className="h-3.5 w-3.5" /> Contact Library
          </a>
        )}
        {m.status === 'ACTIVE' && (
          <Link href={`/student/library/${m.library.id}/book`}>
            <button className="text-xs text-indigo-600 font-medium">
              Book Seat →
            </button>
          </Link>
        )}
      </div>
    </div>
  )
}
