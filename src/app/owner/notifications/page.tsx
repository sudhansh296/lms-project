'use client'

import { useEffect, useState } from 'react'
import { PageLoading } from '@/components/ui/loading'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { Bell, CheckCheck } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import toast from 'react-hot-toast'

interface Notification {
  id: string; type: string; title: string; message: string; isRead: boolean; createdAt: string
}

const TYPE_COLOR: Record<string, string> = {
  NEW_STUDENT:    'bg-indigo-100 text-indigo-700',
  NEW_MEMBERSHIP: 'bg-violet-100 text-violet-700',
  NEW_BOOKING:    'bg-emerald-100 text-emerald-700',
  PAYMENT_RECEIVED: 'bg-green-100 text-green-700',
  MEMBERSHIP_EXPIRING: 'bg-amber-100 text-amber-700',
  LIBRARY_APPROVED: 'bg-emerald-100 text-emerald-700',
  LIBRARY_REJECTED: 'bg-red-100 text-red-700',
  LIBRARY_SUSPENDED: 'bg-amber-100 text-amber-700',
  SUBSCRIPTION_EXPIRING: 'bg-red-100 text-red-700',
}

export default function OwnerNotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)

  const fetchNotifications = async () => {
    const res = await fetch('/api/notifications?limit=50')
    const data = await res.json()
    setNotifications(data.notifications ?? [])
    setUnreadCount(data.unreadCount ?? 0)
    setLoading(false)
  }

  useEffect(() => { fetchNotifications() }, [])

  const markAllRead = async () => {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markAll: true }),
    })
    toast.success('All marked as read')
    fetchNotifications()
  }

  if (loading) return <PageLoading />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
          <p className="text-slate-500 text-sm">{unreadCount} unread</p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead}>
            <CheckCheck className="h-4 w-4" /> Mark all read
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <EmptyState icon={<Bell className="h-8 w-8" />} title="No notifications" description="Notifications about your library will appear here." />
      ) : (
        <div className="space-y-2">
          {notifications.map(n => (
            <div key={n.id}
              className={`rounded-2xl border p-4 ${n.isRead ? 'bg-white border-slate-100' : 'bg-violet-50 border-violet-100'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap mt-0.5 ${TYPE_COLOR[n.type] ?? 'bg-slate-100 text-slate-600'}`}>
                    {n.type.replace(/_/g, ' ')}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-slate-900">{n.title}</p>
                    <p className="text-sm text-slate-600 mt-0.5">{n.message}</p>
                    <p className="text-xs text-slate-400 mt-1">{formatDateTime(n.createdAt)}</p>
                  </div>
                </div>
                {!n.isRead && <div className="w-2 h-2 rounded-full bg-violet-600 mt-1.5 shrink-0" />}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
