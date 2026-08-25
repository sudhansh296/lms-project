'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PageLoading } from '@/components/ui/loading'
import { IndianRupee, Save, Info } from 'lucide-react'
import toast from 'react-hot-toast'

interface Library {
  id: string
  name: string
  basePrice: number
}

export default function OwnerSeatPricingPage() {
  const [library, setLibrary] = useState<Library | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [price, setPrice] = useState<string>('0')

  useEffect(() => {
    fetch('/api/owner/library')
      .then(r => r.json())
      .then(d => {
        setLibrary(d.library)
        setPrice(String(d.library?.basePrice ?? 0))
      })
      .finally(() => setLoading(false))
  }, [])

  const save = async () => {
    const val = parseFloat(price)
    if (isNaN(val) || val < 0) { toast.error('Enter a valid price (0 or more)'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/owner/library', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ basePrice: val }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed to save'); return }
      setLibrary(data.library)
      setPrice(String(data.library.basePrice))
      toast.success('Seat price updated')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <PageLoading />

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Seat Pricing</h1>
        <p className="text-slate-500 text-sm">Set the base price students pay to book a seat</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IndianRupee className="h-4 w-4 text-violet-500" />
            Base Seat Price
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-500">
            This is the price students pay per booking at <span className="font-semibold text-slate-700">{library?.name}</span>.
            Individual seats can have an extra charge on top of this via the seat layout editor.
          </p>

          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium text-sm">₹</span>
              <input
                type="number"
                value={price}
                min="0"
                step="1"
                onChange={e => setPrice(e.target.value)}
                className="w-full rounded-xl border border-slate-200 pl-8 pr-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-violet-500"
                placeholder="e.g. 99"
              />
            </div>
            <Button loading={saving} onClick={save} className="gap-2">
              <Save className="h-4 w-4" /> Save Price
            </Button>
          </div>

          <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-3 flex items-start gap-2 text-xs text-indigo-700">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium mb-1">What students pay</p>
              <p>Base price + 5% platform fee + applicable payment processing charges = final checkout amount.</p>
              <p className="mt-1">Set to <span className="font-mono font-bold">0</span> for free bookings.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Example breakdown */}
      {parseFloat(price) > 0 && !isNaN(parseFloat(price)) && (
        <Card className="bg-slate-50 border-slate-200">
          <CardContent className="p-4 space-y-2 text-sm">
            <p className="font-semibold text-slate-700 mb-3">Example student checkout breakdown</p>
            {(() => {
              const base = parseFloat(price)
              const platform = Math.round(base * 5) / 100
              const processing = Math.round((base + platform) * 2) / 100
              const gst = Math.round(processing * 18) / 100
              const total = Math.round((base + platform + processing + gst) * 100) / 100
              return (
                <div className="space-y-1.5">
                  {[
                    ['Seat Booking', `₹${base.toFixed(2)}`],
                    ['Platform Fee (5%)', `₹${platform.toFixed(2)}`],
                    ['Processing Fee (~2%)', `₹${processing.toFixed(2)}`],
                    ['GST on Fee (18%)', `₹${gst.toFixed(2)}`],
                  ].map(([l, v]) => (
                    <div key={l} className="flex justify-between text-slate-600">
                      <span>{l}</span><span>{v}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-bold text-slate-900 pt-2 border-t border-slate-200">
                    <span>Student Pays</span><span>₹{total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-700 font-medium pt-1">
                    <span>Your Settlement</span><span>₹{base.toFixed(2)}</span>
                  </div>
                </div>
              )
            })()}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
