'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageLoading } from '@/components/ui/loading'
import { CreditCard, CheckCircle, ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/contexts/auth-context'
import { formatDate, formatCurrency } from '@/lib/utils'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface SubscriptionPlan {
  id: string
  name: string
  price: number
  billingCycle: string
  trialDays: number
  features: string[]
  description?: string
}

interface Subscription {
  status: string
  trialEnd: string | null
  endDate: string | null
  plan: SubscriptionPlan
}

export default function OwnerSubscriptionPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [buyingPlan, setBuyingPlan] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/owner/subscription')
      .then(r => r.json())
      .then(d => {
        setSubscription(d.subscription)
        setPlans(d.plans ?? [])
      })
      .finally(() => setLoading(false))
  }, [])

  const buyPlan = async (plan: SubscriptionPlan) => {
    if (plan.price === 0) {
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
      if (!res.ok) {
        toast.error(data.error ?? 'Failed')
        return
      }
      toast.success('Free plan activated!')
      window.location.reload()
      return
    }

    setBuyingPlan(plan.id)
    try {
      const orderRes = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: plan.price,
          notes: { planId: plan.id, type: 'SUBSCRIPTION', ownerId: user?.id },
        }),
      })
      const orderData = await orderRes.json()
      if (!orderRes.ok) {
        toast.error('Payment setup failed')
        return
      }

      await new Promise<void>((resolve, reject) => {
        if ((window as unknown as Record<string, unknown>).Razorpay) {
          resolve()
          return
        }
        const script = document.createElement('script')
        script.src = 'https://checkout.razorpay.com/v1/checkout.js'
        script.onload = () => resolve()
        script.onerror = () => reject(new Error('Failed to load Razorpay'))
        document.body.appendChild(script)
      })

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
    } finally {
      setBuyingPlan(null)
    }
  }

  if (loading) return <PageLoading />

  const subStatus = subscription?.status ?? 'NONE'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-slate-100">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Platform Subscription</h1>
          <p className="text-slate-500 text-sm">Choose the best plan for your library</p>
        </div>
      </div>

      {/* Current Subscription */}
      {subscription && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-500" />
              Current Plan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-slate-900">{subscription.plan.name}</p>
                <Badge
                  variant={
                    subStatus === 'ACTIVE' ? 'active' : subStatus === 'TRIAL' ? 'pending' : 'suspended'
                  }
                >
                  {subStatus}
                </Badge>
              </div>
              <p className="text-slate-500 text-xs">
                {subscription.plan.price === 0
                  ? 'Free plan'
                  : `${formatCurrency(subscription.plan.price)} / ${subscription.plan.billingCycle.toLowerCase()}`}
              </p>
              {subscription.trialEnd && (
                <p className="text-xs text-amber-600">Trial ends: {formatDate(subscription.trialEnd)}</p>
              )}
              {subscription.endDate && (
                <p className="text-xs text-slate-500">Renews: {formatDate(subscription.endDate)}</p>
              )}
              {subscription.plan.features.length > 0 && (
                <ul className="space-y-1 pt-2">
                  {subscription.plan.features.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs text-slate-600">
                      <span className="text-emerald-500">✓</span> {f}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Available Plans */}
      <div>
        <h2 className="text-lg font-bold text-slate-900 mb-4">
          {subscription ? 'Switch to a Different Plan' : 'Choose Your Plan'}
        </h2>

        {plans.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-slate-400">No subscription plans available</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {['Starter', 'Basic', 'Professional', 'Enterprise'].map(tier => {
              const tierPlans = plans.filter(p => p.name.startsWith(tier))
              if (tierPlans.length === 0) return null

              const monthlyPlan = tierPlans.find(p => p.billingCycle === 'MONTHLY')
              const yearlyPlan = tierPlans.find(p => p.billingCycle === 'YEARLY')

              return (
                <div key={tier}>
                  <div className="flex items-baseline gap-3 mb-4">
                    <h3 className="text-xl font-bold text-slate-800">{tier}</h3>
                    {monthlyPlan?.description && (
                      <p className="text-sm text-slate-500">{monthlyPlan.description}</p>
                    )}
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Monthly Plan */}
                    {monthlyPlan && (
                      <Card
                        className={`${
                          subscription?.plan.id === monthlyPlan.id
                            ? 'ring-2 ring-violet-500 bg-violet-50'
                            : 'hover:shadow-lg transition-shadow'
                        }`}
                      >
                        <CardContent className="p-6">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-slate-500 uppercase">Monthly</span>
                              {subscription?.plan.id === monthlyPlan.id && (
                                <Badge variant="active" className="text-xs">
                                  Current
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="mb-6">
                            <p className="text-4xl font-bold text-slate-900">
                              {monthlyPlan.price === 0 ? 'Free' : `₹${monthlyPlan.price}`}
                            </p>
                            {monthlyPlan.price > 0 && <p className="text-sm text-slate-500 mt-1">per month</p>}
                            {monthlyPlan.trialDays > 0 && (
                              <p className="text-sm text-emerald-600 font-medium mt-2">
                                {monthlyPlan.trialDays}-day free trial
                              </p>
                            )}
                          </div>
                          <Button
                            className="w-full mb-4"
                            variant={subscription?.plan.id === monthlyPlan.id ? 'outline' : 'default'}
                            loading={buyingPlan === monthlyPlan.id}
                            onClick={() => buyPlan(monthlyPlan)}
                            disabled={subscription?.plan.id === monthlyPlan.id && subStatus === 'ACTIVE'}
                          >
                            {subscription?.plan.id === monthlyPlan.id && subStatus === 'ACTIVE'
                              ? 'Current Plan'
                              : monthlyPlan.price === 0
                              ? 'Activate Free'
                              : 'Get Monthly'}
                          </Button>
                          {monthlyPlan.features && monthlyPlan.features.length > 0 && (
                            <ul className="space-y-2">
                              {monthlyPlan.features.map((f, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                                  <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                                  <span>{f.replace('💰 ', '')}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </CardContent>
                      </Card>
                    )}

                    {/* Yearly Plan */}
                    {yearlyPlan && (
                      <Card
                        className={`relative ${
                          subscription?.plan.id === yearlyPlan.id
                            ? 'ring-2 ring-violet-500 bg-violet-50'
                            : 'ring-2 ring-emerald-200 hover:shadow-lg transition-shadow'
                        }`}
                      >
                        {monthlyPlan && (
                          <div className="absolute -top-3 right-4">
                            <Badge className="bg-emerald-600 text-white text-xs px-3 py-1">
                              Save {Math.round((1 - yearlyPlan.price / (monthlyPlan.price * 12)) * 100)}%
                            </Badge>
                          </div>
                        )}
                        <CardContent className="p-6">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-emerald-700 uppercase">Yearly</span>
                              {subscription?.plan.id === yearlyPlan.id && (
                                <Badge variant="active" className="text-xs">
                                  Current
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="mb-6">
                            <p className="text-4xl font-bold text-slate-900">₹{yearlyPlan.price}</p>
                            <p className="text-sm text-slate-500 mt-1">
                              per year · ₹{Math.round(yearlyPlan.price / 12)}/month
                            </p>
                            {monthlyPlan && (
                              <p className="text-sm text-emerald-700 font-semibold mt-2">
                                Save ₹{monthlyPlan.price * 12 - yearlyPlan.price}/year
                              </p>
                            )}
                            {yearlyPlan.trialDays > 0 && (
                              <p className="text-sm text-emerald-600 font-medium mt-1">
                                {yearlyPlan.trialDays}-day free trial
                              </p>
                            )}
                          </div>
                          <Button
                            className="w-full mb-4 bg-emerald-600 hover:bg-emerald-700"
                            variant={subscription?.plan.id === yearlyPlan.id ? 'outline' : 'default'}
                            loading={buyingPlan === yearlyPlan.id}
                            onClick={() => buyPlan(yearlyPlan)}
                            disabled={subscription?.plan.id === yearlyPlan.id && subStatus === 'ACTIVE'}
                          >
                            {subscription?.plan.id === yearlyPlan.id && subStatus === 'ACTIVE'
                              ? 'Current Plan'
                              : 'Get Yearly'}
                          </Button>
                          {yearlyPlan.features && yearlyPlan.features.length > 0 && (
                            <ul className="space-y-2">
                              {yearlyPlan.features.slice(0, -1).map((f, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                                  <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                                  <span>{f.replace('💰 ', '')}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Help Text */}
      <Card className="bg-slate-50 border-slate-200">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <CreditCard className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
            <div className="text-sm text-slate-600">
              <p className="font-medium text-slate-900 mb-1">Need help choosing?</p>
              <p>
                All plans include core library management features. Choose based on your library size and number of
                branches. You can upgrade or downgrade anytime.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
