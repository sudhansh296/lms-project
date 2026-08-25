'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard } from '@/components/ui/stat-card'
import { PageLoading } from '@/components/ui/loading'
import { UpgradeGate } from '@/components/ui/upgrade-gate'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '@/lib/utils'
import { CreditCard, TrendingUp } from 'lucide-react'

const PERIOD_TABS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'custom', label: 'Custom' },
]

interface RevenueData {
  total: number; membershipRevenue: number; bookingRevenue: number
  refunds: number; net: number
  monthly: Array<{ label: string; amount: number }>
  upgradeRequired?: boolean
  error?: string
}

export default function OwnerRevenuePage() {
  const [data, setData] = useState<RevenueData | null>(null)
  const [loading, setLoading] = useState(true)
  const [locked, setLocked] = useState(false)
  const [lockMessage, setLockMessage] = useState('')
  const [period, setPeriod] = useState('month')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const fetchRevenue = async () => {
    setLoading(true)
    const q = new URLSearchParams({ period })
    if (period === 'custom' && from && to) { q.set('from', from); q.set('to', to) }
    const res = await fetch(`/api/owner/revenue?${q}`)
    const d = await res.json()
    if (d.upgradeRequired) {
      setLocked(true)
      setLockMessage(d.error ?? 'Revenue reports require Level 2 or higher.')
    } else {
      setData(d)
    }
    setLoading(false)
  }

  useEffect(() => { fetchRevenue() }, [period])

  if (loading && !data) return <PageLoading />
  if (locked) return <UpgradeGate message={lockMessage} />
  if (loading && !data) return <PageLoading />
  if (locked) return <UpgradeGate message={lockMessage} />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Revenue</h1>
        <p className="text-slate-500 text-sm">Track your library&apos;s earnings</p>
      </div>

      {/* Period Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {PERIOD_TABS.map(t => (
          <button key={t.value} onClick={() => setPeriod(t.value)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
              period === t.value ? 'bg-violet-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {period === 'custom' && (
        <div className="flex items-center gap-3 flex-wrap">
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
          <span className="text-slate-400">to</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
          <button onClick={fetchRevenue} className="rounded-xl bg-violet-600 text-white px-4 py-2 text-sm hover:bg-violet-700">
            Apply
          </button>
        </div>
      )}

      {loading && !data ? <PageLoading /> : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Total Revenue" value={formatCurrency(data?.total ?? 0)}
              icon={<CreditCard className="h-5 w-5" />} accentColor="bg-violet-500" />
            <StatCard title="Membership Revenue" value={formatCurrency(data?.membershipRevenue ?? 0)}
              icon={<TrendingUp className="h-5 w-5" />} accentColor="bg-indigo-500" />
            <StatCard title="Booking Revenue" value={formatCurrency(data?.bookingRevenue ?? 0)}
              icon={<CreditCard className="h-5 w-5" />} accentColor="bg-emerald-500" />
            <StatCard title="Net Revenue" value={formatCurrency(data?.net ?? 0)}
              icon={<TrendingUp className="h-5 w-5" />} accentColor="bg-amber-500" />
          </div>

          {(data?.refunds ?? 0) > 0 && (
            <Card className="p-4 border-red-100 bg-red-50">
              <p className="text-sm text-red-700">Total Refunds: <span className="font-bold">{formatCurrency(data!.refunds)}</span></p>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle>Revenue Trend — Last 6 Months</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data?.monthly ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v) => [formatCurrency(Number(v)), 'Revenue']} />
                  <Bar dataKey="amount" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
