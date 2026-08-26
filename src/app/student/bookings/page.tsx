'use client'

import { useEffect, useState, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageLoading } from '@/components/ui/loading'
import { EmptyState } from '@/components/ui/empty-state'
import { Modal } from '@/components/ui/modal'
import { BookOpen, Calendar, Clock, MapPin, Phone } from 'lucide-react'
import { formatDate, formatTime } from '@/lib/utils'
import toast from 'react-hot-toast'
import Link from 'next/link'

const TABS = [
  { value: '', label: 'All' },
  { value: 'CONFIRMED', label: 'Upcoming' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

const STATUS_VARIANT: Record<string, 'active' | 'pending' | 'suspended' | 'secondary'> = {
  CONFIRMED: 'active', ACTIVE: 'pending', COMPLETED: 'secondary', CANCELLED: 'suspended',
}

interface Booking {
  id: string; status: string; startTime: string; endTime: string
  bookingRef: string; totalAmount: number; bookingDate: string
  library: { id: string; name: string; city: string; phone?: string; photos: Array<{ url: string }> }
  seat: { label: string; seatType: string }
  payment: { status: string } | null
  attendance: { checkInAt: string | null; checkOutAt: string | null } | null
}

export default function StudentBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [cancelModal, setCancelModal] = useState<Booking | null>(null)
  const [cancelling, setCancelling] = useState(false)

  const fetchBookings = useCallback(async () => {
    setLoading(true)
    const q = new URLSearchParams({ page: String(page), limit: '10' })
    if (statusFilter) q.set('status', statusFilter)
    const res = await fetch(`/api/student/bookings?${q}`)
    const data = await res.json()
    setBookings(data.bookings ?? [])
    setTotal(data.pagination?.total ?? 0)
    setLoading(false)
  }, [statusFilter, page])

  useEffect(() => { fetchBookings() }, [fetchBookings])

  const cancelBooking = async (id: string) => {
    setCancelling(true)
    try {
      const res = await fetch(`/api/student/bookings/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed'); return }
      toast.success('Booking cancelled')
      setCancelModal(null)
      fetchBookings()
    } finally {
      setCancelling(false)
    }
  }

  const pages = Math.ceil(total / 10)

  return (
    <div className="px-4 py-4 space-y-4">
      <h1 className="text-xl font-bold text-slate-900">My Bookings</h1>

      {/* Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {TABS.map(t => (
          <button key={t.value} onClick={() => { setStatusFilter(t.value); setPage(1) }}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
              statusFilter === t.value ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? <PageLoading /> : bookings.length === 0 ? (
        <EmptyState icon={<BookOpen className="h-8 w-8" />} title="No bookings yet"
          description="Find a library and book a seat to get started."
          action={{ label: 'Explore Libraries', onClick: () => window.location.href = '/student/explore' }} />
      ) : (
        <div className="space-y-3">
          {bookings.map(b => (
            <div key={b.id} className="rounded-2xl bg-white border border-slate-100 overflow-hidden shadow-sm">
              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <p className="font-bold text-slate-900 text-sm">{b.library.name}</p>
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <MapPin className="h-3 w-3" /> {b.library.city}
                    </p>
                  </div>
                  <Badge variant={STATUS_VARIANT[b.status] ?? 'secondary'}>{b.status}</Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl bg-slate-50 px-3 py-2">
                    <p className="text-slate-400 mb-0.5">Seat</p>
                    <p className="font-bold text-slate-900">{b.seat.label}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-3 py-2">
                    <p className="text-slate-400 mb-0.5">Date</p>
                    <p className="font-bold text-slate-900">{formatDate(b.bookingDate)}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-3 py-2 col-span-2">
                    <p className="text-slate-400 mb-0.5">Time</p>
                    <p className="font-bold text-slate-900">{formatTime(b.startTime)} → {formatTime(b.endTime)}</p>
                  </div>
                </div>
              </div>

              {/* Footer actions */}
              <div className="border-t border-slate-100 px-4 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {b.library.phone && (
                    <a href={`tel:${b.library.phone}`}>
                      <button className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-600">
                        <Phone className="h-3.5 w-3.5" /> Call Library
                      </button>
                    </a>
                  )}
                </div>
                {/* P1-4 FIX: Only allow cancel for PENDING (unpaid) bookings */}
                {b.status === 'PENDING' && (
                  <button onClick={() => setCancelModal(b)}
                    className="text-xs text-red-500 hover:text-red-600 font-medium">
                    Cancel
                  </button>
                )}
                {/* Show final sale message for paid bookings */}
                {['CONFIRMED', 'ACTIVE'].includes(b.status) && (
                  <p className="text-xs text-slate-500 italic">
                    Paid bookings are final and cannot be cancelled
                  </p>
                )}
              </div>
            </div>
          ))}

          {pages > 1 && (
            <div className="flex justify-center gap-2 pt-2">
              <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
              <span className="text-xs text-slate-500 self-center">Page {page} of {pages}</span>
              <Button size="sm" variant="outline" disabled={page === pages} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          )}
        </div>
      )}

      {/* Cancel Modal */}
      <Modal open={!!cancelModal} onOpenChange={() => setCancelModal(null)} title="Cancel Booking">
        {cancelModal && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Are you sure you want to cancel your booking for seat <strong>{cancelModal.seat.label}</strong> at{' '}
              <strong>{cancelModal.library.name}</strong> on {formatDate(cancelModal.bookingDate)}?
            </p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setCancelModal(null)} className="flex-1">Keep It</Button>
              <Button variant="destructive" loading={cancelling}
                onClick={() => cancelBooking(cancelModal.id)} className="flex-1">
                Cancel Booking
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
