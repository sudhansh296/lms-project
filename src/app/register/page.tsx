'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { BookOpen, Eye, EyeOff, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/contexts/auth-context'

type Stage = 'form' | 'otp'

export default function StudentRegisterPage() {
  const router = useRouter()
  const { refresh } = useAuth()

  // Stage: 'form' → fill details, 'otp' → verify OTP
  const [stage, setStage] = useState<Stage>('form')
  const [form, setForm] = useState({ name: '', mobile: '', email: '', password: '', confirmPassword: '' })
  const [otp, setOtp] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setForm((p) => ({ ...p, [name]: name === 'mobile' ? value.replace(/\D/g, '').slice(0, 10) : value }))
  }

  // ── Stage 1: Validate form & send OTP ──────────────────────────────────────
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // P08: Validate all required fields
    if (!form.name.trim()) { toast.error('Name is required'); return }
    if (form.name.trim().length < 2) { toast.error('Name must be at least 2 characters'); return }
    if (form.mobile.length !== 10) { toast.error('Enter a valid 10-digit mobile number'); return }
    
    // P09: Email is now REQUIRED
    if (!form.email.trim()) { toast.error('Email is required'); return }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(form.email)) { toast.error('Enter a valid email address'); return }
    
    // P10: Password minimum 8 characters (increased from 6)
    if (form.password.length < 8) { toast.error('Password must be at least 8 characters'); return }
    
    // P11: Confirm password validation
    if (form.password !== form.confirmPassword) { toast.error('Passwords do not match'); return }

    setSending(true)
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: form.mobile, purpose: 'REGISTRATION', userType: 'STUDENT' }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 429) {
          setCooldown(data.cooldownSeconds ?? 60)
          toast.error(data.error)
        } else {
          toast.error(data.error ?? 'Failed to send OTP')
        }
        return
      }
      toast.success(data.message ?? 'OTP sent to your mobile')
      setStage('otp')
    } finally {
      setSending(false)
    }
  }

  // ── Stage 2: Verify OTP & create account ───────────────────────────────────
  const handleVerifyAndRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (otp.length !== 6) { toast.error('Enter the 6-digit OTP'); return }

    setVerifying(true)
    try {
      // Step A: verify OTP
      const otpRes = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: form.mobile, otp, purpose: 'REGISTRATION', userType: 'STUDENT' }),
      })
      const otpData = await otpRes.json()
      if (!otpRes.ok) { toast.error(otpData.error ?? 'Invalid OTP'); return }

      // Step B: create account
      const regRes = await fetch('/api/auth/register/student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          mobile: form.mobile,
          email: form.email.trim().toLowerCase(),
          password: form.password,
          confirmPassword: form.confirmPassword,
          verificationToken: otpData.verificationToken, // ✅ Add OTP proof token
        }),
      })
      const regData = await regRes.json()
      if (!regRes.ok) { toast.error(regData.error ?? 'Registration failed'); return }

      toast.success('Account created! Welcome to StudyLib')
      await refresh()
      router.push('/student')
    } finally {
      setVerifying(false)
    }
  }

  // ── Resend OTP ──────────────────────────────────────────────────────────────
  const handleResendOtp = async () => {
    if (cooldown > 0) return
    setSending(true)
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: form.mobile, purpose: 'REGISTRATION', userType: 'STUDENT' }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 429) setCooldown(data.cooldownSeconds ?? 60)
        toast.error(data.error ?? 'Failed to resend OTP')
        return
      }
      toast.success('OTP resent!')
      setOtp('')
    } finally {
      setSending(false)
    }
  }

  const inputCls = "w-full rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2.5 mb-4">
            <div className="rounded-xl bg-indigo-600 p-2.5"><BookOpen className="h-5 w-5 text-white" /></div>
            <span className="text-2xl font-bold text-white">StudyLib</span>
          </Link>
          <h1 className="text-2xl font-bold text-white">Create Student Account</h1>
          <p className="text-slate-400 text-sm mt-1">Find and book study spaces near you</p>
        </div>

        <div className="rounded-2xl bg-white/5 border border-white/10 p-8">
          {stage === 'form' ? (
            /* ── Stage 1: Registration Form ── */
            <form onSubmit={handleSendOtp} className="space-y-4">
              {[
                { name: 'name', label: 'Full Name', type: 'text', placeholder: 'Your full name', required: true },
                { name: 'mobile', label: 'Mobile Number', type: 'tel', placeholder: '10-digit number', required: true },
                { name: 'email', label: 'Email', type: 'email', placeholder: 'your@email.com', required: true },
              ].map((field) => (
                <div key={field.name}>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">{field.label}</label>
                  <input
                    name={field.name}
                    type={field.type}
                    value={(form as Record<string, string>)[field.name]}
                    onChange={handleChange}
                    placeholder={field.placeholder}
                    required={field.required}
                    className={inputCls}
                  />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
                <div className="relative">
                  <input name="password" type={showPwd ? 'text' : 'password'} value={form.password}
                    onChange={handleChange} placeholder="Min 8 characters" required minLength={8} className={`${inputCls} pr-10`} />
                  <button type="button" onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Confirm Password</label>
                <input name="confirmPassword" type="password" value={form.confirmPassword}
                  onChange={handleChange} placeholder="Repeat password" required minLength={8} className={inputCls} />
              </div>
              <Button type="submit" className="w-full mt-2" size="lg" loading={sending}>
                Send OTP to Verify Mobile
              </Button>
            </form>
          ) : (
            /* ── Stage 2: OTP Verification ── */
            <form onSubmit={handleVerifyAndRegister} className="space-y-4">
              <div className="text-center mb-2">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-indigo-600/20 mb-3">
                  <ShieldCheck className="h-6 w-6 text-indigo-400" />
                </div>
                <p className="text-white font-semibold">Verify Your Mobile</p>
                <p className="text-slate-400 text-sm mt-1">
                  Enter the 6-digit OTP sent to{' '}
                  <span className="text-white font-medium">
                    {form.mobile.slice(0, 2)}XXXXXX{form.mobile.slice(-2)}
                  </span>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">OTP Code</label>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Enter 6-digit OTP"
                  required
                  className={`${inputCls} text-center text-xl tracking-[0.5em] font-bold`}
                />
              </div>

              <Button type="submit" className="w-full" size="lg" loading={verifying}>
                Verify & Create Account
              </Button>

              <div className="flex items-center justify-between text-sm pt-1">
                <button type="button" onClick={() => { setStage('form'); setOtp('') }}
                  className="text-slate-400 hover:text-white transition-colors">
                  ← Change Details
                </button>
                <button type="button" onClick={handleResendOtp}
                  disabled={sending || cooldown > 0}
                  className="text-indigo-400 hover:text-indigo-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  {cooldown > 0 ? `Resend in ${cooldown}s` : sending ? 'Sending...' : 'Resend OTP'}
                </button>
              </div>
            </form>
          )}

          <p className="mt-5 text-center text-sm text-slate-400">
            Already have an account?{' '}
            <Link href="/login" className="text-indigo-400 hover:text-indigo-300 font-medium">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
