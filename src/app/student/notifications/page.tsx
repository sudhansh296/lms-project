'use client'

import { useEffect, useState } from 'react'
import { PageLoading } from '@/components/ui/loading'
import { EmptyState } from '@/components/ui/empty-state'
import { Bell, CheckCheck } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import toast from 'react-hot-toast'

interface Notification {
  id: string; type: string; title: string; message: string; isRead: boolean; createdAt: string
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)

  const fetchNotifications = async () => {
    const res = await fetch('/api/notifications')
    const data = await res.json()
    setNotifications(data.notifications ?? [])
    setUnreadCount(data.unreadCount ?? 0)
    setLoading(false)
  }

  useEffect(() => { fetchNotifications() }, [])

  const markAllRead = async () => {
    await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ markAll: true }) })
    toast.success('All marked as read')
    fetchNotifications()
  }

  if (loading) return <PageLoading />

  return (
    <div className="px-4 py-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Notifications</h1>
        {unreadCount > 0 && (
          <Button size="sm" variant="ghost" onClick={markAllRead}>
            <CheckCheck className="h-4 w-4" /> Mark all read
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <EmptyState icon={<Bell className="h-8 w-8" />} title="No notifications" description="You're all caught up!" />
      ) : (
        <div className="space-y-2">
          {notifications.map(n => (
            <div key={n.id} className={`rounded-2xl border p-4 transition-colors ${
              n.isRead ? 'bg-white border-slate-100' : 'bg-indigo-50 border-indigo-100'
            }`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className={`text-sm font-semibold ${n.isRead ? 'text-slate-700' : 'text-indigo-900'}`}>{n.title}</p>
                  <p className={`text-xs mt-0.5 ${n.isRead ? 'text-slate-500' : 'text-indigo-700'}`}>{n.message}</p>
                  <p className="text-xs text-slate-400 mt-1.5">{formatDateTime(n.createdAt)}</p>
                </div>
                {!n.isRead && <div className="w-2 h-2 rounded-full bg-indigo-600 mt-1 shrink-0" />}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
