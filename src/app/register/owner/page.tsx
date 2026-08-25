'use client'
'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { BookOpen, ChevronRight, ChevronLeft, Check, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/contexts/auth-context'

const STEPS = [
  'Owner Details',
  'Library Info',
  'Location',
  'Facilities',
  'Timings',
  'Rules',
  'Verify Mobile',
  'Review & Submit',
]

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const FACILITIES_LIST = [
  { id: 'WIFI', label: 'Wi-Fi' },
  { id: 'AC', label: 'AC' },
  { id: 'POWER_BACKUP', label: 'Power Backup' },
  { id: 'CHARGING_POINTS', label: 'Charging Points' },
  { id: 'DRINKING_WATER', label: 'Drinking Water' },
  { id: 'PARKING', label: 'Parking' },
  { id: 'WASHROOM', label: 'Washroom' },
  { id: 'CCTV', label: 'CCTV' },
  { id: 'LOCKER', label: 'Locker' },
  { id: 'NEWSPAPER', label: 'Newspaper' },
  { id: 'SEPARATE_CABINS', label: 'Separate Cabins' },
  { id: 'WINDOW_SEATS', label: 'Window Seats' },
  { id: 'PREMIUM_SEATS', label: 'Premium Seats' },
]

function OwnerRegisterPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { refresh } = useAuth()
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [otp, setOtp] = useState('')
  const [otpVerified, setOtpVerified] = useState(false)
  const [sendingOtp, setSendingOtp] = useState(false)
  const [verifyingOtp, setVerifyingOtp] = useState(false)
  const [otpCooldown, setOtpCooldown] = useState(0)
  // Capture referral code from URL query param ?ref=STUDYLIB-XXXXX
  const referralCodeFromUrl = searchParams.get('ref') ?? ''

  const [form, setForm] = useState({
    // Owner
    name: '', mobile: '', email: '', password: '', confirmPassword: '',
    // Library
    libraryName: '', description: '', libraryPhone: '', libraryEmail: '',
    // Location
    addressLine1: '', addressLine2: '', area: '', landmark: '',
    city: '', state: '', pincode: '', country: 'India',
    latitude: '', longitude: '',
    // Facilities
    facilities: [] as string[],
    customFacility: '',
    // Hours
    hours: DAYS.map((_, i) => ({
      dayOfWeek: i,
      isOpen: i !== 0, // Sunday closed by default
      openTime: '08:00',
      closeTime: '22:00',
    })),
    // Rules
    rules: [
      'Maintain silence at all times',
      'No food or beverages inside',
      'Mobile phones on silent mode',
    ] as string[],
    newRule: '',
  })

  const set = (field: string, value: unknown) =>
    setForm((p) => ({ ...p, [field]: value }))

  // Helper to safely read string fields from the form
  const str = (field: string): string => {
    const v = (form as unknown as Record<string, unknown>)[field]
    return typeof v === 'string' ? v : ''
  }

  const toggleFacility = (id: string) => {
    set('facilities',
      form.facilities.includes(id)
        ? form.facilities.filter((f) => f !== id)
        : [...form.facilities, id]
    )
  }

  const addRule = () => {
    if (!form.newRule.trim()) return
    set('rules', [...form.rules, form.newRule.trim()])
    set('newRule', '')
  }

  const removeRule = (i: number) => set('rules', form.rules.filter((_, idx) => idx !== i))

  const handleSubmit = async () => {
    if (form.password !== form.confirmPassword) { toast.error('Passwords do not match'); return }
    setSubmitting(true)
    try {
      const payload = {
        name: form.name,
        mobile: form.mobile,
        email: form.email || undefined,
        password: form.password,
        libraryName: form.libraryName,
        description: form.description,
        libraryPhone: form.libraryPhone,
        libraryEmail: form.libraryEmail || undefined,
        addressLine1: form.addressLine1,
        addressLine2: form.addressLine2 || undefined,
        area: form.area || undefined,
        landmark: form.landmark || undefined,
        city: form.city,
        state: form.state,
        pincode: form.pincode,
        country: form.country,
        latitude: form.latitude ? parseFloat(form.latitude) : undefined,
        longitude: form.longitude ? parseFloat(form.longitude) : undefined,
        // Pass along the referral code captured from the URL
        referralCode: referralCodeFromUrl || undefined,
      }

      const res = await fetch('/api/auth/register/owner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Registration failed'); return }

      toast.success('Library registered! Awaiting admin approval.')
      await refresh()
      router.push('/owner')
    } finally {
      setSubmitting(false)
    }
  }

  const inputCls = "w-full rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8 pt-8">
          <Link href="/" className="inline-flex items-center gap-2.5 mb-4">
            <div className="rounded-xl bg-indigo-600 p-2.5"><BookOpen className="h-5 w-5 text-white" /></div>
            <span className="text-2xl font-bold text-white">StudyLib</span>
          </Link>
          <h1 className="text-2xl font-bold text-white">Register Your Library</h1>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-1 mb-8">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center gap-1 flex-1">
              <div className={`rounded-full w-7 h-7 flex items-center justify-center text-xs font-medium transition-colors ${
                i < step ? 'bg-emerald-500 text-white' : i === step ? 'bg-indigo-600 text-white' : 'bg-white/10 text-slate-400'
              }`}>
                {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 ${i < step ? 'bg-emerald-500' : 'bg-white/10'}`} />}
            </div>
          ))}
        </div>

        <div className="rounded-2xl bg-white/5 border border-white/10 p-8">
          <h2 className="text-lg font-semibold text-white mb-6">{STEPS[step]}</h2>

          {/* Step 0: Owner */}
          {step === 0 && (
            <div className="space-y-4">
              {[['name','Full Name','text'],['mobile','Mobile Number','tel'],['email','Email (optional)','email']].map(([n,l,t]) => (
                <div key={n}>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">{l}</label>
                  <input name={n} type={t} value={str(n!)} onChange={e => set(n!, n==='mobile'?e.target.value.replace(/\D/g,'').slice(0,10):e.target.value)} className={inputCls} placeholder={l} />
                </div>
              ))}
              {[['password','Password'],['confirmPassword','Confirm Password']].map(([n,l]) => (
                <div key={n}>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">{l}</label>
                  <input name={n} type="password" value={str(n!)} onChange={e => set(n!,e.target.value)} className={inputCls} placeholder="Min 8 characters" />
                </div>
              ))}
            </div>
          )}

          {/* Step 1: Library */}
          {step === 1 && (
            <div className="space-y-4">
              {[['libraryName','Library Name'],['description','Description (optional)'],['libraryPhone','Library Phone'],['libraryEmail','Library Email (optional)']].map(([n,l]) => (
                <div key={n}>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">{l}</label>
                  <input name={n} type="text" value={str(n!)} onChange={e => set(n!,e.target.value)} className={inputCls} placeholder={l} />
                </div>
              ))}
            </div>
          )}

          {/* Step 2: Location */}
          {step === 2 && (
            <div className="space-y-4">
              {[
                ['addressLine1','Address Line 1'],['addressLine2','Address Line 2 (optional)'],
                ['area','Area / Locality'],['landmark','Landmark (optional)'],
                ['city','City'],['state','State'],
                ['pincode','Pincode'],['latitude','Latitude (optional)'],['longitude','Longitude (optional)'],
              ].map(([n,l]) => (
                <div key={n}>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">{l}</label>
                  <input name={n} type="text" value={str(n!)} onChange={e => set(n!,e.target.value)} className={inputCls} placeholder={l} />
                </div>
              ))}
            </div>
          )}

          {/* Step 3: Facilities */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {FACILITIES_LIST.map((f) => (
                  <button key={f.id} type="button" onClick={() => toggleFacility(f.id)}
                    className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-all border ${
                      form.facilities.includes(f.id)
                        ? 'bg-indigo-600 border-indigo-500 text-white'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:border-indigo-500/50'
                    }`}>
                    {form.facilities.includes(f.id) && <Check className="h-3.5 w-3.5" />}
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={form.customFacility} onChange={e => set('customFacility', e.target.value)} className={inputCls} placeholder="Add custom facility" />
                <Button type="button" variant="secondary" onClick={() => {
                  if (!form.customFacility.trim()) return
                  set('facilities', [...form.facilities, form.customFacility.trim().toUpperCase().replace(/\s+/g,'_')])
                  set('customFacility','')
                }}>Add</Button>
              </div>
            </div>
          )}

          {/* Step 4: Timings */}
          {step === 4 && (
            <div className="space-y-3">
              {form.hours.map((h, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl bg-white/5 border border-white/10 p-3">
                  <span className="w-24 text-sm text-slate-300">{DAYS[i]}</span>
                  <button type="button" onClick={() => {
                    const hrs = [...form.hours]; hrs[i] = { ...hrs[i], isOpen: !hrs[i].isOpen }; set('hours', hrs)
                  }} className={`rounded-lg px-3 py-1.5 text-xs font-medium ${h.isOpen ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-400'}`}>
                    {h.isOpen ? 'Open' : 'Closed'}
                  </button>
                  {h.isOpen && (
                    <>
                      <input type="time" value={h.openTime} onChange={e => {
                        const hrs = [...form.hours]; hrs[i] = { ...hrs[i], openTime: e.target.value }; set('hours', hrs)
                      }} className="rounded-lg bg-white/5 border border-white/10 text-white px-2 py-1.5 text-sm" />
                      <span className="text-slate-500 text-xs">to</span>
                      <input type="time" value={h.closeTime} onChange={e => {
                        const hrs = [...form.hours]; hrs[i] = { ...hrs[i], closeTime: e.target.value }; set('hours', hrs)
                      }} className="rounded-lg bg-white/5 border border-white/10 text-white px-2 py-1.5 text-sm" />
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Step 5: Rules */}
          {step === 5 && (
            <div className="space-y-4">
              <div className="space-y-2">
                {form.rules.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-4 py-3">
                    <span className="flex-1 text-sm text-slate-300">{r}</span>
                    <button type="button" onClick={() => removeRule(i)} className="text-slate-500 hover:text-red-400 text-sm">✕</button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={form.newRule} onChange={e => set('newRule', e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addRule())}
                  className={inputCls} placeholder="Add a library rule..." />
                <Button type="button" variant="secondary" onClick={addRule}>Add</Button>
              </div>
            </div>
          )}

          {/* Step 6: Verify Mobile (OTP) */}
          {step === 6 && (
            <div className="space-y-5">
              {!otpVerified ? (
                <>
                  <div className="text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-indigo-600/20 mb-3">
                      <ShieldCheck className="h-6 w-6 text-indigo-400" />
                    </div>
                    <p className="text-slate-300 text-sm">Verify your mobile number before submitting</p>
                  </div>

                  {/* Send OTP button */}
                  <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                    <p className="text-sm text-slate-300 mb-3">Mobile: <span className="font-semibold text-white">{form.mobile}</span></p>
                    <Button
                      type="button"
                      variant="secondary"
                      className="w-full"
                      loading={sendingOtp}
                      disabled={otpCooldown > 0}
                      onClick={async () => {
                        if (!form.mobile || form.mobile.length !== 10) { toast.error('Enter a valid mobile number in Step 1'); return }
                        setSendingOtp(true)
                        try {
                          const res = await fetch('/api/auth/send-otp', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ mobile: form.mobile, purpose: 'REGISTRATION', userType: 'LIBRARY_OWNER' }),
                          })
                          const data = await res.json()
                          if (!res.ok) {
                            if (res.status === 429) setOtpCooldown(data.cooldownSeconds ?? 60)
                            toast.error(data.error ?? 'Failed to send OTP')
                            return
                          }
                          toast.success(data.message ?? 'OTP sent!')
                          setOtpCooldown(parseInt(process.env.NEXT_PUBLIC_OTP_COOLDOWN ?? '60'))
                        } finally {
                          setSendingOtp(false)
                        }
                      }}>
                      {otpCooldown > 0 ? `Resend in ${otpCooldown}s` : 'Send OTP'}
                    </Button>
                  </div>

                  {/* OTP Input */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Enter OTP</label>
                    <input
                      type="tel"
                      inputMode="numeric"
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="6-digit OTP"
                      className={`${inputCls} text-center text-xl tracking-[0.5em] font-bold`}
                    />
                  </div>

                  <Button
                    type="button"
                    loading={verifyingOtp}
                    className="w-full"
                    onClick={async () => {
                      if (otp.length !== 6) { toast.error('Enter the 6-digit OTP'); return }
                      setVerifyingOtp(true)
                      try {
                        const res = await fetch('/api/auth/verify-otp', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ mobile: form.mobile, otp, purpose: 'REGISTRATION', userType: 'LIBRARY_OWNER' }),
                        })
                        const data = await res.json()
                        if (!res.ok) { toast.error(data.error ?? 'Invalid OTP'); return }
                        toast.success('Mobile verified!')
                        setOtpVerified(true)
                      } finally {
                        setVerifyingOtp(false)
                      }
                    }}>
                    Verify OTP
                  </Button>
                </>
              ) : (
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="rounded-full bg-emerald-600/20 p-4">
                    <Check className="h-8 w-8 text-emerald-400" />
                  </div>
                  <p className="text-emerald-400 font-semibold">Mobile Verified!</p>
                  <p className="text-slate-400 text-sm">You can now review and submit your registration.</p>
                </div>
              )}
            </div>
          )}

          {/* Step 7: Review */}
          {step === 7 && (
            <div className="space-y-4 text-sm">
              {[
                { label: 'Owner', value: `${form.name} · ${form.mobile}` },
                { label: 'Library', value: form.libraryName },
                { label: 'Location', value: `${form.city}, ${form.state} ${form.pincode}` },
                { label: 'Facilities', value: form.facilities.length > 0 ? form.facilities.join(', ') : 'None selected' },
                { label: 'Hours', value: `${form.hours.filter(h=>h.isOpen).length} days open` },
                { label: 'Rules', value: `${form.rules.length} rules added` },
                ...(referralCodeFromUrl ? [{ label: 'Referred by', value: referralCodeFromUrl }] : []),
              ].map((row) => (
                <div key={row.label} className="flex items-start gap-3 rounded-xl bg-white/5 border border-white/10 px-4 py-3">
                  <span className="w-24 text-slate-400 shrink-0">{row.label}</span>
                  <span className="text-slate-200 font-medium">{row.value}</span>
                </div>
              ))}
              <div className="rounded-xl bg-amber-900/30 border border-amber-700/30 p-4 mt-2">
                <p className="text-amber-300 text-sm">Your library will be reviewed by our team and approved within 24-48 hours.</p>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-8 pt-4 border-t border-white/10">
            {step > 0 ? (
              <Button type="button" variant="ghost" onClick={() => setStep(s => s - 1)} className="text-slate-300">
                <ChevronLeft className="h-4 w-4" /> Back
              </Button>
            ) : (
              <Link href="/login"><Button variant="ghost" className="text-slate-300">Cancel</Button></Link>
            )}
            {step < STEPS.length - 1 ? (
              <Button
                onClick={() => {
                  if (step === 6 && !otpVerified) { toast.error('Please verify your mobile number first'); return }
                  setStep(s => s + 1)
                }}>
                Continue <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} loading={submitting} className="bg-emerald-600 hover:bg-emerald-500">
                Submit for Approval
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function OwnerRegisterPage() {
  return (
    <Suspense>
      <OwnerRegisterPageInner />
    </Suspense>
  )
}
