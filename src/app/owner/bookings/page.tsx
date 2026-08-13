'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { PageLoading } from '@/components/ui/loading'
import { EmptyState } from '@/components/ui/empty-state'
import { Search, BookOpen, CheckCircle, LogOut } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatDateTime, formatCurrency } from '@/lib/utils'

const STATUS_TABS = ['ALL', 'CONFIRMED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'NO_SHOW']

const STATUS_VARIANT: Record<string, 'active' | 'pending' | 'suspended' | 'secondary'> = {
  CONFIRMED: 'active', ACTIVE: 'pending', COMPLETED: 'secondary',
  CANCELLED: 'suspended', NO_SHOW: 'suspended', PENDING: 'pending',
}

interface Booking {
  id: string; status: string; startTime: string; endTime: string
  totalAmount: number; bookingRef: string; bookingDate: string
  student: { user: { name: string; mobile: string } }
  seat: { label: string; seatType: string }
  payment: { status: string; amount: number } | null
  attendance: { checkInAt: string | null; checkOutAt: string | null } | null
}

export default function OwnerBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [date, setDate] = useState('')
  const [page, setPage] = useState(1)
  const [checkInModal, setCheckInModal] = useState<Booking | null>(null)
  const [acting, setActing] = useState(false)

  const fetchBookings = useCallback(async () => {
    setLoading(true)
    const q = new URLSearchParams({ page: String(page), limit: '20' })
    if (statusFilter !== 'ALL') q.set('status', statusFilter)
    if (date) q.set('date', date)
    const res = await fetch(`/api/owner/bookings?${q}`)
    const data = await res.json()
    setBookings(data.bookings ?? [])
    setTotal(data.pagination?.total ?? 0)
    setLoading(false)
  }, [statusFilter, date, page])

  useEffect(() => { fetchBookings() }, [fetchBookings])

  const handleAttendance = async (bookingId: string, action: 'CHECK_IN' | 'CHECK_OUT') => {
    setActing(true)
    try {
      const res = await fetch('/api/owner/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, action }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed'); return }
      toast.success(action === 'CHECK_IN' ? 'Student checked in' : 'Student checked out')
      setCheckInModal(null)
      fetchBookings()
    } finally {
      setActing(false)
    }
  }

  const filtered = search
    ? bookings.filter(b =>
        b.student.user.name.toLowerCase().includes(search.toLowerCase()) ||
        b.student.user.mobile.includes(search) ||
        b.seat.label.toLowerCase().includes(search.toLowerCase()) ||
        b.bookingRef.toLowerCase().includes(search.toLowerCase())
      )
    : bookings

  const pages = Math.ceil(total / 20)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Bookings</h1>
          <p className="text-slate-500 text-sm">{total} total bookings</p>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {STATUS_TABS.map(s => (
          <button key={s} onClick={() => { setStatusFilter(s); setPage(1) }}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
              statusFilter === s ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}>
            {s}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by student, seat, ref..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <input type="date" value={date} onChange={e => { setDate(e.target.value); setPage(1) }}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </div>

      <Card>
        {loading ? <PageLoading /> : filtered.length === 0 ? (
          <EmptyState icon={<BookOpen className="h-8 w-8" />} title="No bookings found"
            description="Bookings matching your filters will appear here." />
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['Booking Ref', 'Student', 'Seat', 'Date & Time', 'Amount', 'Payment', 'Status', 'Attendance', ''].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(b => (
                    <tr key={b.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{b.bookingRef?.slice(-8)}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{b.student.user.name}</p>
                        <p className="text-xs text-slate-500">{b.student.user.mobile}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary">{b.seat.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        <p>{formatDateTime(b.startTime)}</p>
                        <p className="text-xs text-slate-400">→ {formatDateTime(b.endTime)}</p>
                      </td>
                      <td className="px-4 py-3 font-medium">{formatCurrency(b.totalAmount)}</td>
                      <td className="px-4 py-3">
                        <Badge variant={b.payment?.status === 'PAID' ? 'active' : 'pending'}>
                          {b.payment?.status ?? 'N/A'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={STATUS_VARIANT[b.status] ?? 'secondary'}>{b.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {b.attendance?.checkInAt ? (
                          <span className="text-emerald-600 font-medium">✓ In</span>
                        ) : b.status === 'CONFIRMED' ? (
                          <span className="text-slate-400">Not checked in</span>
                        ) : null}
                        {b.attendance?.checkOutAt && <span className="ml-1 text-slate-400">✓ Out</span>}
                      </td>
                      <td className="px-4 py-3">
                        {b.status === 'CONFIRMED' && !b.attendance?.checkInAt && (
                          <Button size="sm" variant="outline" className="text-xs"
                            onClick={() => setCheckInModal(b)}>
                            <CheckCircle className="h-3.5 w-3.5" /> Check In
                          </Button>
                        )}
                        {b.status === 'ACTIVE' && b.attendance?.checkInAt && !b.attendance?.checkOutAt && (
                          <Button size="sm" variant="outline" className="text-xs"
                            onClick={() => handleAttendance(b.id, 'CHECK_OUT')}>
                            <LogOut className="h-3.5 w-3.5" /> Check Out
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="sm:hidden divide-y divide-slate-100">
              {filtered.map(b => (
                <div key={b.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-900">{b.student.user.name}</p>
                      <p className="text-xs text-slate-500">{b.student.user.mobile}</p>
                    </div>
                    <Badge variant={STATUS_VARIANT[b.status] ?? 'secondary'}>{b.status}</Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-600">
                    <Badge variant="secondary">{b.seat.label}</Badge>
                    <span className="font-mono text-slate-400">{b.bookingRef?.slice(-8)}</span>
                  </div>
                  <div className="text-xs text-slate-600 space-y-0.5">
                    <p>{formatDateTime(b.startTime)} → {formatDateTime(b.endTime)}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">{formatCurrency(b.totalAmount)}</span>
                      <Badge variant={b.payment?.status === 'PAID' ? 'active' : 'pending'}>
                        {b.payment?.status ?? 'N/A'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      {b.attendance?.checkInAt && (
                        <span className="text-xs text-emerald-600 font-medium">✓ In</span>
                      )}
                      {b.attendance?.checkOutAt && (
                        <span className="text-xs text-slate-400 ml-1">✓ Out</span>
                      )}
                      {b.status === 'CONFIRMED' && !b.attendance?.checkInAt && (
                        <Button size="sm" variant="outline" className="h-7 text-xs"
                          onClick={() => setCheckInModal(b)}>
                          <CheckCircle className="h-3.5 w-3.5" /> Check In
                        </Button>
                      )}
                      {b.status === 'ACTIVE' && b.attendance?.checkInAt && !b.attendance?.checkOutAt && (
                        <Button size="sm" variant="outline" className="h-7 text-xs"
                          onClick={() => handleAttendance(b.id, 'CHECK_OUT')}>
                          <LogOut className="h-3.5 w-3.5" /> Check Out
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <p className="text-sm text-slate-500">Page {page} of {pages}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
              <Button size="sm" variant="outline" disabled={page === pages} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </Card>

      <Modal open={!!checkInModal} onOpenChange={() => setCheckInModal(null)} title="Check In Student">
        {checkInModal && (
          <div className="space-y-4">
            <div className="rounded-xl bg-slate-50 p-4 space-y-2 text-sm">
              <p><span className="text-slate-500">Student:</span> <span className="font-medium">{checkInModal.student.user.name}</span></p>
              <p><span className="text-slate-500">Seat:</span> <span className="font-medium">{checkInModal.seat.label}</span></p>
              <p><span className="text-slate-500">Time:</span> <span className="font-medium">{formatDateTime(checkInModal.startTime)}</span></p>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setCheckInModal(null)}>Cancel</Button>
              <Button variant="success" loading={acting} onClick={() => handleAttendance(checkInModal.id, 'CHECK_IN')}>
                <CheckCircle className="h-4 w-4" /> Confirm Check In
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
