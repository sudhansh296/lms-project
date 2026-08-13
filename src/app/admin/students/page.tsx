'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageLoading } from '@/components/ui/loading'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'

interface Student {
  id: string; name: string; mobile: string; email?: string; createdAt: string; isActive: boolean
  student: {
    studentId: string
    memberships: Array<{ library: { name: string }; status: string }>
    _count: { bookings: number; payments: number }
  }
}

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const fetchStudents = useCallback(async () => {
    setLoading(true)
    const q = new URLSearchParams({ search, page: String(page), limit: '20' })
    const res = await fetch(`/api/admin/students?${q}`)
    const data = await res.json()
    setStudents(data.students ?? [])
    setTotal(data.pagination?.total ?? 0)
    setLoading(false)
  }, [search, page])

  useEffect(() => { fetchStudents() }, [fetchStudents])

  const pages = Math.ceil(total / 20)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Students</h1>
        <p className="text-slate-500 text-sm">{total} students registered on platform</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Search by name, mobile, email, student ID..." />
      </div>

      <Card>
        {loading ? <PageLoading /> : (
          <>
            {/* Desktop Table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['Student', 'Mobile', 'Student ID', 'Libraries', 'Bookings', 'Registered', 'Status'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => (
                    <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{s.name}</p>
                        {s.email && <p className="text-xs text-slate-500">{s.email}</p>}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-700">{s.mobile}</td>
                      <td className="px-4 py-3 text-xs text-slate-500 font-mono">{s.student?.studentId?.slice(-8)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {s.student?.memberships?.slice(0, 2).map((m, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">{m.library?.name}</Badge>
                          ))}
                          {(s.student?.memberships?.length ?? 0) > 2 && (
                            <Badge variant="secondary">+{s.student.memberships.length - 2}</Badge>
                          )}
                          {(s.student?.memberships?.length ?? 0) === 0 && <span className="text-slate-400 text-xs">None</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center font-medium">{s.student?._count?.bookings ?? 0}</td>
                      <td className="px-4 py-3 text-slate-500">{formatDate(s.createdAt)}</td>
                      <td className="px-4 py-3">
                        <Badge variant={s.isActive ? 'active' : 'suspended'}>{s.isActive ? 'Active' : 'Inactive'}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {students.length === 0 && (
                <div className="text-center py-12 text-slate-400">No students found</div>
              )}
            </div>

            {/* Mobile Cards */}
            <div className="sm:hidden divide-y divide-slate-100">
              {students.map((s) => (
                <div key={s.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-900">{s.name}</p>
                      {s.email && <p className="text-xs text-slate-400">{s.email}</p>}
                    </div>
                    <Badge variant={s.isActive ? 'active' : 'suspended'}>{s.isActive ? 'Active' : 'Inactive'}</Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span className="font-mono">{s.mobile}</span>
                    <span className="font-mono text-slate-400">#{s.student?.studentId?.slice(-8)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex flex-wrap gap-1">
                      {s.student?.memberships?.slice(0, 2).map((m, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">{m.library?.name}</Badge>
                      ))}
                      {(s.student?.memberships?.length ?? 0) > 2 && (
                        <Badge variant="secondary">+{s.student.memberships.length - 2}</Badge>
                      )}
                      {(s.student?.memberships?.length ?? 0) === 0 && <span className="text-xs text-slate-400">No memberships</span>}
                    </div>
                    <span className="text-xs text-slate-500">{s.student?._count?.bookings ?? 0} bookings</span>
                  </div>
                  <p className="text-xs text-slate-400">Joined {formatDate(s.createdAt)}</p>
                </div>
              ))}
              {students.length === 0 && (
                <div className="text-center py-12 text-slate-400">No students found</div>
              )}
            </div>
          </>
        )}
        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <p className="text-sm text-slate-500">Page {page} of {pages} · {total} students</p>
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
