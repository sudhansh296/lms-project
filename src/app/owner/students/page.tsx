'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageLoading } from '@/components/ui/loading'
import { EmptyState } from '@/components/ui/empty-state'
import { Search, Users } from 'lucide-react'
import { formatDate, getMembershipExpiryLabel } from '@/lib/utils'

interface StudentRecord {
  id: string; status: string; startDate: string; endDate: string; paidAmount: number
  student: {
    studentId: string
    user: { name: string; mobile: string; email?: string }
    bookings: Array<{ startTime: string; status: string; seat: { label: string } }>
  }
  plan: { name: string; durationDays: number }
}

export default function OwnerStudentsPage() {
  const [students, setStudents] = useState<StudentRecord[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const fetchStudents = useCallback(async () => {
    setLoading(true)
    const q = new URLSearchParams({ page: String(page), limit: '20' })
    const res = await fetch(`/api/owner/students?${q}`)
    const data = await res.json()
    setStudents(data.students ?? [])
    setTotal(data.pagination?.total ?? 0)
    setLoading(false)
  }, [page])

  useEffect(() => { fetchStudents() }, [fetchStudents])

  const filtered = search
    ? students.filter(s => {
        const q = search.toLowerCase()
        return (
          s.student.user.name.toLowerCase().includes(q) ||
          s.student.user.mobile.includes(q) ||
          (s.student.user.email ?? '').toLowerCase().includes(q)
        )
      })
    : students

  const pages = Math.ceil(total / 20)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Students</h1>
        <p className="text-slate-500 text-sm">{total} students with memberships at your library</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Search by name, mobile, email..." />
      </div>

      <Card>
        {loading ? <PageLoading /> : filtered.length === 0 ? (
          <EmptyState icon={<Users className="h-8 w-8" />} title="No students yet"
            description="Students who purchase memberships will appear here." />
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['Student', 'Mobile', 'Membership Plan', 'Start', 'Expiry', 'Status', 'Last Booking'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(s => {
                    const expiry = getMembershipExpiryLabel(s.endDate)
                    const lastBooking = s.student.bookings?.[0]
                    return (
                      <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-900">{s.student.user.name}</p>
                          {s.student.user.email && <p className="text-xs text-slate-500">{s.student.user.email}</p>}
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-700">{s.student.user.mobile}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium">{s.plan.name}</p>
                          <p className="text-xs text-slate-500">{s.plan.durationDays} days</p>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{formatDate(s.startDate)}</td>
                        <td className="px-4 py-3">
                          <p className="text-slate-600">{formatDate(s.endDate)}</p>
                          <p className={`text-xs font-medium mt-0.5 ${expiry.urgent ? 'text-red-500' : 'text-slate-400'}`}>
                            {expiry.label}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={s.status === 'ACTIVE' ? 'active' : 'suspended'}>
                            {s.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs">
                          {lastBooking ? (
                            <span>Seat {lastBooking.seat?.label} · {formatDate(lastBooking.startTime)}</span>
                          ) : <span className="text-slate-300">No bookings</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="sm:hidden divide-y divide-slate-100">
              {filtered.map(s => {
                const expiry = getMembershipExpiryLabel(s.endDate)
                const lastBooking = s.student.bookings?.[0]
                return (
                  <div key={s.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-900">{s.student.user.name}</p>
                        <p className="text-xs text-slate-500">{s.student.user.mobile}</p>
                        {s.student.user.email && <p className="text-xs text-slate-400">{s.student.user.email}</p>}
                      </div>
                      <Badge variant={s.status === 'ACTIVE' ? 'active' : 'suspended'}>
                        {s.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-slate-600">
                      <span className="font-medium">{s.plan.name}</span>
                      <span className="text-slate-400"> · {s.plan.durationDays} days</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>{formatDate(s.startDate)} → {formatDate(s.endDate)}</span>
                      <span className={`font-medium ${expiry.urgent ? 'text-red-500' : 'text-slate-400'}`}>
                        {expiry.label}
                      </span>
                    </div>
                    {lastBooking ? (
                      <p className="text-xs text-slate-400">Last: Seat {lastBooking.seat?.label} · {formatDate(lastBooking.startTime)}</p>
                    ) : (
                      <p className="text-xs text-slate-300">No bookings yet</p>
                    )}
                  </div>
                )
              })}
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
    </div>
  )
}
