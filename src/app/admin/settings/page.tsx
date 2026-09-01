'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageLoading } from '@/components/ui/loading'
import { Settings, Shield, CreditCard, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/contexts/auth-context'

interface Plan {
  id: string; name: string; price: number; billingCycle: string
  trialDays: number; isActive: boolean; features: string[]
  maxSeats: number | null; maxStudents: number | null
}

export default function AdminSettingsPage() {
  const { user } = useAuth()
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [newPlan, setNewPlan] = useState({
    name: '', price: 0, billingCycle: 'MONTHLY', trialDays: 30,
    maxSeats: '', maxStudents: '', features: [''],
  })
  const [saving, setSaving] = useState(false)
  const [seeding, setSeeding] = useState(false)

  useEffect(() => {
    fetch('/api/admin/plans').then(r => r.json()).then(d => {
      setPlans(d.plans ?? [])
    }).catch(() => setPlans([])).finally(() => setLoading(false))
  }, [])

  const seedPlans = async () => {
    setSeeding(true)
    try {
      const res = await fetch('/api/admin/seed-plans', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to seed plans')
        return
      }
      toast.success(data.message ?? 'Plans seeded successfully!')
      // Reload plans
      const plansRes = await fetch('/api/admin/plans')
      const plansData = await plansRes.json()
      setPlans(plansData.plans ?? [])
    } catch (error) {
      toast.error('Failed to seed plans')
      console.error(error)
    } finally {
      setSeeding(false)
    }
  }

  const inp = "w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"

  if (loading) return <PageLoading />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Platform Settings</h1>
        <p className="text-slate-500 text-sm">Manage subscription plans and platform configuration</p>
      </div>

      {/* Admin info */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Shield className="h-4 w-4" /> Admin Account</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex gap-3 py-2 border-b border-slate-50">
            <span className="w-24 text-slate-500">Name</span>
            <span className="font-medium text-slate-900">{user?.name}</span>
          </div>
          <div className="flex gap-3 py-2 border-b border-slate-50">
            <span className="w-24 text-slate-500">Mobile</span>
            <span className="font-medium text-slate-900">{user?.mobile}</span>
          </div>
          <div className="flex gap-3 py-2">
            <span className="w-24 text-slate-500">Role</span>
            <Badge variant="default">Super Admin</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Subscription Plans */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2"><CreditCard className="h-4 w-4" /> Subscription Plans</CardTitle>
            <Button onClick={seedPlans} loading={seeding} size="sm" variant="outline">
              Seed Default Plans
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {plans.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-400 text-sm mb-4">No subscription plans found in database.</p>
              <Button onClick={seedPlans} loading={seeding}>
                Create Default Plans
              </Button>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {plans.map(plan => (
                <div key={plan.id} className="rounded-2xl border border-slate-100 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-slate-900">{plan.name}</h3>
                    <Badge variant={plan.isActive ? 'active' : 'suspended'}>
                      {plan.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <p className="text-2xl font-bold text-indigo-600">
                    {Number(plan.price) === 0 ? 'Free' : `₹${Number(plan.price)}/${plan.billingCycle === 'MONTHLY' ? 'mo' : 'yr'}`}
                  </p>
                  {plan.trialDays > 0 && (
                    <p className="text-xs text-slate-500 mt-1">{plan.trialDays} day trial</p>
                  )}
                  {plan.features.length > 0 && (
                    <ul className="mt-3 space-y-1">
                      {plan.features.map((f, i) => (
                        <li key={i} className="text-xs text-slate-600">✓ {f}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Note */}
          <div className="mt-4 rounded-xl bg-slate-50 border border-slate-200 p-4">
            <p className="text-sm text-slate-600 flex items-start gap-2">
              <Settings className="h-4 w-4 mt-0.5 text-slate-400 shrink-0" />
              The platform currently runs on a free model. Paid subscription plans can be configured here when you're ready to monetize library owner access.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Platform Info */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-4 w-4" /> Platform Info</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-2">
          {[
            { label: 'Platform Name', value: 'StudyLib' },
            { label: 'Version', value: '1.0.0' },
            { label: 'Default Currency', value: 'INR (₹)' },
            { label: 'Default Country', value: 'India' },
            { label: 'Student Registration', value: 'Open' },
            { label: 'Library Registration', value: 'Open (requires admin approval)' },
          ].map(r => (
            <div key={r.label} className="flex gap-3 py-2 border-b border-slate-50 last:border-0">
              <span className="w-48 text-slate-500 shrink-0">{r.label}</span>
              <span className="font-medium text-slate-900">{r.value}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
