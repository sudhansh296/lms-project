'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageLoading } from '@/components/ui/loading'
import {
  Building2, User, Eye, EyeOff, Share2, Banknote,
  CheckCircle, Clock, AlertTriangle, RefreshCw, ChevronDown, ChevronUp,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/contexts/auth-context'
import { LEVEL_LABELS, LEVEL_COLORS } from '@/lib/referral'
import type { OwnerMembershipLevel } from '@/lib/referral'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Library { name: string; status: string; city: string }

interface ReferralSummary {
  ownerMembershipLevel: OwnerMembershipLevel
  qualifiedCount: number
  referralUrl: string | null
  referralCode: string | null
}

interface SettlementStatus {
  hasAccount: boolean
  hasStakeholder: boolean
  hasProduct: boolean
  hasBankDetails: boolean
  step: string
  status: string           // NOT_STARTED | IN_PROGRESS | UNDER_REVIEW | ACTION_REQUIRED | ACTIVE | SUSPENDED
  settlementReady: boolean
  bankLast4: string | null
  activatedAt: string | null
  requirements: Array<{ field_reference: string; description: string; resolution: string }>
}

// ─── Status badge helper ──────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { label: string; cls: string; Icon: typeof CheckCircle }> = {
    ACTIVE:          { label: 'Active',          cls: 'bg-emerald-100 text-emerald-700', Icon: CheckCircle },
    UNDER_REVIEW:    { label: 'Under Review',    cls: 'bg-blue-100 text-blue-700',      Icon: Clock },
    ACTION_REQUIRED: { label: 'Action Required', cls: 'bg-amber-100 text-amber-700',    Icon: AlertTriangle },
    IN_PROGRESS:     { label: 'In Progress',     cls: 'bg-indigo-100 text-indigo-700',  Icon: Clock },
    SUSPENDED:       { label: 'Suspended',       cls: 'bg-red-100 text-red-700',        Icon: AlertTriangle },
    NOT_STARTED:     { label: 'Not Started',     cls: 'bg-slate-100 text-slate-600',    Icon: Clock },
  }
  const c = cfg[status] ?? cfg.NOT_STARTED
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${c.cls}`}>
      <c.Icon className="h-3 w-3" />
      {c.label}
    </span>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OwnerSettingsPage() {
  const { user } = useAuth()
  const [library, setLibrary] = useState<Library | null>(null)
  const [referral, setReferral] = useState<ReferralSummary | null>(null)
  const [settlement, setSettlement] = useState<SettlementStatus | null>(null)
  const [loading, setLoading] = useState(true)

  // Password form
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
  const [showPw, setShowPw] = useState(false)
  const [savingPw, setSavingPw] = useState(false)

  // Onboarding form (step 1)
  const [showOnboardForm, setShowOnboardForm] = useState(false)
  const [onboarding, setOnboarding] = useState(false)
  const [onboardForm, setOnboardForm] = useState({
    contactName: '', mobile: '', email: '',
    legalBusinessName: '', businessType: 'individual',
    category: 'education', subcategory: 'coaching',
    street1: '', street2: '', city: '', state: '', postalCode: '', country: 'IN',
    pan: '', gst: '',
  })

  // Bank form (step 2)
  const [showBankForm, setShowBankForm] = useState(false)
  const [submittingBank, setSubmittingBank] = useState(false)
  const [bankForm, setBankForm] = useState({
    beneficiaryName: '', accountNumber: '', confirmAccountNumber: '', ifscCode: '',
  })

  // Sync
  const [syncing, setSyncing] = useState(false)

  const inp = 'w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500'

  // ── Load data ──────────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      fetch('/api/owner/library').then(r => r.json()),
      fetch('/api/owner/referral').then(r => r.json()),
      fetch('/api/owner/settlement/status').then(r => r.json()),
    ]).then(([libData, refData, settleData]) => {
      setLibrary(libData.library)
      setReferral(refData)
      setSettlement(settleData)
      // Pre-fill contact fields from user profile
    }).finally(() => setLoading(false))
  }, [])

  // ── Sync settlement status ─────────────────────────────────────────────────
  const syncSettlement = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/owner/settlement/sync', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Sync failed'); return }
      // Refresh status
      const statusRes = await fetch('/api/owner/settlement/status')
      setSettlement(await statusRes.json())
      toast.success('Status refreshed')
    } finally {
      setSyncing(false)
    }
  }

  // ── Submit onboarding ──────────────────────────────────────────────────────
  const submitOnboard = async () => {
    setOnboarding(true)
    try {
      const res = await fetch('/api/owner/settlement/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(onboardForm),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Onboarding failed'); return }
      toast.success('Business details submitted. Now add your bank account.')
      setShowOnboardForm(false)
      setShowBankForm(true)
      const statusRes = await fetch('/api/owner/settlement/status')
      setSettlement(await statusRes.json())
    } finally {
      setOnboarding(false)
    }
  }

  // ── Submit bank details ────────────────────────────────────────────────────
  const submitBank = async () => {
    if (bankForm.accountNumber !== bankForm.confirmAccountNumber) {
      toast.error('Account numbers do not match'); return
    }
    setSubmittingBank(true)
    try {
      const res = await fetch('/api/owner/settlement/bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bankForm),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed to submit bank details'); return }
      toast.success(data.message ?? 'Bank details submitted')
      setShowBankForm(false)
      const statusRes = await fetch('/api/owner/settlement/status')
      setSettlement(await statusRes.json())
    } finally {
      setSubmittingBank(false)
    }
  }

  // ── Change password ────────────────────────────────────────────────────────
  const changePassword = async () => {
    if (!pwForm.current) { toast.error('Current password required'); return }
    if (pwForm.next !== pwForm.confirm) { toast.error('Passwords do not match'); return }
    if (pwForm.next.length < 8) { toast.error('Minimum 8 characters'); return }
    
    setSavingPw(true)
    try {
      // P1-6 FIX: Call real password change endpoint
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: pwForm.current,
          newPassword: pwForm.next,
          confirmPassword: pwForm.confirm,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to update password')
        return
      }
      toast.success('Password updated successfully')
      setPwForm({ current: '', next: '', confirm: '' })
    } catch (error) {
      toast.error('Failed to update password')
    } finally {
      setSavingPw(false)
    }
  }

  if (loading) return <PageLoading />

  const s = settlement

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 text-sm">Manage your account, settlement, and payment settings</p>
      </div>

      {/* ── Account ─────────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><User className="h-4 w-4" /> Account</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          {[
            { label: 'Name',   value: user?.name },
            { label: 'Mobile', value: user?.mobile },
            { label: 'Email',  value: user?.email ?? '—' },
            { label: 'Role',   value: 'Library Owner' },
          ].map(r => (
            <div key={r.label} className="flex gap-3 py-2 border-b border-slate-50 last:border-0">
              <span className="w-28 text-slate-500 shrink-0">{r.label}</span>
              <span className="font-medium text-slate-900">{r.value}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ── Library Status ───────────────────────────────────────────────────── */}
      {library && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="h-4 w-4" /> Library</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {[
              { label: 'Name', value: library.name },
              { label: 'City', value: library.city },
              { label: 'Status', value: (
                <Badge variant={library.status === 'ACTIVE' ? 'active' : library.status === 'PENDING_VERIFICATION' ? 'pending' : 'suspended'}>
                  {library.status.replace(/_/g, ' ')}
                </Badge>
              )},
            ].map(r => (
              <div key={r.label} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
                <span className="w-28 text-slate-500 shrink-0">{r.label}</span>
                <span className="font-medium text-slate-900">{r.value}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── Referral Membership ───────────────────────────────────────────────── */}
      {referral && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Share2 className="h-4 w-4" /> Referral Membership</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
              <div>
                <p className="text-xs text-slate-500 mb-1">Current Level</p>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${LEVEL_COLORS[referral.ownerMembershipLevel]}`}>
                  {LEVEL_LABELS[referral.ownerMembershipLevel]}
                </span>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500 mb-1">Qualified Libraries</p>
                <p className="text-xl font-bold text-slate-900 tabular-nums">{referral.qualifiedCount}</p>
              </div>
            </div>
            {referral.referralCode && (
              <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2">
                <p className="text-xs text-indigo-600 flex-1">
                  Code: <span className="font-mono font-bold tracking-wide">{referral.referralCode}</span>
                </p>
                <button onClick={() => {
                  navigator.clipboard.writeText(referral.referralUrl ?? '').then(() => toast.success('Copied!')).catch(() => {})
                }} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                  Copy Link
                </button>
              </div>
            )}
            <Link href="/owner/subscription">
              <Button variant="outline" size="sm" className="w-full gap-2">
                <Share2 className="h-3.5 w-3.5" /> View Full Referral Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* ── Settlement Setup ──────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2"><Banknote className="h-4 w-4" /> Payment Settlement Setup</CardTitle>
            {s?.hasProduct && (
              <Button variant="ghost" size="sm" loading={syncing} onClick={syncSettlement} className="gap-1.5 text-xs">
                <RefreshCw className="h-3.5 w-3.5" /> Sync Status
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-slate-500 text-xs leading-relaxed">
            Complete this setup so student booking payments are automatically transferred to your bank account.
            Your bank and KYC details are verified by Razorpay — they are never stored on our servers.
          </p>

          {/* Current status */}
          {s && (
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-slate-800">Settlement Status</p>
                <StatusBadge status={s.status} />
              </div>

              {/* Progress steps */}
              <div className="space-y-2 pt-1">
                {[
                  { label: 'Business details submitted', done: s.hasAccount },
                  { label: 'Identity / KYC submitted',  done: s.hasStakeholder },
                  { label: 'Route product requested',   done: s.hasProduct },
                  { label: 'Bank account linked',       done: s.hasBankDetails },
                  { label: 'Verification complete',     done: s.settlementReady },
                ].map(step => (
                  <div key={step.label} className="flex items-center gap-2 text-xs">
                    <div className={`h-4 w-4 rounded-full flex items-center justify-center shrink-0 ${
                      step.done ? 'bg-emerald-500' : 'bg-slate-200'
                    }`}>
                      {step.done && <CheckCircle className="h-3 w-3 text-white" />}
                    </div>
                    <span className={step.done ? 'text-slate-700 font-medium' : 'text-slate-400'}>{step.label}</span>
                  </div>
                ))}
              </div>

              {/* Masked bank account */}
              {s.bankLast4 && (
                <p className="text-xs text-slate-500 pt-1">
                  Bank account: <span className="font-mono font-semibold text-slate-700">•••• •••• {s.bankLast4}</span>
                </p>
              )}

              {/* Requirements / action needed */}
              {s.requirements.length > 0 && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 space-y-2">
                  <p className="text-xs font-semibold text-amber-800">Action Required</p>
                  {s.requirements.map((r, i) => (
                    <div key={i} className="text-xs text-amber-700">
                      <span className="font-medium">{r.field_reference}: </span>
                      {r.description} — {r.resolution}
                    </div>
                  ))}
                </div>
              )}

              {/* Active confirmation */}
              {s.settlementReady && (
                <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2">
                  <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                  <p className="text-xs font-medium text-emerald-800">
                    Settlement active — student payments are automatically transferred to your account.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── Step 1: Business / onboarding form ─────────────────────────── */}
          {!s?.hasAccount && (
            <div>
              <button
                onClick={() => setShowOnboardForm(v => !v)}
                className="flex items-center justify-between w-full rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-semibold text-violet-700 hover:bg-violet-100"
              >
                <span>Step 1 — Enter Business Details</span>
                {showOnboardForm ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>

              {showOnboardForm && (
                <div className="mt-3 space-y-3 rounded-xl border border-slate-200 p-4">
                  {/* Contact */}
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Contact</p>
                  {[
                    { key: 'contactName', label: 'Full Name' },
                    { key: 'mobile', label: 'Mobile Number' },
                    { key: 'email', label: 'Email Address' },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="block text-xs font-medium text-slate-600 mb-1">{f.label}</label>
                      <input className={inp} value={(onboardForm as Record<string,string>)[f.key]}
                        onChange={e => setOnboardForm(p => ({ ...p, [f.key]: e.target.value }))} />
                    </div>
                  ))}

                  {/* Business */}
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide pt-1">Business</p>
                  {[
                    { key: 'legalBusinessName', label: 'Legal Business / Library Name' },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="block text-xs font-medium text-slate-600 mb-1">{f.label}</label>
                      <input className={inp} value={(onboardForm as Record<string,string>)[f.key]}
                        onChange={e => setOnboardForm(p => ({ ...p, [f.key]: e.target.value }))} />
                    </div>
                  ))}
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Business Type</label>
                    <select className={inp} value={onboardForm.businessType}
                      onChange={e => setOnboardForm(p => ({ ...p, businessType: e.target.value }))}>
                      {['individual','proprietorship','partnership','private_limited','public_limited','llp','ngo','trust','society'].map(t => (
                        <option key={t} value={t}>{t.replace(/_/g,' ')}</option>
                      ))}
                    </select>
                  </div>

                  {/* Address */}
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide pt-1">Registered Address</p>
                  {[
                    { key: 'street1', label: 'Address Line 1' },
                    { key: 'street2', label: 'Address Line 2 (optional)' },
                    { key: 'city', label: 'City' },
                    { key: 'state', label: 'State' },
                    { key: 'postalCode', label: 'PIN Code' },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="block text-xs font-medium text-slate-600 mb-1">{f.label}</label>
                      <input className={inp} value={(onboardForm as Record<string,string>)[f.key]}
                        onChange={e => setOnboardForm(p => ({ ...p, [f.key]: e.target.value }))} />
                    </div>
                  ))}

                  {/* KYC */}
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide pt-1">KYC</p>
                  {[
                    { key: 'pan', label: 'PAN Number' },
                    { key: 'gst', label: 'GSTIN (optional)' },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="block text-xs font-medium text-slate-600 mb-1">{f.label}</label>
                      <input className={inp} value={(onboardForm as Record<string,string>)[f.key]}
                        onChange={e => setOnboardForm(p => ({ ...p, [f.key]: e.target.value.toUpperCase() }))} />
                    </div>
                  ))}

                  <Button className="w-full mt-2" loading={onboarding} onClick={submitOnboard}>
                    Submit Business Details →
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* ── Step 2: Bank details ────────────────────────────────────────── */}
          {s?.hasAccount && !s.hasBankDetails && (
            <div>
              <button
                onClick={() => setShowBankForm(v => !v)}
                className="flex items-center justify-between w-full rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-semibold text-violet-700 hover:bg-violet-100"
              >
                <span>Step 2 — Add Bank Account</span>
                {showBankForm ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>

              {showBankForm && (
                <div className="mt-3 space-y-3 rounded-xl border border-slate-200 p-4">
                  {[
                    { key: 'beneficiaryName',       label: 'Account Holder Name',          type: 'text' },
                    { key: 'accountNumber',          label: 'Bank Account Number',           type: 'password' },
                    { key: 'confirmAccountNumber',   label: 'Confirm Account Number',        type: 'text' },
                    { key: 'ifscCode',               label: 'IFSC Code',                     type: 'text' },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="block text-xs font-medium text-slate-600 mb-1">{f.label}</label>
                      <input type={f.type} className={inp}
                        value={(bankForm as Record<string,string>)[f.key]}
                        onChange={e => setBankForm(p => ({ ...p, [f.key]: e.target.value }))} />
                    </div>
                  ))}
                  <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 text-xs text-slate-500">
                    Your bank details are sent directly to Razorpay for KYC verification. We only store the last 4 digits.
                  </div>
                  <Button className="w-full" loading={submittingBank} onClick={submitBank}>
                    Submit Bank Details →
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Re-submit bank if action required */}
          {s?.hasBankDetails && !s.settlementReady && s.status !== 'UNDER_REVIEW' && (
            <Button variant="outline" size="sm" className="w-full"
              onClick={() => setShowBankForm(v => !v)}>
              Update Bank Details
            </Button>
          )}
        </CardContent>
      </Card>

      {/* ── Change Password ───────────────────────────────────────────────────── */}
      <Card>
        <CardHeader><CardTitle>Change Password</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {[
            { key: 'current', label: 'Current Password' },
            { key: 'next',    label: 'New Password' },
            { key: 'confirm', label: 'Confirm New Password' },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">{f.label}</label>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'}
                  value={(pwForm as Record<string,string>)[f.key]}
                  onChange={e => setPwForm(p => ({ ...p, [f.key]: e.target.value }))}
                  className={inp} placeholder={f.label} />
                {f.key === 'next' && (
                  <button type="button" onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                )}
              </div>
            </div>
          ))}
          <Button loading={savingPw} onClick={changePassword} className="mt-2">
            Update Password
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
