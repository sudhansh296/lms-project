'use client'

import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { LogOut, User, Phone, Mail, Shield } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'

export default function StudentProfilePage() {
  const { user, logout } = useAuth()

  return (
    <div className="px-4 py-6 space-y-4">
      {/* Avatar */}
      <div className="flex flex-col items-center text-center py-6">
        <div className="rounded-full bg-indigo-100 p-6 mb-3">
          <User className="h-10 w-10 text-indigo-600" />
        </div>
        <h1 className="text-xl font-bold text-slate-900">{user?.name}</h1>
        <p className="text-slate-500 text-sm mt-1">{user?.mobile}</p>
      </div>

      {/* Info Card */}
      <div className="rounded-2xl bg-white border border-slate-100 divide-y divide-slate-100">
        <div className="flex items-center gap-3 px-4 py-3.5">
          <div className="rounded-xl bg-slate-100 p-2">
            <Phone className="h-4 w-4 text-slate-500" />
          </div>
          <div>
            <p className="text-xs text-slate-400">Mobile</p>
            <p className="text-sm font-medium text-slate-900">{user?.mobile}</p>
          </div>
        </div>
        {user?.email && (
          <div className="flex items-center gap-3 px-4 py-3.5">
            <div className="rounded-xl bg-slate-100 p-2">
              <Mail className="h-4 w-4 text-slate-500" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Email</p>
              <p className="text-sm font-medium text-slate-900">{user.email}</p>
            </div>
          </div>
        )}
        <div className="flex items-center gap-3 px-4 py-3.5">
          <div className="rounded-xl bg-slate-100 p-2">
            <Shield className="h-4 w-4 text-slate-500" />
          </div>
          <div>
            <p className="text-xs text-slate-400">Account Type</p>
            <p className="text-sm font-medium text-slate-900 capitalize">{user?.role?.toLowerCase()}</p>
          </div>
        </div>
      </div>

      {/* Quick links */}
      <div className="rounded-2xl bg-white border border-slate-100 divide-y divide-slate-100">
        {[
          { href: '/student/bookings', label: 'My Bookings' },
          { href: '/student/memberships', label: 'My Memberships' },
          { href: '/student/notifications', label: 'Notifications' },
        ].map(item => (
          <Link key={item.href} href={item.href}>
            <div className="flex items-center justify-between px-4 py-3.5 hover:bg-slate-50 cursor-pointer">
              <span className="text-sm font-medium text-slate-700">{item.label}</span>
              <span className="text-slate-400">›</span>
            </div>
          </Link>
        ))}
      </div>

      {/* Logout */}
      <Button variant="outline" className="w-full text-red-500 border-red-200 hover:bg-red-50" onClick={logout}>
        <LogOut className="h-4 w-4" /> Sign Out
      </Button>
    </div>
  )
}
