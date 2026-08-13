'use client'

import { useRequireAuth, useAuth } from '@/contexts/auth-context'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { PageLoading } from '@/components/ui/loading'
import { Home, Search, BookOpen, CreditCard, User } from 'lucide-react'
import { cn } from '@/lib/utils'

const BOTTOM_NAV = [
  { href: '/student', label: 'Home', icon: Home },
  { href: '/student/explore', label: 'Explore', icon: Search },
  { href: '/student/bookings', label: 'Bookings', icon: BookOpen },
  { href: '/student/expiry', label: 'Expiry', icon: CreditCard },
  { href: '/student/profile', label: 'Profile', icon: User },
]

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const { loading } = useAuth()
  useRequireAuth('STUDENT')
  const pathname = usePathname()

  if (loading) return <PageLoading message="Loading..." />

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-100 px-4 sm:px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-indigo-600 p-1.5">
            <BookOpen className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="font-bold text-slate-900">StudyLib</span>
        </div>
        {/* Desktop nav links */}
        <nav className="hidden md:flex items-center gap-1">
          {BOTTOM_NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== '/student' && pathname.startsWith(href))
            return (
              <Link key={href} href={href}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors',
                  active ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                )}>
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            )
          })}
        </nav>
      </header>

      {/* Content */}
      <main className="flex-1 pb-20 md:pb-6 overflow-y-auto max-w-5xl w-full mx-auto">
        {children}
      </main>

      {/* Bottom Navigation — mobile only */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 z-50">
        <div className="flex max-w-lg mx-auto">
          {BOTTOM_NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== '/student' && pathname.startsWith(href))
            return (
              <Link key={href} href={href} className="flex-1">
                <div className={cn(
                  'flex flex-col items-center gap-0.5 py-2 transition-colors',
                  active ? 'text-indigo-600' : 'text-slate-400'
                )}>
                  <Icon className="h-5 w-5" />
                  <span className="text-[10px] font-medium">{label}</span>
                </div>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
