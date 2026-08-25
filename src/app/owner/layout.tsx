'use client'

import { useRequireAuth, useAuth } from '@/contexts/auth-context'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { PageLoading } from '@/components/ui/loading'
import { useState } from 'react'
import {
  LayoutDashboard, Users, BookOpen,
  BarChart3, Bell, LogOut, Settings, Building2, Grid3X3, Menu, Share2, IndianRupee
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/owner',              label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/owner/library',      label: 'My Library',   icon: Building2       },
  { href: '/owner/seats',        label: 'Seat Layout',  icon: Grid3X3         },
  { href: '/owner/bookings',     label: 'Bookings',     icon: BookOpen        },
  { href: '/owner/students',     label: 'Students',     icon: Users           },
  { href: '/owner/memberships',  label: 'Seat Pricing', icon: IndianRupee     },
  { href: '/owner/subscription', label: 'Referral',     icon: Share2          },
  { href: '/owner/revenue',      label: 'Revenue',      icon: BarChart3       },
  { href: '/owner/analytics',    label: 'Analytics',    icon: BarChart3       },
  { href: '/owner/notifications',label: 'Notifications',icon: Bell            },
  { href: '/owner/settings',     label: 'Settings',     icon: Settings        },
]

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth()
  useRequireAuth(['LIBRARY_OWNER', 'LIBRARY_MANAGER', 'LIBRARY_STAFF'])
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  if (loading) return <PageLoading message="Loading..." />

  const SidebarContent = () => (
    <>
      <div className="flex items-center gap-2.5 px-6 py-5 border-b border-slate-100">
        <div className="rounded-xl bg-violet-600 p-2">
          <Building2 className="h-4 w-4 text-white" />
        </div>
        <div>
          <p className="font-bold text-sm text-slate-900">Library Portal</p>
          <p className="text-xs text-slate-500">Owner Dashboard</p>
        </div>
      </div>
      <nav className="flex-1 px-4 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/owner' && pathname.startsWith(href))
          return (
            <Link key={href} href={href} onClick={() => setSidebarOpen(false)}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                active ? 'bg-violet-50 text-violet-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
              )}>
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>
      <div className="px-4 py-4 border-t border-slate-100">
        <div className="flex items-center gap-3 px-3 py-2 mb-2">
          <div className="rounded-full bg-violet-100 p-1.5">
            <Building2 className="h-3.5 w-3.5 text-violet-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">{user?.name}</p>
            <p className="text-xs text-slate-400">Library Owner</p>
          </div>
        </div>
        <button onClick={logout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors">
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </>
  )

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:fixed lg:inset-y-0 lg:w-64 flex-col bg-white border-r border-slate-100 shadow-sm z-30">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 flex flex-col bg-white shadow-xl">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main */}
      <main className="flex-1 lg:pl-64 min-h-screen">
        <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-slate-100 sticky top-0 z-30 shadow-sm">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-violet-600" />
            <span className="font-bold text-slate-900">Library Portal</span>
          </div>
          <button onClick={() => setSidebarOpen(true)} className="p-1.5 rounded-lg hover:bg-slate-100">
            <Menu className="h-5 w-5 text-slate-600" />
          </button>
        </div>
        <div className="p-4 sm:p-6">{children}</div>
      </main>
    </div>
  )
}
