'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { BookOpen, Eye, EyeOff, Phone, Lock } from 'lucide-react'
import toast from 'react-hot-toast'

type TabType = 'student' | 'owner' | 'admin'

function LoginForm() {
  const { login, user, loading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [tab, setTab] = useState<TabType>((searchParams.get('role') as TabType) ?? 'student')
  const [mobile, setMobile] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (loading || !user) return
    const redirect = searchParams.get('redirect')
    if (user.role === 'SUPER_ADMIN') router.replace(redirect ?? '/admin')
    else if (['LIBRARY_OWNER', 'LIBRARY_MANAGER', 'LIBRARY_STAFF'].includes(user.role)) router.replace(redirect ?? '/owner')
    else router.replace(redirect ?? '/student')
  }, [user, loading, router, searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!mobile || !password) { toast.error('Please fill all fields'); return }
    
    // FIX 3: Map tab to loginAs parameter
    const loginAsMap: Record<TabType, 'STUDENT' | 'OWNER' | 'ADMIN'> = {
      student: 'STUDENT',
      owner: 'OWNER',
      admin: 'ADMIN',
    }
    
    setSubmitting(true)
    const { error } = await login(mobile, password, loginAsMap[tab])
    setSubmitting(false)
    if (error) toast.error(error)
  }

  const tabs: { key: TabType; label: string }[] = [
    { key: 'student', label: 'Student' },
    { key: 'owner', label: 'Library Owner' },
    { key: 'admin', label: 'Platform Admin' },
  ]

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <Link href="/" className="inline-flex items-center gap-2.5 mb-4">
          <div className="rounded-xl bg-indigo-600 p-2.5">
            <BookOpen className="h-5 w-5 text-white" />
          </div>
          <span className="text-2xl font-bold text-white">StudyLib</span>
        </Link>
        <p className="text-slate-400 text-sm">Welcome back. Sign in to continue.</p>
      </div>

      <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm p-8">
        <div className="flex rounded-xl bg-white/5 p-1 mb-6 gap-1">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-1 rounded-lg py-2 text-xs font-medium transition-all ${
                tab === t.key ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Mobile Number</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input type="tel" value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="10-digit mobile number"
                className="w-full rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                maxLength={10} inputMode="numeric" required />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input type={showPwd ? 'text' : 'password'} value={password}
                onChange={(e) => setPassword(e.target.value)} placeholder="Your password"
                className="w-full rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required />
              <button type="button" onClick={() => setShowPwd(!showPwd)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button type="submit" className="w-full" size="lg" loading={submitting}>
            Sign In
          </Button>
          <div className="text-center">
            <Link
              href={`/forgot-password?role=${tab === 'owner' ? 'owner' : 'student'}`}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
              Forgot Password?
            </Link>
          </div>
        </form>

        {tab !== 'admin' && (
          <p className="mt-6 text-center text-sm text-slate-400">
            {tab === 'student' ? (
              <>New here?{' '}
                <Link href="/register" className="text-indigo-400 hover:text-indigo-300 font-medium">
                  Create student account
                </Link>
              </>
            ) : (
              <>Want to list your library?{' '}
                <Link href="/register/owner" className="text-indigo-400 hover:text-indigo-300 font-medium">
                  Register your library
                </Link>
              </>
            )}
          </p>
        )}
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
      <Suspense fallback={<div className="text-slate-400 text-sm">Loading...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  )
}
