'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Clock, Calendar, CheckCircle, CreditCard, Receipt } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatDate } from '@/lib/utils'
import { format } from 'date-fns'

interface Seat {
  id: string
  label: string
  seatType: string
  status: string
  x: number
  y: number
  width: number
  height: number
  extraPrice?: number
  isAvailableForSlot: boolean
}

interface LayoutObj {
  id: string
  objectType: string
  label?: string
  x: number
  y: number
  width: number
  height: number
  color?: string
}

interface Library {
  id: string
  name: string
  minBookingMins: number
  maxBookingMins: number
  membershipPlans: Array<{ id: string; name: string; price: number; durationDays: number }>
}

interface PaymentBreakdown {
  baseAmount: number
  platformFee: number
  processingFee: number
  gstAmount: number
  totalAmount: number
  ownerAmount: number
}

const COLORS = {
  available: '#22c55e',
  booked: '#f59e0b',
  maintenance: '#94a3b8',
  selected: '#6366f1',
}

function fmt(n: number) {
  return `₹${n.toFixed(2)}`
}

export default function BookSeatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: libraryId } = use(params)
  const router = useRouter()

  const [step, setStep] = useState<'datetime' | 'seat' | 'summary' | 'paying' | 'done'>('datetime')
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('11:00')
  const [seats, setSeats] = useState<Seat[]>([])
  const [layoutObjects, setLayoutObjects] = useState<LayoutObj[]>([])
  const [layoutSize, setLayoutSize] = useState({ w: 900, h: 600 })
  const [selectedSeat, setSelectedSeat] = useState<Seat | null>(null)
  const [loadingSeats, setLoadingSeats] = useState(false)
  const [library, setLibrary] = useState<Library | null>(null)

  // Order data — set after seat-order API call
  const [orderData, setOrderData] = useState<{
    orderId: string; amount: number; currency: string; key: string
    bookingId: string; bookingRef: string; breakdown: PaymentBreakdown
  } | null>(null)
  const [creatingOrder, setCreatingOrder] = useState(false)
  const [paying, setPaying] = useState(false)

  // Confirmation screen
  const [confirmedRef, setConfirmedRef] = useState('')
  const [confirmedBreakdown, setConfirmedBreakdown] = useState<PaymentBreakdown | null>(null)

  useEffect(() => {
    fetch(`/api/libraries/${libraryId}`)
      .then(r => r.json())
      .then(d => setLibrary(d.library))
  }, [libraryId])

  const validateTime = (): boolean => {
    const start = new Date(`${selectedDate}T${startTime}:00`)
    const end = new Date(`${selectedDate}T${endTime}:00`)
    if (end <= start) { toast.error('End time must be after start time'); return false }
    if (start < new Date()) { toast.error('Cannot book in the past'); return false }
    const diffMins = (end.getTime() - start.getTime()) / 60000
    if (library && diffMins < library.minBookingMins) {
      toast.error(`Minimum booking is ${library.minBookingMins} minutes`); return false
    }
    if (library && diffMins > library.maxBookingMins) {
      toast.error(`Maximum booking is ${library.maxBookingMins} minutes`); return false
    }
    return true
  }

  const fetchSeats = async () => {
    setLoadingSeats(true)
    setSelectedSeat(null)
    const startISO = new Date(`${selectedDate}T${startTime}:00`).toISOString()
    const endISO = new Date(`${selectedDate}T${endTime}:00`).toISOString()
    const q = new URLSearchParams({ date: selectedDate, startTime: startISO, endTime: endISO })
    const res = await fetch(`/api/libraries/${libraryId}/seats?${q}`)
    const data = await res.json()
    setSeats(data.seats ?? [])
    if (data.layout) {
      setLayoutObjects(data.layout.objects ?? [])
      setLayoutSize({ w: data.layout.canvasWidth, h: data.layout.canvasHeight })
    }
    setLoadingSeats(false)
    setStep('seat')
  }

  // Step: after seat chosen, create the order to get the breakdown
  const handleProceedToSummary = async () => {
    if (!selectedSeat) return
    setCreatingOrder(true)

    const startISO = new Date(`${selectedDate}T${startTime}:00`).toISOString()
    const endISO = new Date(`${selectedDate}T${endTime}:00`).toISOString()

    try {
      const orderRes = await fetch('/api/payments/seat-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ libraryId, seatId: selectedSeat.id, startTime: startISO, endTime: endISO }),
      })
      const data = await orderRes.json()
      if (!orderRes.ok) {
        toast.error(data.error ?? 'Payment setup failed')
        return
      }

      // Free booking — confirmed directly
      if (data.free) {
        setConfirmedBreakdown(data.breakdown ?? null)
        setConfirmedRef(data.bookingRef)
        setStep('done')
        return
      }

      setOrderData(data)
      setStep('summary')
    } finally {
      setCreatingOrder(false)
    }
  }

  // Step: student confirmed the summary, open Razorpay
  const handlePayNow = async () => {
    if (!orderData) return
    setPaying(true)

    try {
      // Load Razorpay script if needed
      await new Promise<void>((resolve, reject) => {
        if ((window as unknown as Record<string, unknown>).Razorpay) { resolve(); return }
        const script = document.createElement('script')
        script.src = 'https://checkout.razorpay.com/v1/checkout.js'
        script.onload = () => resolve()
        script.onerror = () => reject(new Error('Failed to load Razorpay'))
        document.body.appendChild(script)
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rzp = new (window as any).Razorpay({
        key: orderData.key,
        amount: orderData.amount,       // paise — total the student pays
        currency: orderData.currency,
        name: 'StudyLib',
        description: `Seat ${selectedSeat?.label} — ${library?.name}`,
        order_id: orderData.orderId,
        config: {
          display: {
            blocks: {
              banks: {
                name: 'All payment methods',
                instruments: [
                  { method: 'upi' },
                  { method: 'card' },
                  { method: 'netbanking' },
                  { method: 'wallet' },
                ],
              },
            },
            sequence: ['block.banks'],
            preferences: { show_default_blocks: true },
          },
        },
        handler: async (response: {
          razorpay_payment_id: string
          razorpay_order_id: string
          razorpay_signature: string
        }) => {
          // Backend verifies signature + confirms booking + activates membership
          const payRes = await fetch(`/api/student/bookings/${orderData.bookingId}/pay`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            }),
          })
          const payData = await payRes.json()
          if (!payRes.ok) {
            toast.error(payData.error ?? 'Payment verification failed')
            setPaying(false)
            return
          }
          setConfirmedBreakdown(payData.breakdown ?? orderData.breakdown)
          setConfirmedRef(orderData.bookingRef)
          setPaying(false)
          setStep('done')
        },
        modal: {
          ondismiss: () => {
            toast('Payment cancelled. Your seat reservation has been released.')
            setPaying(false)
          },
        },
        theme: { color: '#6366f1' },
      })
      rzp.open()
    } catch (err) {
      console.error(err)
      toast.error('Something went wrong. Please try again.')
      setPaying(false)
    }
  }

  // ── Done screen ───────────────────────────────────────────────────────────
  if (step === 'done') {
    const bd = confirmedBreakdown
    return (
      <div className="min-h-screen bg-indigo-600 flex flex-col items-center justify-center p-6 text-white text-center">
        <div className="rounded-full bg-white/20 p-6 mb-6">
          <CheckCircle className="h-12 w-12" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Booking Confirmed!</h1>
        <p className="text-indigo-200 mb-6">{library?.name}</p>
        <div className="w-full max-w-xs bg-white/10 rounded-2xl p-6 space-y-3 text-left">
          {[
            { label: 'Seat', value: selectedSeat?.label ?? '' },
            { label: 'Date', value: formatDate(selectedDate) },
            { label: 'Time', value: `${startTime} → ${endTime}` },
            { label: 'Booking ID', value: confirmedRef.slice(-8).toUpperCase() },
          ].map(r => (
            <div key={r.label} className="flex justify-between text-sm">
              <span className="text-indigo-200">{r.label}</span>
              <span className="font-semibold">{r.value}</span>
            </div>
          ))}
          {bd && (
            <>
              <div className="border-t border-white/20 pt-3 mt-3 space-y-1.5">
                {[
                  { label: 'Seat Booking', value: fmt(bd.baseAmount) },
                  { label: 'Platform Fee (5%)', value: fmt(bd.platformFee) },
                  ...(bd.processingFee > 0 ? [{ label: 'Processing Fee', value: fmt(bd.processingFee) }] : []),
                  ...(bd.gstAmount > 0 ? [{ label: 'GST on Fee', value: fmt(bd.gstAmount) }] : []),
                ].map(r => (
                  <div key={r.label} className="flex justify-between text-sm">
                    <span className="text-indigo-300">{r.label}</span>
                    <span>{r.value}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-sm font-bold pt-2 border-t border-white/20">
                <span>Total Paid</span>
                <span>{fmt(bd.totalAmount)}</span>
              </div>
            </>
          )}
        </div>
        <Button
          onClick={() => router.push('/student/bookings')}
          className="mt-8 bg-white text-indigo-600 hover:bg-indigo-50 w-full max-w-xs"
          size="lg"
        >
          View My Bookings
        </Button>
        <button onClick={() => router.push('/student')} className="mt-3 text-indigo-200 text-sm underline">
          Back to Dashboard
        </button>
      </div>
    )
  }

  // ── Payment Summary screen ────────────────────────────────────────────────
  if (step === 'summary' && orderData && selectedSeat) {
    const bd = orderData.breakdown
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="bg-white border-b border-slate-100 px-4 py-3 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button onClick={() => { setOrderData(null); setStep('seat') }} className="p-1.5 rounded-lg hover:bg-slate-100">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="font-bold text-slate-900 text-sm">Payment Summary</h1>
              <p className="text-xs text-slate-500">{library?.name}</p>
            </div>
            <div className="ml-auto flex gap-1">
              {['datetime', 'seat', 'summary'].map((s, i) => (
                <div key={s} className={`h-1.5 w-6 rounded-full transition-colors ${
                  step === s ? 'bg-indigo-600' : i < 2 ? 'bg-indigo-300' : 'bg-slate-200'
                }`} />
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4 max-w-md mx-auto">
          {/* Booking details */}
          <div className="rounded-2xl bg-white border border-slate-100 p-5 space-y-3">
            <h2 className="font-bold text-slate-900 mb-2">Booking Details</h2>
            {[
              { label: 'Library', value: library?.name ?? '' },
              { label: 'Seat', value: `${selectedSeat.label} (${selectedSeat.seatType})` },
              { label: 'Date', value: formatDate(selectedDate) },
              { label: 'Time', value: `${startTime} → ${endTime}` },
            ].map(r => (
              <div key={r.label} className="flex justify-between text-sm border-b border-slate-50 pb-2 last:border-0">
                <span className="text-slate-500">{r.label}</span>
                <span className="font-semibold text-slate-900">{r.value}</span>
              </div>
            ))}
          </div>

          {/* Payment breakdown */}
          <div className="rounded-2xl bg-white border border-slate-100 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Receipt className="h-4 w-4 text-indigo-500" />
              <h2 className="font-bold text-slate-900">Payment Breakdown</h2>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Seat Booking</span>
                <span className="font-medium text-slate-900">{fmt(bd.baseAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Platform / Service Fee (5%)</span>
                <span className="font-medium text-slate-900">{fmt(bd.platformFee)}</span>
              </div>
              {bd.processingFee > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Payment Processing Fee</span>
                  <span className="font-medium text-slate-900">{fmt(bd.processingFee)}</span>
                </div>
              )}
              {bd.gstAmount > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-500">GST on Processing Fee (18%)</span>
                  <span className="font-medium text-slate-900">{fmt(bd.gstAmount)}</span>
                </div>
              )}
              <div className="flex justify-between pt-3 border-t border-slate-100 font-bold text-base">
                <span className="text-slate-900">Total Payable</span>
                <span className="text-indigo-600">{fmt(bd.totalAmount)}</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600 flex items-center gap-2">
            <CreditCard className="h-4 w-4 shrink-0 text-indigo-500" />
            Payment is processed securely via Razorpay. UPI, cards, and net banking accepted.
          </div>

          <Button className="w-full" size="lg" loading={paying} onClick={handlePayNow}>
            <CreditCard className="h-4 w-4" /> Pay {fmt(bd.totalAmount)}
          </Button>
          <Button variant="outline" className="w-full" size="lg"
            onClick={() => { setOrderData(null); setStep('seat') }}>
            ← Change Seat
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => step === 'seat' ? setStep('datetime') : router.back()}
            className="p-1.5 rounded-lg hover:bg-slate-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="font-bold text-slate-900 text-sm">
              {step === 'datetime' ? 'Select Date & Time' : 'Choose a Seat'}
            </h1>
            <p className="text-xs text-slate-500">{library?.name}</p>
          </div>
          <div className="ml-auto flex gap-1">
            {['datetime', 'seat', 'summary'].map((s, i) => (
              <div key={s} className={`h-1.5 w-6 rounded-full transition-colors ${
                step === s ? 'bg-indigo-600'
                  : i < ['datetime', 'seat'].indexOf(step) ? 'bg-indigo-300'
                  : 'bg-slate-200'
              }`} />
            ))}
          </div>
        </div>
      </div>

      {/* ── Step 1: Date & Time ─────────────────────────────────────────────── */}
      {step === 'datetime' && (
        <div className="p-4 space-y-4">
          <div className="rounded-2xl bg-white border border-slate-100 p-4 space-y-4">
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                <Calendar className="h-4 w-4 text-indigo-500" /> Date
              </label>
              <input
                type="date"
                value={selectedDate}
                min={format(new Date(), 'yyyy-MM-dd')}
                onChange={e => setSelectedDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                  <Clock className="h-4 w-4 text-indigo-500" /> Start Time
                </label>
                <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium" />
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                  <Clock className="h-4 w-4 text-indigo-500" /> End Time
                </label>
                <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium" />
              </div>
            </div>
          </div>
          <Button className="w-full" size="lg" loading={loadingSeats}
            onClick={() => { if (validateTime()) fetchSeats() }}>
            Check Available Seats →
          </Button>
        </div>
      )}

      {/* ── Step 2: Seat Selection ──────────────────────────────────────────── */}
      {step === 'seat' && (
        <div className="p-4 space-y-4">
          {/* Time summary */}
          <div className="rounded-2xl bg-indigo-50 border border-indigo-100 p-3 flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-indigo-500 shrink-0" />
            <span className="font-medium text-indigo-800">{formatDate(selectedDate)}</span>
            <span className="text-indigo-400">·</span>
            <Clock className="h-4 w-4 text-indigo-500 shrink-0" />
            <span className="text-indigo-700">{startTime} – {endTime}</span>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 flex-wrap text-xs">
            {Object.entries({ Available: COLORS.available, Booked: COLORS.booked, Maintenance: COLORS.maintenance, Selected: COLORS.selected }).map(([label, color]) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm" style={{ background: color }} />
                <span className="text-slate-500">{label}</span>
              </div>
            ))}
          </div>

          {/* Canvas */}
          <div className="overflow-auto rounded-2xl border border-slate-200 bg-slate-50">
            <div className="relative" style={{ width: layoutSize.w, height: layoutSize.h, minWidth: 300 }}>
              <svg className="absolute inset-0 pointer-events-none" width="100%" height="100%">
                <defs>
                  <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
                    <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#e2e8f0" strokeWidth="0.5" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
              </svg>

              {layoutObjects.map(obj => (
                <div key={obj.id}
                  className="absolute flex items-center justify-center text-[10px] text-slate-600 rounded-lg"
                  style={{ left: obj.x, top: obj.y, width: obj.width, height: obj.height, background: obj.color ?? '#e2e8f0' }}>
                  {obj.label ?? obj.objectType}
                </div>
              ))}

              {seats.map(seat => {
                const available = seat.isAvailableForSlot && seat.status !== 'MAINTENANCE' && seat.status !== 'DISABLED'
                const isSelected = selectedSeat?.id === seat.id
                const bg = isSelected ? COLORS.selected : available ? COLORS.available : COLORS.booked
                return (
                  <div key={seat.id}
                    onClick={() => { if (available) setSelectedSeat(seat) }}
                    className={`absolute flex flex-col items-center justify-center rounded-xl text-white text-[11px] font-bold transition-all
                      ${available ? 'cursor-pointer hover:scale-110 hover:shadow-lg' : 'cursor-not-allowed opacity-70'}
                      ${isSelected ? 'ring-2 ring-white ring-offset-1 scale-110 shadow-lg' : ''}`}
                    style={{ left: seat.x, top: seat.y, width: seat.width, height: seat.height, background: bg }}>
                    <span className="leading-none">{seat.label}</span>
                    <span className="text-[9px] opacity-80 mt-0.5">{seat.seatType?.charAt(0)}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {seats.length === 0 && (
            <p className="text-center text-slate-400 py-8 text-sm">No seats configured for this library yet</p>
          )}

          {selectedSeat && (
            <div className="rounded-2xl bg-indigo-600 text-white p-4 flex items-center justify-between">
              <div>
                <p className="font-bold">Seat {selectedSeat.label}</p>
                <p className="text-indigo-200 text-sm capitalize">{selectedSeat.seatType.toLowerCase()}</p>
              </div>
              <Button
                onClick={handleProceedToSummary}
                loading={creatingOrder}
                className="bg-white text-indigo-600 hover:bg-indigo-50"
                size="sm"
              >
                View Payment Summary →
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
