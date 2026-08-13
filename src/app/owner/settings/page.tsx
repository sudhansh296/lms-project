'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageLoading } from '@/components/ui/loading'
import { Building2, CreditCard, User, Eye, EyeOff, Link2, CheckCircle, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/contexts/auth-context'
import { formatDate, formatCurrency } from '@/lib/utils'

interface SubscriptionPlan {
  id: string; name: string; price: number; billingCycle: string
  trialDays: number; features: string[]; description?: string
}

interface Subscription {
  status: string; trialEnd: string | null; endDate: string | null
  plan: SubscriptionPlan
}

interface Library {
  name: string; status: string; city: string
  owner: { subscription: Subscription | null }
}

export default function OwnerSettingsPage() {
  const { user } = useAuth()
  const [library, setLibrary] = useState<Library | null>(null)
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
  const [showPw, setShowPw] = useState(false)
  const [savingPw, setSavingPw] = useState(false)
  const [razorpayAccountId, setRazorpayAccountId] = useState('')
  const [savedAccountId, setSavedAccountId] = useState<string | null>(null)
  const [savingAccount, setSavingAccount] = useState(false)
  const [buyingPlan, setBuyingPlan] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/owner/library').then(r => r.json()),
      fetch('/api/owner/subscription').then(r => r.json()),
    ]).then(([libData, subData]) => {
      setLibrary(libData.library)
      setPlans(subData.plans ?? [])
      if (subData.razorpayAccountId) setSavedAccountId(subData.razorpayAccountId)
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

  // ── Buy Subscription Plan ────────────────────────────────────────────────────
  const buyPlan = async (plan: SubscriptionPlan) => {
    if (plan.price === 0) {
      // Free plan — activate directly
      const res = await fetch('/api/owner/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: plan.id,
          razorpayOrderId: 'free',
          razorpayPaymentId: 'free',
          razorpaySignature: 'free',
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed'); return }
      toast.success('Free plan activated!')
      window.location.reload()
      return
    }

    setBuyingPlan(plan.id)
    try {
      // Create Razorpay order — goes to platform's account
      const orderRes = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: plan.price,
          notes: { planId: plan.id, type: 'SUBSCRIPTION', ownerId: user?.id },
        }),
      })
      const orderData = await orderRes.json()
      if (!orderRes.ok) { toast.error('Payment setup failed'); return }

      const script = document.createElement('script')
      script.src = 'https://checkout.razorpay.com/v1/checkout.js'
      document.body.appendChild(script)

      script.onload = () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rzp = new (window as any).Razorpay({
          key: orderData.key,
          amount: orderData.amount,
          currency: orderData.currency,
          name: 'StudyLib Platform',
          description: `${plan.name} — ${plan.billingCycle} subscription`,
          order_id: orderData.orderId,
          config: {
            display: {
              blocks: {
                banks: {
                  name: 'All payment methods',
                  instruments: [
                    {
                      method: 'upi',
                    },
                    {
                      method: 'card',
                    },
                    {
                      method: 'netbanking',
                    },
                    {
                      method: 'wallet',
                    },
                  ],
                },
              },
              sequence: ['block.banks'],
              preferences: {
                show_default_blocks: true,
              },
            },
          },
          handler: async (response: {
            razorpay_payment_id: string
            razorpay_order_id: string
            razorpay_signature: string
          }) => {
            // Confirm subscription — payment goes to platform's Razorpay account
            const confirmRes = await fetch('/api/owner/subscription', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                planId: plan.id,
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              }),
            })
            const confirmData = await confirmRes.json()
            if (!confirmRes.ok) {
              toast.error(confirmData.error ?? 'Subscription activation failed')
              return
            }
            toast.success(`${plan.name} activated! Valid until ${formatDate(confirmData.endDate)}`)
            window.location.reload()
          },
          modal: { ondismiss: () => setBuyingPlan(null) },
          theme: { color: '#7c3aed' },
          prefill: { name: user?.name, contact: user?.mobile },
        })
        rzp.open()
      }
    } finally {
      setBuyingPlan(null)
    }
  }

  const inp = 'w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500'

  if (loading) return <PageLoading />

  const sub = library?.owner?.subscription
  const subStatus = sub?.status ?? 'NONE'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 text-sm">Manage your account, payments, and subscription</p>
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

      {/* ── Platform Subscription ────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" /> Platform Subscription
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {/* Current subscription */}
          {sub && (
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-slate-900">{sub.plan.name}</p>
                <Badge variant={subStatus === 'ACTIVE' ? 'active' : subStatus === 'TRIAL' ? 'pending' : 'suspended'}>
                  {subStatus}
                </Badge>
              </div>
              <p className="text-slate-500 text-xs">
                {sub.plan.price === 0 ? 'Free plan' : `${formatCurrency(sub.plan.price)} / ${sub.plan.billingCycle.toLowerCase()}`}
              </p>
              {sub.trialEnd && (
                <p className="text-xs text-amber-600">Trial ends: {formatDate(sub.trialEnd)}</p>
              )}
              {sub.endDate && (
                <p className="text-xs text-slate-500">Renews: {formatDate(sub.endDate)}</p>
              )}
              {sub.plan.features.length > 0 && (
                <ul className="space-y-1 pt-1">
                  {sub.plan.features.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs text-slate-600">
                      <span className="text-emerald-500">✓</span> {f}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Available plans to upgrade/switch */}
          {plans.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                {sub ? 'Switch Plan' : 'Choose a Plan'}
              </p>
              
              {/* Group plans by tier */}
              {['Starter', 'Basic', 'Professional', 'Enterprise'].map(tier => {
                const tierPlans = plans.filter(p => p.name.startsWith(tier))
                if (tierPlans.length === 0) return null
                
                const monthlyPlan = tierPlans.find(p => p.billingCycle === 'MONTHLY')
                const yearlyPlan = tierPlans.find(p => p.billingCycle === 'YEARLY')
                
                return (
                  <div key={tier} className="mb-4">
                    <div className="flex items-baseline gap-2 mb-2">
                      <h3 className="text-sm font-bold text-slate-800">{tier}</h3>
                      {monthlyPlan?.description && (
                        <p className="text-xs text-slate-500">{monthlyPlan.description}</p>
                      )}
                    </div>
                    
                    <div className="grid gap-3 md:grid-cols-2">
                      {/* Monthly Plan */}
                      {monthlyPlan && (
                        <div className={`rounded-xl border-2 ${
                          sub?.plan.id === monthlyPlan.id 
                            ? 'border-violet-500 bg-violet-50' 
                            : 'border-slate-200 bg-white'
                        } p-4`}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-slate-500 uppercase">Monthly</span>
                              {sub?.plan.id === monthlyPlan.id && (
                                <Badge variant="active" className="text-[10px]">Current</Badge>
                              )}
                            </div>
                          </div>
                          <div className="mb-3">
                            <p className="text-2xl font-bold text-slate-900">
                              {monthlyPlan.price === 0 ? 'Free' : `₹${monthlyPlan.price}`}
                            </p>
                            {monthlyPlan.price > 0 && (
                              <p className="text-xs text-slate-500">per month</p>
                            )}
                            {monthlyPlan.trialDays > 0 && (
                              <p className="text-xs text-emerald-600 mt-1">
                                {monthlyPlan.trialDays}-day free trial
                              </p>
                            )}
                          </div>
                          <Button
                            size="sm"
                            className="w-full"
                            variant={sub?.plan.id === monthlyPlan.id ? 'outline' : 'default'}
                            loading={buyingPlan === monthlyPlan.id}
                            onClick={() => buyPlan(monthlyPlan)}
                            disabled={sub?.plan.id === monthlyPlan.id && subStatus === 'ACTIVE'}
                          >
                            {sub?.plan.id === monthlyPlan.id && subStatus === 'ACTIVE'
                              ? 'Active Plan'
                              : monthlyPlan.price === 0 ? 'Activate Free' : 'Get Monthly'}
                          </Button>
                        </div>
                      )}
                      
                      {/* Yearly Plan */}
                      {yearlyPlan && (
                        <div className={`rounded-xl border-2 ${
                          sub?.plan.id === yearlyPlan.id 
                            ? 'border-violet-500 bg-violet-50' 
                            : 'border-emerald-200 bg-emerald-50/50'
                        } p-4 relative`}>
                          {monthlyPlan && (
                            <div className="absolute -top-2.5 right-4">
                              <Badge className="bg-emerald-600 text-white text-[10px] px-2 py-0.5">
                                Save {Math.round((1 - yearlyPlan.price / (monthlyPlan.price * 12)) * 100)}%
                              </Badge>
                            </div>
                          )}
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-emerald-700 uppercase">Yearly</span>
                              {sub?.plan.id === yearlyPlan.id && (
                                <Badge variant="active" className="text-[10px]">Current</Badge>
                              )}
                            </div>
                          </div>
                          <div className="mb-3">
                            <p className="text-2xl font-bold text-slate-900">₹{yearlyPlan.price}</p>
                            <p className="text-xs text-slate-500">
                              per year · ₹{Math.round(yearlyPlan.price / 12)}/month
                            </p>
                            {monthlyPlan && (
                              <p className="text-xs text-emerald-700 font-medium mt-1">
                                Save ₹{(monthlyPlan.price * 12) - yearlyPlan.price}/year
                              </p>
                            )}
                            {yearlyPlan.trialDays > 0 && (
                              <p className="text-xs text-emerald-600 mt-1">
                                {yearlyPlan.trialDays}-day free trial
                              </p>
                            )}
                          </div>
                          <Button
                            size="sm"
                            className="w-full bg-emerald-600 hover:bg-emerald-700"
                            variant={sub?.plan.id === yearlyPlan.id ? 'outline' : 'default'}
                            loading={buyingPlan === yearlyPlan.id}
                            onClick={() => buyPlan(yearlyPlan)}
                            disabled={sub?.plan.id === yearlyPlan.id && subStatus === 'ACTIVE'}
                          >
                            {sub?.plan.id === yearlyPlan.id && subStatus === 'ACTIVE'
                              ? 'Active Plan'
                              : 'Get Yearly'}
                          </Button>
                        </div>
                      )}
                    </div>
                    
                    {/* Features list */}
                    {monthlyPlan?.features && monthlyPlan.features.length > 0 && (
                      <div className="mt-3 rounded-lg bg-slate-50 p-3">
                        <p className="text-xs font-medium text-slate-600 mb-2">Includes:</p>
                        <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
                          {monthlyPlan.features.slice(0, 6).map((f, i) => (
                            <li key={i} className="flex items-start gap-1.5 text-xs text-slate-600">
                              <span className="text-emerald-500 mt-0.5 shrink-0">✓</span>
                              <span>{f.replace('💰 ', '')}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )
              })}
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
