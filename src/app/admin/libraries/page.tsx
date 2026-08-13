'use client'

import { useEffect, useState, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import { PageLoading } from '@/components/ui/loading'
import { Search, Eye, CheckCircle, XCircle, Pause, RotateCcw } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { formatDate } from '@/lib/utils'
import { useSearchParams, useRouter } from 'next/navigation'

const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'PENDING_VERIFICATION', label: 'Pending' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'CLOSED', label: 'Closed' },
]

const STATUS_VARIANT: Record<string, string> = {
  ACTIVE: 'active', PENDING_VERIFICATION: 'pending',
  SUSPENDED: 'suspended', REJECTED: 'rejected', CLOSED: 'closed',
}

interface Library {
  id: string; name: string; city: string; state: string; pincode: string; status: string; createdAt: string
  owner: { user: { name: string; mobile: string; email?: string } }
  _count: { seats: number; studentMemberships: number; bookings: number }
}

export default function AdminLibrariesPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [libraries, setLibraries] = useState<Library[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState(searchParams.get('status') ?? '')
  const [page, setPage] = useState(1)
  const [actionModal, setActionModal] = useState<{ lib: Library; action: string } | null>(null)
  const [reason, setReason] = useState('')
  const [acting, setActing] = useState(false)

  const fetchLibraries = useCallback(async () => {
    setLoading(true)
    const q = new URLSearchParams({ search, status, page: String(page), limit: '15' })
    const res = await fetch(`/api/admin/libraries?${q}`)
    const data = await res.json()
    setLibraries(data.libraries ?? [])
    setTotal(data.pagination?.total ?? 0)
    setLoading(false)
  }, [search, status, page])

  useEffect(() => { fetchLibraries() }, [fetchLibraries])

  const handleAction = async () => {
    if (!actionModal) return
    setActing(true)
    try {
      const res = await fetch(`/api/admin/libraries/${actionModal.lib.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: actionModal.action, reason }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Action failed'); return }
      toast.success(`Library ${actionModal.action.toLowerCase()}d successfully`)
      setActionModal(null)
      setReason('')
      fetchLibraries()
    } finally {
      setActing(false)
    }
  }

  const pages = Math.ceil(total / 15)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Libraries</h1>
          <p className="text-slate-500 text-sm">{total} total libraries on platform</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {STATUS_TABS.map((t) => (
          <button key={t.value} onClick={() => { setStatus(t.value); setPage(1) }}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
              status === t.value ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Search by name, owner, city, pincode..." />
      </div>

      {/* Table / Cards */}
      <Card>
        {loading ? <PageLoading /> : (
          <>
            {/* Desktop Table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['Library', 'Owner', 'Location', 'Seats', 'Members', 'Status', 'Created', 'Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {libraries.map((lib) => (
                    <tr key={lib.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-900">{lib.name}</td>
                      <td className="px-4 py-3">
                        <p className="text-slate-800">{lib.owner?.user?.name}</p>
                        <p className="text-xs text-slate-500">{lib.owner?.user?.mobile}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{lib.city}, {lib.state}</td>
                      <td className="px-4 py-3 text-center font-medium">{lib._count?.seats ?? 0}</td>
                      <td className="px-4 py-3 text-center font-medium">{lib._count?.studentMemberships ?? 0}</td>
                      <td className="px-4 py-3">
                        <Badge variant={STATUS_VARIANT[lib.status] as 'active' | 'pending' | 'suspended' | 'rejected' | 'closed'}>
                          {lib.status.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{formatDate(lib.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Link href={`/admin/libraries/${lib.id}`}>
                            <Button size="icon" variant="ghost" className="h-8 w-8"><Eye className="h-3.5 w-3.5" /></Button>
                          </Link>
                          {lib.status === 'PENDING_VERIFICATION' && (
                            <>
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-600 hover:text-emerald-700" onClick={() => setActionModal({ lib, action: 'APPROVE' })}>
                                <CheckCircle className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:text-red-600" onClick={() => setActionModal({ lib, action: 'REJECT' })}>
                                <XCircle className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                          {lib.status === 'ACTIVE' && (
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-amber-500" onClick={() => setActionModal({ lib, action: 'SUSPEND' })}>
                              <Pause className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {lib.status === 'SUSPENDED' && (
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-indigo-600" onClick={() => setActionModal({ lib, action: 'REACTIVATE' })}>
                              <RotateCcw className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {libraries.length === 0 && (
                <div className="text-center py-12 text-slate-400">No libraries found</div>
              )}
            </div>

            {/* Mobile Cards */}
            <div className="sm:hidden divide-y divide-slate-100">
              {libraries.map((lib) => (
                <div key={lib.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-900">{lib.name}</p>
                      <p className="text-xs text-slate-500">{lib.city}, {lib.state}</p>
                    </div>
                    <Badge variant={STATUS_VARIANT[lib.status] as 'active' | 'pending' | 'suspended' | 'rejected' | 'closed'}>
                      {lib.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-600">Owner: {lib.owner?.user?.name} · {lib.owner?.user?.mobile}</p>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-500">{lib._count?.seats ?? 0} seats · {lib._count?.studentMemberships ?? 0} members</p>
                    <div className="flex gap-1">
                      <Link href={`/admin/libraries/${lib.id}`}>
                        <Button size="sm" variant="outline" className="h-7 text-xs">View</Button>
                      </Link>
                      {lib.status === 'PENDING_VERIFICATION' && (
                        <Button size="sm" variant="success" className="h-7 text-xs" onClick={() => setActionModal({ lib, action: 'APPROVE' })}>Approve</Button>
                      )}
                      {lib.status === 'ACTIVE' && (
                        <Button size="sm" variant="outline" className="h-7 text-xs text-amber-600" onClick={() => setActionModal({ lib, action: 'SUSPEND' })}>Suspend</Button>
                      )}
                      {lib.status === 'SUSPENDED' && (
                        <Button size="sm" variant="outline" className="h-7 text-xs text-indigo-600" onClick={() => setActionModal({ lib, action: 'REACTIVATE' })}>Reactivate</Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {libraries.length === 0 && (
                <div className="text-center py-12 text-slate-400">No libraries found</div>
              )}
            </div>
          </>
        )}

        {/* Pagination */}
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

      {/* Action Modal */}
      <Modal open={!!actionModal} onOpenChange={() => setActionModal(null)}
        title={`${actionModal?.action} Library`}
        description={`Are you sure you want to ${actionModal?.action?.toLowerCase()} "${actionModal?.lib?.name}"?`}>
        {actionModal?.action === 'REJECT' && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Reason (optional)</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
              rows={3} placeholder="Enter rejection reason..." />
          </div>
        )}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setActionModal(null)}>Cancel</Button>
          <Button
            variant={actionModal?.action === 'APPROVE' || actionModal?.action === 'REACTIVATE' ? 'success' : 'destructive'}
            loading={acting} onClick={handleAction}>
            Confirm {actionModal?.action}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
