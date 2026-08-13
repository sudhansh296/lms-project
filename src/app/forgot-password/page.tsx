'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { BookOpen, ShieldCheck, Eye, EyeOff, Check } from 'lucide-react'
import toast from 'react-hot-toast'

type Stage = 'mobile' | 'otp' | 'newpassword' | 'done'
type UserType = 'STUDENT' | 'LIBRARY_OWNER'

function ForgotPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [stage, setStage] = useState<Stage>('mobile')
  const [userType, setUserType] = useState<UserType>(
    searchParams.get('role') === 'owner' ? 'LIBRARY_OWNER' : 'STUDENT'
  )
  const [mobile, setMobile] = useState('')
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  const inputCls = "w-full rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"

  // ── Step 1: Send OTP ───────────────────────────────────────────────────────
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!/^[6-9]\d{9}$/.test(mobile)) { toast.error('Enter a valid 10-digit mobile number'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile, purpose: 'FORGOT_PASSWORD', userType }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 429) setCooldown(data.cooldownSeconds ?? 60)
        toast.error(data.error ?? 'Failed to send OTP')
        return
      }
      toast.success(data.message ?? 'OTP sent!')
      setStage('otp')
    } finally {
      setLoading(false)
    }
  }

  // ── Step 2: Verify OTP ─────────────────────────────────────────────────────
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (otp.length !== 6) { toast.error('Enter the 6-digit OTP'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile, otp, purpose: 'FORGOT_PASSWORD', userType }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Invalid OTP'); return }
      setStage('newpassword')
    } finally {
      setLoading(false)
    }
  }

  // ── Step 3: Reset Password ─────────────────────────────────────────────────
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) { toast.error('Passwords do not match'); return }
    if (newPassword.length < 6) { toast.error('Password must be at least 6 characters'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile, otp, newPassword, userType }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed to reset password'); return }
      toast.success('Password updated successfully!')
      setStage('done')
    } finally {
      setLoading(false)
    }
  }

  const handleResendOtp = async () => {
    if (cooldown > 0) return
    setLoading(true)
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile, purpose: 'FORGOT_PASSWORD', userType }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 429) setCooldown(data.cooldownSeconds ?? 60)
        toast.error(data.error ?? 'Failed')
        return
      }
      toast.success('OTP resent!')
      setOtp('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <Link href="/login" className="inline-flex items-center gap-2.5 mb-4">
          <div className="rounded-xl bg-indigo-600 p-2.5"><BookOpen className="h-5 w-5 text-white" /></div>
          <span className="text-2xl font-bold text-white">StudyLib</span>
        </Link>
        <h1 className="text-2xl font-bold text-white">Forgot Password</h1>
        <p className="text-slate-400 text-sm mt-1">Reset your password via OTP</p>
      </div>

      <div className="rounded-2xl bg-white/5 border border-white/10 p-8">
        {/* User type selector */}
        {stage === 'mobile' && (
          <div className="flex rounded-xl bg-white/5 p-1 mb-6 gap-1">
            {(['STUDENT', 'LIBRARY_OWNER'] as UserType[]).map(t => (
              <button key={t} type="button" onClick={() => setUserType(t)}
                className={`flex-1 rounded-lg py-2 text-xs font-medium transition-all ${
                  userType === t ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}>
                {t === 'STUDENT' ? 'Student' : 'Library Owner'}
              </button>
            ))}
          </div>
        )}

        {/* Stage: mobile */}
        {stage === 'mobile' && (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Registered Mobile Number</label>
              <input type="tel" inputMode="numeric" maxLength={10}
                value={mobile} onChange={e => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="10-digit mobile number" required className={inputCls} />
            </div>
            <Button type="submit" className="w-full" size="lg" loading={loading}>
              Send OTP
            </Button>
            <p className="text-center text-sm text-slate-400 pt-1">
              <Link href="/login" className="text-indigo-400 hover:text-indigo-300">← Back to Login</Link>
            </p>
          </form>
        )}

        {/* Stage: otp */}
        {stage === 'otp' && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="text-center mb-2">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-indigo-600/20 mb-3">
                <ShieldCheck className="h-6 w-6 text-indigo-400" />
              </div>
              <p className="text-slate-300 text-sm">
                OTP sent to <span className="text-white font-medium">{mobile.slice(0,2)}XXXXXX{mobile.slice(-2)}</span>
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Enter OTP</label>
              <input type="tel" inputMode="numeric" maxLength={6}
                value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g,'').slice(0,6))}
                placeholder="6-digit OTP" required
                className={`${inputCls} text-center text-xl tracking-[0.5em] font-bold`} />
            </div>
            <Button type="submit" className="w-full" size="lg" loading={loading}>Verify OTP</Button>
            <div className="flex items-center justify-between text-sm">
              <button type="button" onClick={() => setStage('mobile')}
                className="text-slate-400 hover:text-white">← Change Number</button>
              <button type="button" onClick={handleResendOtp} disabled={loading || cooldown > 0}
                className="text-indigo-400 hover:text-indigo-300 disabled:opacity-50">
                {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend OTP'}
              </button>
            </div>
          </form>
        )}

        {/* Stage: new password */}
        {stage === 'newpassword' && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <p className="text-center text-emerald-400 text-sm font-medium mb-2">✓ OTP Verified — Set New Password</p>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">New Password</label>
              <div className="relative">
                <input type={showPwd ? 'text' : 'password'} value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Min 6 characters" required className={`${inputCls} pr-10`} />
                <button type="button" onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Confirm New Password</label>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password" required className={inputCls} />
            </div>
            <Button type="submit" className="w-full" size="lg" loading={loading}>Reset Password</Button>
          </form>
        )}

        {/* Stage: done */}
        {stage === 'done' && (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <div className="rounded-full bg-emerald-600/20 p-5">
              <Check className="h-10 w-10 text-emerald-400" />
            </div>
            <p className="text-xl font-bold text-white">Password Reset!</p>
            <p className="text-slate-400 text-sm">Your password has been updated. You can now log in.</p>
            <Button onClick={() => router.push('/login')} className="w-full mt-2" size="lg">
              Go to Login
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
      <Suspense fallback={<div className="text-slate-400 text-sm">Loading...</div>}>
        <ForgotPasswordForm />
      </Suspense>
    </div>
  )
}
