'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard } from '@/components/ui/stat-card'
import { PageLoading } from '@/components/ui/loading'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '@/lib/utils'
import { CreditCard, TrendingUp, RefreshCw } from 'lucide-react'

interface RevenueData {
  total: number; monthly: number; yearly: number; refunds: number
  membershipRevenue: number; bookingRevenue: number
  monthlyBreakdown: Array<{ label: string; amount: number }>
}

export default function AdminRevenuePage() {
  const [data, setData] = useState<RevenueData | null>(null)
  const [loading, setLoading] = useState(true)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const fetchRevenue = async () => {
    setLoading(true)
    const q = new URLSearchParams()
    if (from) q.set('from', from)
    if (to) q.set('to', to)
    const res = await fetch(`/api/admin/revenue?${q}`)
    const d = await res.json()
    setData(d)
    setLoading(false)
  }

  useEffect(() => { fetchRevenue() }, [])

  if (loading && !data) return <PageLoading />

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Revenue</h1>
          <p className="text-slate-500 text-sm">Platform-wide revenue analytics</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <span className="text-slate-400">to</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <button onClick={fetchRevenue} className="rounded-xl bg-indigo-600 text-white px-4 py-2 text-sm hover:bg-indigo-700 transition-colors">
            Apply
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Total Revenue" value={formatCurrency(data?.total ?? 0)}
          icon={<CreditCard className="h-5 w-5" />} accentColor="bg-indigo-500" />
        <StatCard title="Monthly Revenue" value={formatCurrency(data?.monthly ?? 0)}
          icon={<TrendingUp className="h-5 w-5" />} accentColor="bg-emerald-500" />
        <StatCard title="Membership Revenue" value={formatCurrency(data?.membershipRevenue ?? 0)}
          icon={<CreditCard className="h-5 w-5" />} accentColor="bg-violet-500" />
        <StatCard title="Total Refunds" value={formatCurrency(data?.refunds ?? 0)}
          icon={<RefreshCw className="h-5 w-5" />} accentColor="bg-red-400" />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Card className="p-4">
          <p className="text-sm text-slate-500 mb-1">Net Revenue (after refunds)</p>
          <p className="text-2xl font-bold text-emerald-600">{formatCurrency((data?.total ?? 0) - (data?.refunds ?? 0))}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-slate-500 mb-1">Yearly Revenue</p>
          <p className="text-2xl font-bold text-indigo-600">{formatCurrency(data?.yearly ?? 0)}</p>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader><CardTitle>Monthly Revenue — Last 12 Months</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data?.monthlyBreakdown ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => [formatCurrency(Number(v)), 'Revenue']} />
              <Bar dataKey="amount" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}
