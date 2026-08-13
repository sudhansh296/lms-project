'use client'

import { useRequireAuth, useAuth } from '@/contexts/auth-context'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { PageLoading } from '@/components/ui/loading'
import { useState } from 'react'
import {
  LayoutDashboard, Building2, Users, BarChart3, CreditCard,
  Settings, Bell, LogOut, BookOpen, ShieldCheck, Menu, X
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/libraries', label: 'Libraries', icon: Building2 },
  { href: '/admin/students', label: 'Students', icon: Users },
  { href: '/admin/revenue', label: 'Revenue', icon: CreditCard },
  { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/admin/notifications', label: 'Notifications', icon: Bell },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth()
  useRequireAuth('SUPER_ADMIN')
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  if (loading) return <PageLoading message="Loading admin panel..." />

  const SidebarContent = () => (
    <>
      <div className="flex items-center gap-2.5 px-6 py-5 border-b border-white/10">
        <div className="rounded-xl bg-indigo-600 p-2">
          <BookOpen className="h-4 w-4 text-white" />
        </div>
        <div>
          <p className="font-bold text-sm">StudyLib Admin</p>
          <p className="text-xs text-slate-400">Platform Control</p>
        </div>
      </div>
      <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/admin' && pathname.startsWith(href))
          return (
            <Link key={href} href={href} onClick={() => setSidebarOpen(false)}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                active ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'
              )}>
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>
      <div className="px-4 py-4 border-t border-white/10">
        <div className="flex items-center gap-3 px-3 py-2 mb-2">
          <div className="rounded-full bg-indigo-600 p-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.name}</p>
            <p className="text-xs text-slate-400">Super Admin</p>
          </div>
        </div>
        <button onClick={logout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-400 hover:bg-white/5 hover:text-red-400 transition-colors">
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </>
  )

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:fixed lg:inset-y-0 lg:w-64 flex-col bg-slate-950 text-white z-30">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 flex flex-col bg-slate-950 text-white shadow-xl">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main */}
      <main className="flex-1 lg:pl-64 min-h-screen">
        {/* Mobile/Tablet Header */}
        <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-slate-950 text-white sticky top-0 z-30 shadow">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-indigo-400" />
            <span className="font-bold">StudyLib Admin</span>
          </div>
          <button onClick={() => setSidebarOpen(true)} className="p-1.5 rounded-lg hover:bg-white/10">
            <Menu className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4 sm:p-6">
          {children}
        </div>
      </main>
    </div>
  )
}
