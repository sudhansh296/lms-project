'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { EmptyState } from '@/components/ui/empty-state'
import { PageLoading } from '@/components/ui/loading'
import { Plus, Edit2, Trash2, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatCurrency } from '@/lib/utils'

interface Plan {
  id: string; name: string; description?: string; durationDays: number; price: number
  benefits: string[]; isActive: boolean
  _count: { studentMemberships: number }
}

const DURATION_PRESETS = [
  { label: 'Daily', days: 1 },
  { label: 'Weekly', days: 7 },
  { label: 'Monthly', days: 30 },
  { label: 'Quarterly', days: 90 },
  { label: 'Half-Yearly', days: 180 },
  { label: 'Yearly', days: 365 },
]

export default function OwnerMembershipsPage() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<'add' | 'edit' | null>(null)
  const [editPlan, setEditPlan] = useState<Plan | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '', description: '', durationDays: 30, price: 0,
    benefits: [''] as string[], customDays: false,
  })

  const fetchPlans = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/owner/memberships')
    const data = await res.json()
    setPlans(data.plans ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchPlans() }, [fetchPlans])

  const openAdd = () => {
    setForm({ name: '', description: '', durationDays: 30, price: 0, benefits: [''], customDays: false })
    setEditPlan(null)
    setModal('add')
  }

  const openEdit = (plan: Plan) => {
    setForm({
      name: plan.name, description: plan.description ?? '',
      durationDays: plan.durationDays, price: plan.price,
      benefits: plan.benefits.length > 0 ? plan.benefits : [''],
      customDays: !DURATION_PRESETS.some(p => p.days === plan.durationDays),
    })
    setEditPlan(plan)
    setModal('edit')
  }

  const savePlan = async () => {
    if (!form.name.trim()) { toast.error('Plan name required'); return }
    if (form.price < 0) { toast.error('Price cannot be negative'); return }
    setSaving(true)
    try {
      const payload = {
        name: form.name,
        description: form.description || undefined,
        durationDays: form.durationDays,
        price: form.price,
        benefits: form.benefits.filter(b => b.trim()),
      }
      const url = modal === 'edit' ? `/api/owner/memberships/${editPlan!.id}` : '/api/owner/memberships'
      const res = await fetch(url, {
        method: modal === 'edit' ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed'); return }
      toast.success(modal === 'edit' ? 'Plan updated' : 'Plan created')
      setModal(null)
      fetchPlans()
    } finally {
      setSaving(false)
    }
  }

  const deletePlan = async (id: string) => {
    const res = await fetch(`/api/owner/memberships/${id}`, { method: 'DELETE' })
    if (!res.ok) { toast.error('Failed to deactivate plan'); return }
    toast.success('Plan deactivated')
    fetchPlans()
  }

  const setBenefit = (i: number, val: string) => {
    const b = [...form.benefits]; b[i] = val; setForm(p => ({ ...p, benefits: b }))
  }

  if (loading) return <PageLoading />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Membership Plans</h1>
          <p className="text-slate-500 text-sm">{plans.length} plans configured</p>
        </div>
        <Button onClick={openAdd}><Plus className="h-4 w-4" /> Add Plan</Button>
      </div>

      {plans.length === 0 ? (
        <EmptyState icon={<Users className="h-8 w-8" />} title="No membership plans yet"
          description="Create plans so students can subscribe to your library."
          action={{ label: 'Create First Plan', onClick: openAdd }} />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map(plan => (
            <Card key={plan.id} className={`relative ${!plan.isActive ? 'opacity-60' : ''}`}>
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-slate-900">{plan.name}</h3>
                    <p className="text-sm text-slate-500 mt-0.5">{plan.durationDays} days</p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(plan)}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-red-400 hover:text-red-600"
                      onClick={() => deletePlan(plan.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <p className="text-3xl font-bold text-indigo-600 mb-3">{formatCurrency(plan.price)}</p>

                {plan.description && (
                  <p className="text-sm text-slate-500 mb-3">{plan.description}</p>
                )}

                {plan.benefits.length > 0 && (
                  <ul className="space-y-1 mb-4">
                    {plan.benefits.map((b, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-slate-600">
                        <span className="text-emerald-500">✓</span> {b}
                      </li>
                    ))}
                  </ul>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <p className="text-xs text-slate-500">
                    <span className="font-semibold text-slate-700">{plan._count.studentMemberships}</span> active students
                  </p>
                  <Badge variant={plan.isActive ? 'active' : 'suspended'}>
                    {plan.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal open={!!modal} onOpenChange={() => setModal(null)}
        title={modal === 'edit' ? 'Edit Plan' : 'Create Membership Plan'} size="lg">
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Plan Name *</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g. Monthly Plan" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Price (₹) *</label>
              <input type="number" value={form.price} onChange={e => setForm(p => ({ ...p, price: Number(e.target.value) }))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                min="0" placeholder="0" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Duration</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {DURATION_PRESETS.map(p => (
                <button key={p.days} type="button"
                  onClick={() => setForm(f => ({ ...f, durationDays: p.days, customDays: false }))}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                    form.durationDays === p.days && !form.customDays
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'border-slate-200 text-slate-600 hover:border-indigo-300'
                  }`}>
                  {p.label} ({p.days}d)
                </button>
              ))}
              <button type="button"
                onClick={() => setForm(f => ({ ...f, customDays: true }))}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                  form.customDays ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 text-slate-600'
                }`}>
                Custom
              </button>
            </div>
            {form.customDays && (
              <input type="number" value={form.durationDays}
                onChange={e => setForm(p => ({ ...p, durationDays: Number(e.target.value) }))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                min="1" placeholder="Number of days" />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Description</label>
            <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              rows={2} placeholder="Optional description" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Benefits</label>
            <div className="space-y-2">
              {form.benefits.map((b, i) => (
                <div key={i} className="flex gap-2">
                  <input value={b} onChange={e => setBenefit(i, e.target.value)}
                    className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder={`Benefit ${i + 1}`} />
                  {form.benefits.length > 1 && (
                    <Button type="button" size="icon" variant="ghost" className="h-9 w-9 text-red-400"
                      onClick={() => setForm(p => ({ ...p, benefits: p.benefits.filter((_, idx) => idx !== i) }))}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
              <Button type="button" variant="outline" size="sm"
                onClick={() => setForm(p => ({ ...p, benefits: [...p.benefits, ''] }))}>
                <Plus className="h-3.5 w-3.5" /> Add Benefit
              </Button>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setModal(null)}>Cancel</Button>
            <Button loading={saving} onClick={savePlan}>
              {modal === 'edit' ? 'Save Changes' : 'Create Plan'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
