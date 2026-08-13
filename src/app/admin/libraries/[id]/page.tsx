'use client'

import { useEffect, useState, use } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import { PageLoading } from '@/components/ui/loading'
import { ArrowLeft, MapPin, Phone, Mail, Building2, Star, CheckCircle, XCircle, Pause, RotateCcw } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { formatCurrency, formatDate } from '@/lib/utils'

const STATUS_VARIANT: Record<string, string> = {
  ACTIVE: 'active', PENDING_VERIFICATION: 'pending',
  SUSPENDED: 'suspended', REJECTED: 'rejected', CLOSED: 'closed',
}

export default function AdminLibraryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [data, setData] = useState<{
    library: Record<string, unknown>; totalRevenue: number
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [action, setAction] = useState('')
  const [reason, setReason] = useState('')
  const [acting, setActing] = useState(false)
  const [editingRazorpay, setEditingRazorpay] = useState(false)
  const [razorpayAccountId, setRazorpayAccountId] = useState('')
  const [savingRazorpay, setSavingRazorpay] = useState(false)

  useEffect(() => {
    fetch(`/api/admin/libraries/${id}`)
      .then(r => r.json())
      .then((d) => {
        setData(d)
        // Set current Razorpay account ID
        if (d?.library?.owner?.razorpayAccountId) {
          setRazorpayAccountId(d.library.owner.razorpayAccountId)
        }
      })
      .finally(() => setLoading(false))
  }, [id])

  const saveRazorpayAccount = async () => {
    setSavingRazorpay(true)
    try {
      const res = await fetch(`/api/admin/libraries/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ razorpayAccountId: razorpayAccountId.trim() || null }),
      })
      const d = await res.json()
      if (!res.ok) { toast.error(d.error ?? 'Failed to update'); return }
      toast.success(d.message ?? 'Razorpay account updated')
      setEditingRazorpay(false)
      // Refresh data
      fetch(`/api/admin/libraries/${id}`)
        .then(r => r.json())
        .then(setData)
    } finally {
      setSavingRazorpay(false)
    }
  }

  const performAction = async () => {
    setActing(true)
    try {
      const res = await fetch(`/api/admin/libraries/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason }),
      })
      const d = await res.json()
      if (!res.ok) { toast.error(d.error ?? 'Action failed'); return }
      toast.success(`Library ${action.toLowerCase()}d`)
      setData((prev) => prev ? { ...prev, library: d.library } : prev)
      setAction('')
      setReason('')
    } finally {
      setActing(false)
    }
  }

  if (loading) return <PageLoading />
  if (!data) return <div className="text-center py-16 text-slate-500">Library not found</div>

  const lib = data.library as Record<string, unknown> & {
    owner: { 
      user: { name: string; mobile: string; email: string }
      razorpayAccountId?: string
      razorpayAccountStatus?: string
    }
    photos: Array<{ url: string; isCover: boolean; category: string }>
    facilities: Array<{ name: string }>
    membershipPlans: Array<{ name: string; price: number; durationDays: number }>
    _count: { seats: number; bookings: number; studentMemberships: number }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/libraries"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900">{lib.name as string}</h1>
          <p className="text-slate-500 text-sm">{lib.city as string}, {lib.state as string}</p>
        </div>
        <Badge variant={STATUS_VARIANT[lib.status as string] as 'active' | 'pending' | 'suspended' | 'rejected' | 'closed'}>
          {(lib.status as string).replace('_', ' ')}
        </Badge>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 flex-wrap">
        {lib.status === 'PENDING_VERIFICATION' && (
          <>
            <Button variant="success" onClick={() => setAction('APPROVE')}><CheckCircle className="h-4 w-4" /> Approve</Button>
            <Button variant="destructive" onClick={() => setAction('REJECT')}><XCircle className="h-4 w-4" /> Reject</Button>
          </>
        )}
        {lib.status === 'ACTIVE' && (
          <Button variant="warning" onClick={() => setAction('SUSPEND')}><Pause className="h-4 w-4" /> Suspend</Button>
        )}
        {lib.status === 'SUSPENDED' && (
          <Button onClick={() => setAction('REACTIVATE')}><RotateCcw className="h-4 w-4" /> Reactivate</Button>
        )}
        {(lib.status === 'ACTIVE' || lib.status === 'SUSPENDED') && (
          <Button variant="outline" onClick={() => setAction('CLOSE')}>Close Library</Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Seats', value: lib._count.seats },
          { label: 'Active Members', value: lib._count.studentMemberships },
          { label: 'Total Bookings', value: lib._count.bookings },
          { label: 'Total Revenue', value: formatCurrency(data.totalRevenue) },
        ].map((s) => (
          <Card key={s.label} className="p-4">
            <p className="text-xs text-slate-500">{s.label}</p>
            <p className="text-xl font-bold mt-1 tabular-nums text-slate-900">{s.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Library Info */}
        <Card>
          <CardHeader><CardTitle>Library Information</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Name" value={lib.name as string} />
            <Row label="Description" value={(lib.description as string) ?? '—'} />
            <Row icon={<Phone className="h-3.5 w-3.5" />} label="Phone" value={(lib.phone as string) ?? '—'} />
            <Row icon={<Mail className="h-3.5 w-3.5" />} label="Email" value={(lib.emailContact as string) ?? '—'} />
            <Row icon={<MapPin className="h-3.5 w-3.5" />} label="Address"
              value={`${lib.addressLine1 as string ?? ''}, ${lib.city as string}, ${lib.state as string} ${lib.pincode as string}`} />
            <Row label="Registered" value={formatDate(lib.createdAt as string)} />
            {(lib.rejectionReason as string | null) && <Row label="Rejection Reason" value={lib.rejectionReason as string} />}
          </CardContent>
        </Card>

        {/* Owner Info */}
        <Card>
          <CardHeader><CardTitle>Owner Information</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Owner Name" value={lib.owner.user.name} />
            <Row icon={<Phone className="h-3.5 w-3.5" />} label="Mobile" value={lib.owner.user.mobile} />
            <Row icon={<Mail className="h-3.5 w-3.5" />} label="Email" value={lib.owner.user.email ?? '—'} />
            
            {/* Razorpay Account Section */}
            <div className="pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Razorpay Payout Account
                </p>
                {!editingRazorpay && (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => setEditingRazorpay(true)}
                    className="h-7 text-xs"
                  >
                    {lib.owner.razorpayAccountId ? 'Edit' : 'Add'}
                  </Button>
                )}
              </div>
              
              {editingRazorpay ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={razorpayAccountId}
                    onChange={(e) => setRazorpayAccountId(e.target.value)}
                    placeholder="acc_XXXXXXXXXXXXX"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      onClick={saveRazorpayAccount} 
                      loading={savingRazorpay}
                      className="flex-1"
                    >
                      Save
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => {
                        setEditingRazorpay(false)
                        setRazorpayAccountId(lib.owner.razorpayAccountId ?? '')
                      }}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  </div>
                  <p className="text-xs text-slate-500">
                    Student booking payments will be automatically transferred to this account
                  </p>
                </div>
              ) : (
                <div>
                  {lib.owner.razorpayAccountId ? (
                    <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2">
                      <div className="flex items-center gap-2 mb-1">
                        <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                        <span className="text-xs font-medium text-emerald-800">Account Linked</span>
                        <Badge className="text-[10px] bg-emerald-600">
                          {lib.owner.razorpayAccountStatus ?? 'ACTIVE'}
                        </Badge>
                      </div>
                      <p className="text-xs font-mono text-emerald-700">{lib.owner.razorpayAccountId}</p>
                    </div>
                  ) : (
                    <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                      <div className="flex items-center gap-2 mb-1">
                        <XCircle className="h-3.5 w-3.5 text-amber-600" />
                        <span className="text-xs font-medium text-amber-800">Not Linked</span>
                      </div>
                      <p className="text-xs text-amber-700">
                        Student payments will be held in platform account
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Facilities */}
      {lib.facilities.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Facilities</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {lib.facilities.map((f) => (
                <Badge key={f.name} variant="secondary">{f.name.replace(/_/g, ' ')}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Membership Plans */}
      {lib.membershipPlans?.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Membership Plans</CardTitle></CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {lib.membershipPlans.map((p) => (
                <div key={p.name} className="rounded-xl border border-slate-100 p-4">
                  <p className="font-medium text-slate-900">{p.name}</p>
                  <p className="text-lg font-bold text-indigo-600 mt-1">{formatCurrency(p.price)}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{p.durationDays} days</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Modal */}
      <Modal open={!!action} onOpenChange={() => setAction('')}
        title={`${action} Library`}
        description={`Confirm action on "${lib.name as string}"`}>
        {action === 'REJECT' && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Reason (optional)</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
              rows={3} placeholder="Enter rejection reason..." />
          </div>
        )}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setAction('')}>Cancel</Button>
          <Button variant={action === 'APPROVE' || action === 'REACTIVATE' ? 'success' : 'destructive'}
            loading={acting} onClick={performAction}>
            Confirm
          </Button>
        </div>
      </Modal>
    </div>
  )
}

function Row({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      {icon && <span className="mt-0.5 text-slate-400">{icon}</span>}
      <span className="w-28 shrink-0 text-slate-500">{label}</span>
      <span className="text-slate-900 font-medium flex-1">{value}</span>
    </div>
  )
}
