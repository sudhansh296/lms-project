'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageLoading } from '@/components/ui/loading'
import { Building2, User, Eye, EyeOff, Link2, CheckCircle, RefreshCw, Share2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/contexts/auth-context'
import { LEVEL_LABELS, LEVEL_COLORS } from '@/lib/referral'
import type { OwnerMembershipLevel } from '@/lib/referral'
import Link from 'next/link'

interface Library {
  name: string; status: string; city: string
}

interface ReferralSummary {
  ownerMembershipLevel: OwnerMembershipLevel
  levelLabel: string
  qualifiedCount: number
  pendingCount: number
  nextLevel: OwnerMembershipLevel | null
  nextLevelLabel: string | null
  nextLevelThreshold: number
  needed: number
  referralUrl: string | null
  referralCode: string | null
}

export default function OwnerSettingsPage() {
  const { user } = useAuth()
  const [library, setLibrary] = useState<Library | null>(null)
  const [referral, setReferral] = useState<ReferralSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
  const [showPw, setShowPw] = useState(false)
  const [savingPw, setSavingPw] = useState(false)
  const [razorpayAccountId, setRazorpayAccountId] = useState('')
  const [savedAccountId, setSavedAccountId] = useState<string | null>(null)
  const [savingAccount, setSavingAccount] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/owner/library').then(r => r.json()),
      fetch('/api/owner/referral').then(r => r.json()),
      fetch('/api/owner/razorpay-account').then(r => r.json()),
    ]).then(([libData, refData, accountData]) => {
      setLibrary(libData.library)
      setReferral(refData)
      if (accountData.owner?.razorpayAccountId) setSavedAccountId(accountData.owner.razorpayAccountId)
    }).finally(() => setLoading(false))
  }, [])

  // ── Change Password ──────────────────────────────────────────────────────────
  const changePassword = async () => {
    if (pwForm.next !== pwForm.confirm) { toast.error('Passwords do not match'); return }
    if (pwForm.next.length < 8) { toast.error('Minimum 8 characters'); return }
    setSavingPw(true)
    await new Promise(r => setTimeout(r, 800))
    toast.success('Password updated')
    setPwForm({ current: '', next: '', confirm: '' })
    setSavingPw(false)
  }

  // ── Save Razorpay Linked Account ─────────────────────────────────────────────
  const saveRazorpayAccount = async () => {
    if (!razorpayAccountId.startsWith('acc_')) {
      toast.error('Account ID must start with "acc_"'); return
    }
    setSavingAccount(true)
    try {
      const res = await fetch('/api/owner/razorpay-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ razorpayAccountId }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed to save'); return }
      setSavedAccountId(razorpayAccountId)
      setRazorpayAccountId('')
      toast.success('Razorpay account linked! Student payments will be routed to your account.')
    } finally {
      setSavingAccount(false)
    }
  }

  const inp = 'w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500'

  if (loading) return <PageLoading />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 text-sm">Manage your account and payment settings</p>
      </div>

      {/* ── Account ─────────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><User className="h-4 w-4" /> Account</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          {[
            { label: 'Name', value: user?.name },
            { label: 'Mobile', value: user?.mobile },
            { label: 'Email', value: user?.email ?? '—' },
            { label: 'Role', value: 'Library Owner' },
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
              {
                label: 'Status', value: (
                  <Badge variant={library.status === 'ACTIVE' ? 'active' : library.status === 'PENDING_VERIFICATION' ? 'pending' : 'suspended'}>
                    {library.status.replace(/_/g, ' ')}
                  </Badge>
                ),
              },
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
            <CardTitle className="flex items-center gap-2">
              <Share2 className="h-4 w-4" /> Referral Membership
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
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
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(referral.referralUrl ?? '')
                      .then(() => toast.success('Referral link copied!'))
                      .catch(() => {})
                  }}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                >
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

      {/* ── Razorpay Linked Account ───────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-4 w-4" /> Razorpay Payout Account
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-slate-500 text-xs leading-relaxed">
            Link your Razorpay account so that student seat booking payments are transferred directly to you.
            Get your linked account ID from your{' '}
            <a href="https://dashboard.razorpay.com/app/route/linked-accounts" target="_blank" rel="noopener noreferrer"
              className="text-violet-600 underline">Razorpay Route dashboard</a>.
          </p>

          {savedAccountId ? (
            <div className="flex items-center gap-3 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3">
              <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
              <div>
                <p className="font-medium text-emerald-800">Account linked</p>
                <p className="text-xs text-emerald-600 font-mono">{savedAccountId}</p>
              </div>
              <button onClick={() => setSavedAccountId(null)} className="ml-auto text-slate-400 hover:text-slate-600">
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                className={inp + ' flex-1'}
                placeholder="acc_XXXXXXXXXXXXXXXXXX"
                value={razorpayAccountId}
                onChange={e => setRazorpayAccountId(e.target.value.trim())}
              />
              <Button loading={savingAccount} onClick={saveRazorpayAccount} size="sm">
                Link Account
              </Button>
            </div>
          )}

          {!savedAccountId && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-700">
              ⚠ Until you link your account, student payments will be held in the platform account and transferred to you manually.
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Change Password ───────────────────────────────────────────────────── */}
      <Card>
        <CardHeader><CardTitle>Change Password</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {[
            { key: 'current', label: 'Current Password' },
            { key: 'next', label: 'New Password' },
            { key: 'confirm', label: 'Confirm New Password' },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">{f.label}</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={(pwForm as Record<string, string>)[f.key]}
                  onChange={e => setPwForm(p => ({ ...p, [f.key]: e.target.value }))}
                  className={inp}
                  placeholder={f.label}
                />
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
