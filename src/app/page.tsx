'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { BookOpen, Building2, ShieldCheck, MapPin, Clock, Users, ArrowRight } from 'lucide-react'
import { LoadingSpinner } from '@/components/ui/loading'

export default function HomePage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (!user) return
    if (user.role === 'SUPER_ADMIN') router.push('/admin')
    else if (['LIBRARY_OWNER', 'LIBRARY_MANAGER', 'LIBRARY_STAFF'].includes(user.role)) router.push('/owner')
    else router.push('/student')
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-5 max-w-6xl mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="rounded-xl bg-indigo-600 p-2">
            <BookOpen className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold text-white">StudyLib</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login">
            <Button variant="ghost" className="text-slate-300 hover:text-white hover:bg-white/10">
              Sign In
            </Button>
          </Link>
          <Link href="/register">
            <Button className="bg-indigo-600 hover:bg-indigo-500">
              Get Started
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="max-w-6xl mx-auto px-6 pt-16 pb-24">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 rounded-full bg-indigo-900/50 border border-indigo-700/50 px-4 py-1.5 text-sm text-indigo-300 mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
            Study Space Booking Platform
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-white leading-tight mb-6">
            Your Focused Study
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">
              Starts Here
            </span>
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-10">
            Find premium study libraries near you, book seats by the hour, and enjoy a distraction-free environment
            with world-class amenities.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register">
              <Button size="lg" className="bg-indigo-600 hover:bg-indigo-500 gap-2 min-w-[180px]">
                Find a Library <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/register/owner">
              <Button size="lg" variant="outline" className="bg-white/5 border-white/20 text-white hover:bg-white/10 min-w-[180px]">
                Register Your Library
              </Button>
            </Link>
          </div>
        </div>

        {/* Role Cards */}
        <div className="grid md:grid-cols-3 gap-6 mt-8">
          <RoleCard
            icon={<Users className="h-6 w-6" />}
            title="For Students"
            description="Find libraries, book seats flexibly, manage memberships, and study without interruptions."
            href="/register"
            color="bg-indigo-600"
            action="Register as Student"
          />
          <RoleCard
            icon={<Building2 className="h-6 w-6" />}
            title="For Library Owners"
            description="List your study space, manage seats with a visual editor, track revenue, and grow your student base."
            href="/register/owner"
            color="bg-violet-600"
            action="Register Your Library"
          />
          <RoleCard
            icon={<ShieldCheck className="h-6 w-6" />}
            title="Platform Admin"
            description="Oversee all libraries, manage approvals, monitor revenue, and maintain platform health."
            href="/login?role=admin"
            color="bg-emerald-600"
            action="Admin Login"
          />
        </div>

        {/* Features */}
        <div className="mt-20 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { icon: <MapPin className="h-5 w-5" />, title: 'Location-Based Search', desc: 'Find nearby libraries on an interactive map' },
            { icon: <Clock className="h-5 w-5" />, title: 'Flexible Booking', desc: 'Book any time slot — no fixed hours, your schedule' },
            { icon: <Users className="h-5 w-5" />, title: 'Seat Availability', desc: 'Real-time seat map showing live availability' },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl bg-white/5 border border-white/10 p-6">
              <div className="rounded-xl bg-indigo-600/20 text-indigo-400 p-2.5 w-fit mb-4">{f.icon}</div>
              <h3 className="font-semibold text-white mb-1">{f.title}</h3>
              <p className="text-sm text-slate-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 text-center text-sm text-slate-500">
        <p>© {new Date().getFullYear()} StudyLib Platform. All rights reserved.</p>
      </footer>
    </div>
  )
}

function RoleCard({
  icon, title, description, href, color, action
}: {
  icon: React.ReactNode; title: string; description: string; href: string; color: string; action: string
}) {
  return (
    <Link href={href} className="group block rounded-2xl bg-white/5 border border-white/10 p-6 hover:bg-white/10 hover:border-white/20 transition-all">
      <div className={`rounded-xl ${color} p-3 w-fit mb-4 text-white`}>{icon}</div>
      <h3 className="font-semibold text-white mb-2">{title}</h3>
      <p className="text-sm text-slate-400 mb-4">{description}</p>
      <span className="inline-flex items-center gap-1 text-sm font-medium text-indigo-400 group-hover:gap-2 transition-all">
        {action} <ArrowRight className="h-3.5 w-3.5" />
      </span>
    </Link>
  )
}
