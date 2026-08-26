'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageLoading } from '@/components/ui/loading'
import { Plus, Edit2, Power, Clock, Calendar, IndianRupee, CheckCircle, X } from 'lucide-react'
import toast from 'react-hot-toast'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Plan {
  id: string
  name: string
  description?: string
  dailyMinutes: number
  durationValue: number
  durationUnit: string
  price: number
  timeSelectionMode: string
  fixedStartTime?: string | null
  fixedEndTime?: string | null
  allowedDays: number[]
  benefits: string[]
  isActive: boolean
  _count?: { bookings: number }
}

const DAYS_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const UNIT_LABELS: Record<string, string> = { DAY: 'Day(s)', WEEK: 'Week(s)', MONTH: 'Month(s)', YEAR: 'Year(s)' }

function formatDailyMins(mins: number) {
  if (mins < 60) return `${mins} min/day`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}m/day` : `${h} hr${h > 1 ? 's' : ''}/day`
}

const BLANK: Omit<Plan, 'id' | 'isActive' | '_count'> = {
  name: '', description: '',
  dailyMinutes: 120,
  durationValue: 1, durationUnit: 'MONTH',
  price: 0,
  timeSelectionMode: 'FLEXIBLE',
  fixedStartTime: '', fixedEndTime: '',
  allowedDays: [0,1,2,3,4,5,6],
  benefits: [],
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OwnerPricingPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ ...BLANK })
  const [newBenefit, setNewBenefit] = useState('')

  const inp = 'w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500'

  const load = () => {
    fetch('/api/owner/memberships')
      .then(r => r.json())
      .then(d => setPlans(d.plans ?? []))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setEditingId(null)
    setForm({ ...BLANK })
    setShowForm(true)
  }

  const openEdit = (p: Plan) => {
    setEditingId(p.id)
    setForm({
      name: p.name,
      description: p.description ?? '',
      dailyMinutes: p.dailyMinutes,
      durationValue: p.durationValue,
      durationUnit: p.durationUnit,
      price: p.price,
      timeSelectionMode: p.timeSelectionMode,
      fixedStartTime: p.fixedStartTime ?? '',
      fixedEndTime: p.fixedEndTime ?? '',
      allowedDays: p.allowedDays,
      benefits: p.benefits,
    })
    setShowForm(true)
  }

  const toggleDay = (d: number) => {
    setForm(f => ({
      ...f,
      allowedDays: f.allowedDays.includes(d)
        ? f.allowedDays.filter(x => x !== d)
        : [...f.allowedDays, d].sort(),
    }))
  }

  const save = async () => {
    if (!form.name.trim()) { toast.error('Plan name required'); return }
    if (form.dailyMinutes < 15) { toast.error('Min 15 minutes/day'); return }
    if (form.price < 0) { toast.error('Price must be 0 or more'); return }
    if (form.allowedDays.length === 0) { toast.error('Select at least one day'); return }
    if (form.timeSelectionMode === 'FIXED') {
      if (!form.fixedStartTime || !form.fixedEndTime) { toast.error('Start and end time required for Fixed plans'); return }
      const [sh, sm] = form.fixedStartTime.split(':').map(Number)
      const [eh, em] = form.fixedEndTime.split(':').map(Number)
      if (eh * 60 + em <= sh * 60 + sm) { toast.error('End time must be after start time'); return }
      const diff = (eh * 60 + em) - (sh * 60 + sm)
      if (diff !== form.dailyMinutes) { toast.error(`Time slot (${diff} min) must equal daily minutes (${form.dailyMinutes})`); return }
    }

    setSaving(true)
    try {
      const payload = {
        ...form,
        fixedStartTime: form.timeSelectionMode === 'FIXED' ? form.fixedStartTime || null : null,
        fixedEndTime:   form.timeSelectionMode === 'FIXED' ? form.fixedEndTime   || null : null,
      }
      const url = editingId ? `/api/owner/memberships/${editingId}` : '/api/owner/memberships'
      const method = editingId ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed to save'); return }
      toast.success(editingId ? 'Plan updated' : 'Plan created')
      setShowForm(false)
      load()
    } finally {
      setSaving(false)
    }
  }

  const toggle = async (plan: Plan) => {
    await fetch(`/api/owner/memberships/${plan.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !plan.isActive }),
    })
    load()
  }

  if (loading) return <PageLoading />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Seat Pricing Plans</h1>
          <p className="text-slate-500 text-sm mt-1">
            Create your own study packages. You set the price — the platform adds a 5% fee on top for the student.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Add Plan
        </Button>
      </div>

      {/* Form */}
      {showForm && (
        <Card className="border-violet-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{editingId ? 'Edit Plan' : 'New Pricing Plan'}</CardTitle>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {/* Name + Description */}
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Plan Name *</label>
                <input className={inp} placeholder="e.g. Regular 2 Hour Plan"
                  value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
                <input className={inp} placeholder="Optional short description"
                  value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
            </div>

            {/* Daily access */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Daily Study Time *</label>
              <div className="flex items-center gap-2">
                <input type="number" className={inp + ' w-24'} min="15" step="15"
                  value={form.dailyMinutes}
                  onChange={e => setForm(f => ({ ...f, dailyMinutes: parseInt(e.target.value) || 60 }))} />
                <span className="text-slate-500 text-xs">minutes / day</span>
                <span className="text-xs text-indigo-600 font-medium">({formatDailyMins(form.dailyMinutes)})</span>
              </div>
            </div>

            {/* Duration */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Plan Duration *</label>
              <div className="flex items-center gap-2">
                <input type="number" className={inp + ' w-24'} min="1"
                  value={form.durationValue}
                  onChange={e => setForm(f => ({ ...f, durationValue: parseInt(e.target.value) || 1 }))} />
                <select className={inp + ' w-36'} value={form.durationUnit}
                  onChange={e => setForm(f => ({ ...f, durationUnit: e.target.value }))}>
                  <option value="DAY">Day(s)</option>
                  <option value="WEEK">Week(s)</option>
                  <option value="MONTH">Month(s)</option>
                  <option value="YEAR">Year(s)</option>
                </select>
              </div>
            </div>

            {/* Price */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Package Price (₹) *</label>
              <div className="relative w-48">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₹</span>
                <input type="number" className={inp + ' pl-7'} min="0" step="1"
                  value={form.price}
                  onChange={e => setForm(f => ({ ...f, price: parseFloat(e.target.value) || 0 }))} />
              </div>
              {form.price > 0 && (
                <p className="text-xs text-slate-400 mt-1">
                  Student pays ₹{(form.price * 1.05).toFixed(2)} (₹{form.price} + 5% platform fee)
                </p>
              )}
            </div>

            {/* Time mode */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-2">Daily Time Selection</label>
              <div className="flex gap-4">
                {[
                  { val: 'FLEXIBLE', label: 'Student chooses time' },
                  { val: 'FIXED', label: 'Fixed time slot' },
                ].map(opt => (
                  <label key={opt.val} className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="timeMode" value={opt.val}
                      checked={form.timeSelectionMode === opt.val}
                      onChange={() => setForm(f => ({ ...f, timeSelectionMode: opt.val }))} />
                    <span className="text-sm text-slate-700">{opt.label}</span>
                  </label>
                ))}
              </div>
              {form.timeSelectionMode === 'FIXED' && (
                <div className="mt-3 flex items-center gap-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Start</label>
                    <input type="time" className={inp + ' w-36'}
                      value={form.fixedStartTime ?? ''}
                      onChange={e => {
                        const st = e.target.value
                        const [sh, sm] = st.split(':').map(Number)
                        const endMins = sh * 60 + sm + form.dailyMinutes
                        const eh = Math.floor(endMins / 60).toString().padStart(2, '0')
                        const em = (endMins % 60).toString().padStart(2, '0')
                        setForm(f => ({ ...f, fixedStartTime: st, fixedEndTime: `${eh}:${em}` }))
                      }} />
                  </div>
                  <span className="text-slate-400 mt-4">→</span>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">End (auto)</label>
                    <input type="time" className={inp + ' w-36 bg-slate-50'} readOnly
                      value={form.fixedEndTime ?? ''} />
                  </div>
                </div>
              )}
            </div>

            {/* Allowed days */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-2">Applicable Days</label>
              <div className="flex flex-wrap gap-2">
                {DAYS_LABELS.map((label, d) => (
                  <button key={d} type="button" onClick={() => toggleDay(d)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                      form.allowedDays.includes(d)
                        ? 'bg-violet-600 text-white'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Benefits */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-2">Benefits (optional)</label>
              <div className="flex gap-2 mb-2">
                <input className={inp + ' flex-1'} placeholder="Add a benefit"
                  value={newBenefit} onChange={e => setNewBenefit(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newBenefit.trim()) {
                      setForm(f => ({ ...f, benefits: [...f.benefits, newBenefit.trim()] }))
                      setNewBenefit('')
                      e.preventDefault()
                    }
                  }} />
                <Button size="sm" type="button" variant="outline" onClick={() => {
                  if (newBenefit.trim()) {
                    setForm(f => ({ ...f, benefits: [...f.benefits, newBenefit.trim()] }))
                    setNewBenefit('')
                  }
                }}>Add</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {form.benefits.map((b, i) => (
                  <span key={i} className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-xs px-2 py-1 rounded-full">
                    {b}
                    <button onClick={() => setForm(f => ({ ...f, benefits: f.benefits.filter((_, j) => j !== i) }))}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button loading={saving} onClick={save} className="gap-2">
                <CheckCircle className="h-4 w-4" /> {editingId ? 'Update Plan' : 'Create Plan'}
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Plans list */}
      {plans.length === 0 && !showForm && (
        <Card>
          <CardContent className="py-16 text-center">
            <IndianRupee className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="font-semibold text-slate-600 mb-1">No pricing plans yet</p>
            <p className="text-sm text-slate-400 mb-4">Create your first plan so students can book seats.</p>
            <Button onClick={openCreate} className="gap-2"><Plus className="h-4 w-4" /> Add Your First Plan</Button>
          </CardContent>
        </Card>
      )}

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {plans.map(plan => (
          <Card key={plan.id} className={`${!plan.isActive ? 'opacity-60' : ''} relative`}>
            <CardContent className="p-5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-slate-900">{plan.name}</p>
                  {plan.description && <p className="text-xs text-slate-500 mt-0.5">{plan.description}</p>}
                </div>
                <Badge variant={plan.isActive ? 'active' : 'secondary'} className="shrink-0">
                  {plan.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>

              {/* Key stats */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-indigo-50 px-3 py-2">
                  <p className="text-indigo-500 mb-0.5 flex items-center gap-1"><Clock className="h-3 w-3" /> Daily</p>
                  <p className="font-bold text-indigo-800">{formatDailyMins(plan.dailyMinutes)}</p>
                </div>
                <div className="rounded-lg bg-violet-50 px-3 py-2">
                  <p className="text-violet-500 mb-0.5 flex items-center gap-1"><Calendar className="h-3 w-3" /> Duration</p>
                  <p className="font-bold text-violet-800">{plan.durationValue} {UNIT_LABELS[plan.durationUnit]}</p>
                </div>
              </div>

              {/* Time mode */}
              <div className="text-xs text-slate-500">
                {plan.timeSelectionMode === 'FIXED'
                  ? <span className="text-amber-700 font-medium">Fixed: {plan.fixedStartTime} – {plan.fixedEndTime}</span>
                  : <span className="text-emerald-700">Flexible — student picks time</span>}
              </div>

              {/* Days */}
              <div className="flex gap-1 flex-wrap">
                {DAYS_LABELS.map((label, d) => (
                  <span key={d} className={`text-[10px] px-1.5 py-0.5 rounded ${
                    plan.allowedDays.includes(d) ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-400'
                  }`}>{label}</span>
                ))}
              </div>

              {/* Price */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                <div>
                  <p className="text-xl font-bold text-slate-900">₹{plan.price.toFixed(0)}</p>
                  <p className="text-[10px] text-slate-400">Student pays ₹{(plan.price * 1.05).toFixed(2)}</p>
                </div>
                <div className="text-xs text-slate-400">
                  {plan._count?.bookings ?? 0} active booking{(plan._count?.bookings ?? 0) !== 1 ? 's' : ''}
                </div>
              </div>

              {/* Benefits */}
              {plan.benefits.length > 0 && (
                <div className="space-y-1">
                  {plan.benefits.map((b, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs text-slate-600">
                      <CheckCircle className="h-3 w-3 text-emerald-500 shrink-0" /> {b}
                    </div>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={() => openEdit(plan)}>
                  <Edit2 className="h-3.5 w-3.5" /> Edit
                </Button>
                <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={() => toggle(plan)}>
                  <Power className="h-3.5 w-3.5" /> {plan.isActive ? 'Disable' : 'Enable'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
