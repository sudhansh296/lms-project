'use client'

import { useState, useEffect, use } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Clock, Calendar, CheckCircle, CreditCard, Receipt, Info } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatDate } from '@/lib/utils'
import { format, addMonths, addDays, addWeeks, addYears } from 'date-fns'
import { Suspense } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Plan {
  id: string
  name: string
  description?: string
  pricingModel?: string
  dailyMinutes: number
  monthlyPrice?: number
  durationValue: number
  durationUnit: string
  price: number
  timeSelectionMode: string
  fixedStartTime?: string | null
  fixedEndTime?: string | null
  allowedDays: number[]
  benefits: string[]
  isActive?: boolean
}

interface Seat {
  id: string; label: string; seatType: string; status: string
  x: number; y: number; width: number; height: number
  extraPrice?: number; isAvailableForSlot: boolean
}

interface LayoutObj {
  id: string; objectType: string; label?: string
  x: number; y: number; width: number; height: number; color?: string
}

interface Library {
  id: string; name: string; minBookingMins: number; maxBookingMins: number
  is24Hours: boolean
  membershipPlans: Plan[]
  hours: Array<{ dayOfWeek: number; isOpen: boolean; openTime?: string; closeTime?: string }>
}

interface PaymentBreakdown {
  planPrice: number
  months?: number
  monthlyPrice?: number
  seatExtraAmount: number
  baseAmount: number
  platformFee: number
  processingFee: number
  gstAmount: number
  totalAmount: number
  ownerAmount: number
  libraryBaseAmount?: number
  platformCommission?: number
  gatewayFee?: number
  gatewayFeeGst?: number
  studentTotal?: number
}

interface OrderData {
  orderId: string
  amount: number
  currency: string
  key: string
  bookingId: string
  bookingRef: string
  breakdown: PaymentBreakdown
  plan: {
    name: string
    dailyMinutes: number
    startDate: string
    endDate: string
    dailyStartTime: string
    dailyEndTime: string
    durationValue: number
    durationUnit: string
  }
}

const COLORS = { available: '#22c55e', booked: '#f59e0b', maintenance: '#94a3b8', selected: '#6366f1' }
const DAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const UNIT_LABELS: Record<string,string> = { DAY:'Day', WEEK:'Week', MONTH:'Month', YEAR:'Year' }

function fmt(n: number) { return `₹${n.toFixed(2)}` }

function formatDailyMins(mins: number) {
  if (mins < 60) return `${mins} min/day`
  const h = Math.floor(mins / 60), m = mins % 60
  return m > 0 ? `${h}h ${m}m/day` : `${h} hr${h>1?'s':''}/day`
}

function formatDuration(value: number, unit: string) {
  const labels: Record<string, string> = { DAY: 'day', WEEK: 'week', MONTH: 'month', YEAR: 'year' }
  const label = labels[unit] || unit.toLowerCase()
  return `${value} ${label}${value > 1 ? 's' : ''}`
}

function calcEndDate(start: Date, val: number, unit: string): Date {
  switch (unit) {
    case 'DAY':   return addDays(start, val)
    case 'WEEK':  return addWeeks(start, val)
    case 'MONTH': return addMonths(start, val)
    case 'YEAR':  return addYears(start, val)
    default:      return addMonths(start, val)
  }
}

function calcEndTimeHHMM(start: string, mins: number): string {
  const [h, m] = start.split(':').map(Number)
  const total = h * 60 + m + mins
  return `${String(Math.floor(total/60)%24).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`
}

// ─── Inner page ───────────────────────────────────────────────────────────────

function BookSeatPageInner({ libraryId }: { libraryId: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedPlanId = searchParams.get('plan') ?? ''

  const [step, setStep] = useState<'plan'|'months'|'datetime'|'seat'|'summary'|'done'>('plan')
  const [library, setLibrary] = useState<Library | null>(null)
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
  const [selectedMonths, setSelectedMonths] = useState(1)

  // Step 2/3
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [dailyStartTime, setDailyStartTime] = useState('09:00')

  // Step 3 — seat
  const [seats, setSeats] = useState<Seat[]>([])
  const [layoutObjects, setLayoutObjects] = useState<LayoutObj[]>([])
  const [layoutSize, setLayoutSize] = useState({ w: 900, h: 600 })
  const [selectedSeat, setSelectedSeat] = useState<Seat | null>(null)
  const [loadingSeats, setLoadingSeats] = useState(false)

  // Order / payment
  const [orderData, setOrderData] = useState<OrderData | null>(null)
  const [creatingOrder, setCreatingOrder] = useState(false)
  const [paying, setPaying] = useState(false)

  // Done
  const [confirmedRef, setConfirmedRef] = useState('')
  const [confirmedBreakdown, setConfirmedBreakdown] = useState<PaymentBreakdown | null>(null)
  const [confirmedPlan, setConfirmedPlan] = useState<OrderData['plan'] | null>(null)

  useEffect(() => {
    fetch(`/api/libraries/${libraryId}`)
      .then(r => r.json())
      .then(d => {
        setLibrary(d.library)
        // Auto-select if plan passed via URL
        if (preselectedPlanId && d.library?.membershipPlans) {
          const p = d.library.membershipPlans.find((x: Plan) => x.id === preselectedPlanId)
          if (p) { 
            setSelectedPlan(p)
            // Go to months step if MONTHLY_RATE, otherwise datetime
            setStep(p.pricingModel === 'MONTHLY_RATE' ? 'months' : 'datetime')
          }
        }
      })
  }, [libraryId, preselectedPlanId])

  // Derived values for selected plan
  const isMonthlyRate = selectedPlan?.pricingModel === 'MONTHLY_RATE'
  const effectiveDurationValue = isMonthlyRate ? selectedMonths : (selectedPlan?.durationValue ?? 1)
  const effectiveDurationUnit = isMonthlyRate ? 'MONTH' : (selectedPlan?.durationUnit ?? 'MONTH')
  
  const resolvedDailyStart = selectedPlan?.timeSelectionMode === 'FIXED' && selectedPlan.fixedStartTime
    ? selectedPlan.fixedStartTime
    : dailyStartTime
  const resolvedDailyEnd = selectedPlan
    ? calcEndTimeHHMM(resolvedDailyStart, selectedPlan.dailyMinutes)
    : ''

  const endDate = selectedPlan
    ? calcEndDate(new Date(startDate), effectiveDurationValue, effectiveDurationUnit)
    : null
    
  // Calculate display price for monthly rate plans
  const displayMonthlyPrice = isMonthlyRate 
    ? (selectedPlan?.monthlyPrice ?? selectedPlan?.price ?? 0)
    : 0
  const displayTotalPrice = isMonthlyRate
    ? displayMonthlyPrice * selectedMonths
    : (selectedPlan?.price ?? 0)

  // ── Fetch available seats for the plan's daily slot ─────────────────────────
  const fetchSeats = async () => {
    if (!selectedPlan) return
    setLoadingSeats(true); setSelectedSeat(null)
    
    // FIX 7: Check availability for the FULL PERIOD, not just first occurrence
    // Calculate the actual first and last occurrence time
    const firstOccurrenceStart = new Date(`${startDate}T${resolvedDailyStart}:00`)
    const firstOccurrenceEnd = new Date(firstOccurrenceStart.getTime() + selectedPlan.dailyMinutes * 60000)
    
    // Calculate the last occurrence (same daily time but on the last date)
    const lastDate = endDate ? format(addDays(endDate, -1), 'yyyy-MM-dd') : startDate
    const lastOccurrenceStart = new Date(`${lastDate}T${resolvedDailyStart}:00`)
    const lastOccurrenceEnd = new Date(lastOccurrenceStart.getTime() + selectedPlan.dailyMinutes * 60000)
    
    const q = new URLSearchParams({
      date: startDate,
      startTime: firstOccurrenceStart.toISOString(),
      endTime: lastOccurrenceEnd.toISOString(), // Now checking FULL period
    })
    const res = await fetch(`/api/libraries/${libraryId}/seats?${q}`)
    const data = await res.json()
    setSeats(data.seats ?? [])
    if (data.layout) { setLayoutObjects(data.layout.objects ?? []); setLayoutSize({ w: data.layout.canvasWidth, h: data.layout.canvasHeight }) }
    setLoadingSeats(false)
    setStep('seat')
  }

  // ── Create order ─────────────────────────────────────────────────────────────
  const handleProceedToSummary = async () => {
    if (!selectedSeat || !selectedPlan) return
    setCreatingOrder(true)
    try {
      const body: Record<string, unknown> = {
        libraryId, planId: selectedPlan.id, seatId: selectedSeat.id, startDate,
      }
      
      // For MONTHLY_RATE plans, send months parameter
      if (isMonthlyRate) {
        body.months = selectedMonths
      }
      
      if (selectedPlan.timeSelectionMode === 'FLEXIBLE') {
        body.dailyStartTime = dailyStartTime
      }

      const res = await fetch('/api/payments/seat-order', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error === 'OWNER_SETTLEMENT_NOT_ACTIVE'
          ? 'Online payments are not available for this library yet.'
          : data.error ?? 'Payment setup failed')
        return
      }
      if (data.free) {
        setConfirmedBreakdown(data.breakdown ?? null)
        setConfirmedPlan(data.plan ?? null)
        setConfirmedRef(data.bookingRef)
        setStep('done'); return
      }
      setOrderData(data); setStep('summary')
    } finally { setCreatingOrder(false) }
  }

  // ── Open Razorpay ────────────────────────────────────────────────────────────
  const handlePayNow = async () => {
    if (!orderData) return
    setPaying(true)
    try {
      await new Promise<void>((resolve, reject) => {
        if ((window as unknown as Record<string,unknown>).Razorpay) { resolve(); return }
        const s = document.createElement('script')
        s.src = 'https://checkout.razorpay.com/v1/checkout.js'
        s.onload = () => resolve(); s.onerror = () => reject(new Error('Failed to load Razorpay'))
        document.body.appendChild(s)
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rzp = new (window as any).Razorpay({
        key: orderData.key, amount: orderData.amount, currency: orderData.currency,
        name: 'StudyLib',
        description: `${orderData.plan.name} — ${library?.name}`,
        order_id: orderData.orderId,
        handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
          const payRes = await fetch(`/api/student/bookings/${orderData.bookingId}/pay`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ razorpayOrderId: response.razorpay_order_id, razorpayPaymentId: response.razorpay_payment_id, razorpaySignature: response.razorpay_signature }),
          })
          const payData = await payRes.json()
          if (!payRes.ok) { toast.error(payData.error ?? 'Payment verification failed'); setPaying(false); return }
          setConfirmedBreakdown(payData.breakdown ?? orderData.breakdown)
          setConfirmedPlan(orderData.plan)
          setConfirmedRef(orderData.bookingRef)
          setPaying(false); setStep('done')
        },
        modal: { ondismiss: async () => {
          try { await fetch(`/api/student/bookings/${orderData.bookingId}/cancel-pending`, { method: 'POST' }) } catch { /* noop */ }
          toast('Payment cancelled. Seat hold released.')
          setPaying(false)
        }},
        theme: { color: '#6366f1' },
      })
      rzp.open()
    } catch (err) { console.error(err); toast.error('Something went wrong.'); setPaying(false) }
  }

  // ── Done screen ───────────────────────────────────────────────────────────────
  if (step === 'done') {
    const bd = confirmedBreakdown
    const cp = confirmedPlan
    return (
      <div className="min-h-screen bg-indigo-600 flex flex-col items-center justify-center p-6 text-white text-center">
        <div className="rounded-full bg-white/20 p-6 mb-6"><CheckCircle className="h-12 w-12" /></div>
        <h1 className="text-2xl font-bold mb-2">Booking Confirmed!</h1>
        <p className="text-indigo-200 mb-6">{library?.name}</p>
        <div className="w-full max-w-sm bg-white/10 rounded-2xl p-6 space-y-3 text-left">
          {[
            { label: 'Seat', value: selectedSeat?.label ?? '' },
            { label: 'Plan', value: cp?.name ?? '' },
            { label: 'Daily', value: cp ? `${cp.dailyStartTime} → ${cp.dailyEndTime} (${formatDailyMins(cp.dailyMinutes)})` : '' },
            { label: 'Start', value: cp ? formatDate(cp.startDate) : '' },
            { label: 'Expiry', value: cp ? formatDate(cp.endDate) : '' },
            { label: 'Booking ID', value: confirmedRef.slice(-8).toUpperCase() },
          ].map(r => (
            <div key={r.label} className="flex justify-between text-sm">
              <span className="text-indigo-300">{r.label}</span>
              <span className="font-semibold">{r.value}</span>
            </div>
          ))}
          {bd && (
            <div className="border-t border-white/20 pt-3 space-y-1.5">
              {bd.monthlyPrice && bd.months ? [
                ['Monthly Rate', fmt(bd.monthlyPrice)],
                ['Duration', `${bd.months} month${bd.months > 1 ? 's' : ''}`],
                ['Plan Amount', fmt(bd.monthlyPrice * bd.months)],
                ...(bd.seatExtraAmount > 0 ? [['Seat Extra', fmt(bd.seatExtraAmount)]] : []),
                ...(bd.gatewayFee && bd.gatewayFee > 0 ? [['Gateway Fee', fmt((bd.gatewayFee ?? 0) + (bd.gatewayFeeGst ?? 0))]] : []),
                ['Total Paid', fmt(bd.studentTotal ?? bd.totalAmount)],
              ].map(([l,v]) => (
                <div key={l} className={`flex justify-between text-sm ${l==='Total Paid'?'font-bold border-t border-white/20 pt-2':''}`}>
                  <span className="text-indigo-300">{l}</span><span>{v}</span>
                </div>
              )) : [
                ['Plan Price', fmt(bd.planPrice ?? bd.baseAmount)],
                ...(bd.seatExtraAmount > 0 ? [['Seat Extra', fmt(bd.seatExtraAmount)]] : []),
                ['Platform Fee (5%)', fmt(bd.platformFee ?? 0)],
                ['Total Paid', fmt(bd.totalAmount)],
              ].map(([l,v]) => (
                <div key={l} className={`flex justify-between text-sm ${l==='Total Paid'?'font-bold border-t border-white/20 pt-2':''}`}>
                  <span className="text-indigo-300">{l}</span><span>{v}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <Button onClick={() => router.push('/student/bookings')} className="mt-8 bg-white text-indigo-600 hover:bg-indigo-50 w-full max-w-sm" size="lg">
          View My Bookings
        </Button>
        <button onClick={() => router.push('/student')} className="mt-3 text-indigo-200 text-sm underline">Back to Dashboard</button>
      </div>
    )
  }

  // ── Payment Summary ───────────────────────────────────────────────────────────
  if (step === 'summary' && orderData && selectedSeat) {
    const bd = orderData.breakdown
    const cp = orderData.plan
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="bg-white border-b border-slate-100 px-4 py-3 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button onClick={() => { setOrderData(null); setStep('seat') }} className="p-1.5 rounded-lg hover:bg-slate-100"><ArrowLeft className="h-5 w-5" /></button>
            <div><h1 className="font-bold text-slate-900 text-sm">Payment Summary</h1><p className="text-xs text-slate-500">{library?.name}</p></div>
          </div>
        </div>
        <div className="p-4 space-y-4 max-w-md mx-auto">
          {/* Plan + booking details */}
          <div className="rounded-2xl bg-white border border-slate-100 p-5 space-y-3">
            <h2 className="font-bold text-slate-900 mb-2">Booking Details</h2>
            {[
              { label: 'Library', value: library?.name ?? '' },
              { label: 'Seat', value: `${selectedSeat.label} (${selectedSeat.seatType})` },
              { label: 'Plan', value: cp.name },
              { label: 'Daily Time', value: `${cp.dailyStartTime} – ${cp.dailyEndTime} (${formatDailyMins(cp.dailyMinutes)})` },
              { label: 'Period', value: `${formatDate(cp.startDate)} → ${formatDate(cp.endDate)}` },
              { label: 'Duration', value: `${cp.durationValue} ${UNIT_LABELS[cp.durationUnit]}(s)` },
            ].map(r => (
              <div key={r.label} className="flex justify-between text-sm border-b border-slate-50 pb-2 last:border-0">
                <span className="text-slate-500">{r.label}</span>
                <span className="font-semibold text-slate-900 text-right max-w-[60%]">{r.value}</span>
              </div>
            ))}
          </div>

          {/* Payment breakdown */}
          <div className="rounded-2xl bg-white border border-slate-100 p-5">
            <div className="flex items-center gap-2 mb-4"><Receipt className="h-4 w-4 text-indigo-500" /><h2 className="font-bold text-slate-900">Payment Breakdown</h2></div>
            <div className="space-y-3 text-sm">
              {/* Show monthly pricing details if available */}
              {bd.monthlyPrice && bd.months ? (
                <>
                  <div className="flex justify-between"><span className="text-slate-500">Monthly Rate</span><span className="font-medium">{fmt(bd.monthlyPrice)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Duration</span><span className="font-medium">{bd.months} month{bd.months > 1 ? 's' : ''}</span></div>
                  <div className="flex justify-between border-t border-slate-50 pt-2"><span className="text-slate-500">Plan Amount ({cp.name})</span><span className="font-medium">{fmt(bd.monthlyPrice * bd.months)}</span></div>
                </>
              ) : (
                <div className="flex justify-between"><span className="text-slate-500">Plan Price ({cp.name})</span><span className="font-medium">{fmt(bd.planPrice ?? bd.baseAmount)}</span></div>
              )}
              
              {bd.seatExtraAmount > 0 && <div className="flex justify-between"><span className="text-slate-500">Seat Extra</span><span className="font-medium">{fmt(bd.seatExtraAmount)}</span></div>}
              
              {/* Show new breakdown format if available */}
              {bd.libraryBaseAmount !== undefined ? (
                <>
                  <div className="flex justify-between border-t border-slate-50 pt-2"><span className="text-slate-500">Library Base Amount</span><span className="font-medium">{fmt(bd.libraryBaseAmount)}</span></div>
                  {bd.gatewayFee && bd.gatewayFee > 0 && (
                    <div className="flex justify-between"><span className="text-slate-500">Platform Fee (incl. GST)</span><span className="font-medium">{fmt((bd.gatewayFee ?? 0) + (bd.gatewayFeeGst ?? 0))}</span></div>
                  )}
                </>
              ) : (
                <>
                  {/* FIX 18: Don't show platformCommission (5%) to students - that's between platform and owner */}
                  <div className="flex justify-between border-t border-slate-50 pt-2"><span className="text-slate-500">Library Amount</span><span className="font-medium">{fmt(bd.baseAmount)}</span></div>
                  {bd.gatewayFee && bd.gatewayFee > 0 && (
                    <div className="flex justify-between"><span className="text-slate-500">Platform Fee (incl. GST)</span><span className="font-medium">{fmt((bd.gatewayFee ?? 0) + (bd.gatewayFeeGst ?? 0))}</span></div>
                  )}
                  {bd.processingFee && bd.processingFee > 0 && !bd.gatewayFee && <div className="flex justify-between"><span className="text-slate-500">Processing Fee</span><span className="font-medium">{fmt(bd.processingFee)}</span></div>}
                </>
              )}
              
              <div className="flex justify-between pt-3 border-t border-slate-100 font-bold text-base">
                <span className="text-slate-900">Total Payable</span>
                <span className="text-indigo-600">{fmt(bd.studentTotal ?? bd.totalAmount)}</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600 flex items-center gap-2">
            <CreditCard className="h-4 w-4 shrink-0 text-indigo-500" />
            Payment processed securely via Razorpay. UPI, cards, netbanking accepted.
          </div>
          <Button className="w-full" size="lg" loading={paying} onClick={handlePayNow}>
            <CreditCard className="h-4 w-4" /> Pay {fmt(bd.studentTotal ?? bd.totalAmount)}
          </Button>
          <Button variant="outline" className="w-full" size="lg" onClick={() => { setOrderData(null); setStep('seat') }}>← Change Seat</Button>
        </div>
      </div>
    )
  }

  // ── Steps header ──────────────────────────────────────────────────────────────
  const steps = ['plan','months','datetime','seat','summary','done'] as const
  const stepIdx = steps.indexOf(step)

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-100 px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => {
            if (step === 'datetime') {
              setStep(isMonthlyRate ? 'months' : 'plan')
            } else if (step === 'months') {
              setStep('plan')
            } else if (step === 'seat') {
              setStep('datetime')
            } else {
              router.back()
            }
          }} className="p-1.5 rounded-lg hover:bg-slate-100"><ArrowLeft className="h-5 w-5" /></button>
          <div>
            <h1 className="font-bold text-slate-900 text-sm">
              {step==='plan'?'Choose Study Plan':step==='months'?'Choose Duration':step==='datetime'?'Set Start Date & Time':'Choose a Seat'}
            </h1>
            <p className="text-xs text-slate-500">{library?.name}</p>
          </div>
          <div className="ml-auto flex gap-1">
            {steps.map((s, i) => (
              <div key={s} className={`h-1.5 w-6 rounded-full ${i <= stepIdx ? 'bg-indigo-600' : 'bg-slate-200'}`} />
            ))}
          </div>
        </div>
      </div>

      {/* ── Step 1: Plan Selection ─────────────────────────────────────────── */}
      {step === 'plan' && (
        <div className="p-4 space-y-3 max-w-lg mx-auto">
          {(!library?.membershipPlans || library.membershipPlans.length === 0) && (
            <div className="rounded-2xl bg-amber-50 border border-amber-200 p-5 text-center">
              <Info className="h-6 w-6 text-amber-500 mx-auto mb-2" />
              <p className="font-semibold text-amber-800 text-sm">No pricing plans available</p>
              <p className="text-xs text-amber-700 mt-1">The library owner hasn&apos;t set up any study plans yet.</p>
            </div>
          )}
          
          {library?.membershipPlans.filter(p => p.isActive !== false).map(plan => {
            const isPlanMonthlyRate = plan.pricingModel === 'MONTHLY_RATE'
            const planDisplayPrice = isPlanMonthlyRate ? (plan.monthlyPrice ?? plan.price) : plan.price
            
            return (
            <div key={plan.id}
              onClick={() => { 
                setSelectedPlan(plan)
                setStep(isPlanMonthlyRate ? 'months' : 'datetime')
              }}
              className="rounded-2xl bg-white border-2 border-slate-100 hover:border-indigo-400 p-5 cursor-pointer transition-all hover:shadow-md active:scale-[0.99]">
              
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="font-bold text-slate-900">{plan.name}</p>
                  {plan.description && <p className="text-xs text-slate-500 mt-0.5">{plan.description}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-2xl font-bold text-indigo-600">₹{planDisplayPrice.toFixed(0)}</p>
                  <p className="text-xs text-slate-500">{isPlanMonthlyRate ? '/ month' : `for ${plan.durationValue} ${plan.durationUnit.toLowerCase()}(s)`}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 text-xs mb-3">
                <span className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded-full flex items-center gap-1 font-medium">
                  <Clock className="h-3 w-3" /> {formatDailyMins(plan.dailyMinutes)}
                </span>
                {isPlanMonthlyRate ? (
                  <span className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full flex items-center gap-1 font-medium">
                    <Calendar className="h-3 w-3" /> You choose duration
                  </span>
                ) : (
                  <span className="bg-violet-50 text-violet-700 px-2 py-1 rounded-full flex items-center gap-1 font-medium">
                    <Calendar className="h-3 w-3" /> {formatDuration(plan.durationValue, plan.durationUnit)}
                  </span>
                )}
                <span className={`px-2 py-1 rounded-full font-medium ${
                  plan.timeSelectionMode==='FIXED'
                    ?'bg-amber-50 text-amber-700'
                    :'bg-emerald-50 text-emerald-700'
                }`}>
                  {plan.timeSelectionMode==='FIXED'
                    ?`Fixed: ${plan.fixedStartTime}–${plan.fixedEndTime}`
                    :'Flexible time'
                  }
                </span>
              </div>
              
              {/* Allowed days */}
              <div className="flex gap-1 mb-3">
                {DAYS_SHORT.map((d, i) => (
                  <span key={i} className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                    plan.allowedDays.includes(i)
                      ?'bg-slate-700 text-white'
                      :'bg-slate-100 text-slate-400'
                  }`}>{d}</span>
                ))}
              </div>

              {/* Benefits preview */}
              {plan.benefits.length > 0 && (
                <div className="space-y-1 mb-3">
                  {plan.benefits.slice(0,2).map((b, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs text-slate-600">
                      <CheckCircle className="h-3 w-3 text-emerald-500 shrink-0" /> {b}
                    </div>
                  ))}
                  {plan.benefits.length > 2 && (
                    <p className="text-xs text-slate-400 pl-4">+{plan.benefits.length - 2} more benefits</p>
                  )}
                </div>
              )}

              <div className="mt-3 text-right">
                <span className="text-sm text-indigo-600 font-semibold">
                  {isPlanMonthlyRate ? 'Choose This Rate →' : 'Select Plan →'}
                </span>
              </div>
            </div>
          )})}
        </div>
      )}

      {/* ── Step 2: Months Selection (MONTHLY_RATE only) ──────────────────────── */}
      {step === 'months' && selectedPlan && isMonthlyRate && (
        <div className="p-4 space-y-4 max-w-md mx-auto">
          {/* Selected plan summary */}
          <div className="rounded-2xl bg-indigo-50 border border-indigo-100 p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="font-bold text-indigo-900">{selectedPlan.name}</p>
                <p className="text-sm text-indigo-700">₹{displayMonthlyPrice.toFixed(0)} per month</p>
              </div>
              <button onClick={() => setStep('plan')} className="text-sm text-indigo-600 underline font-medium">Change</button>
            </div>
            <div className="flex gap-2 text-xs">
              <span className="bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full font-medium">
                {formatDailyMins(selectedPlan.dailyMinutes)}
              </span>
            </div>
          </div>

          {/* Duration selector */}
          <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-4">
            <div>
              <h3 className="font-bold text-slate-900 mb-1">Choose Duration</h3>
              <p className="text-xs text-slate-500">Select how many months you want to book</p>
            </div>

            {/* Months slider */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Duration:</span>
                <span className="text-2xl font-bold text-indigo-600">{selectedMonths} month{selectedMonths > 1 ? 's' : ''}</span>
              </div>
              
              <input
                type="range"
                min="1"
                max="24"
                value={selectedMonths}
                onChange={(e) => setSelectedMonths(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
              
              <div className="flex justify-between text-xs text-slate-400">
                <span>1 month</span>
                <span>24 months</span>
              </div>
            </div>

            {/* Quick select buttons */}
            <div className="grid grid-cols-4 gap-2">
              {[1, 3, 6, 12].map(m => (
                <button
                  key={m}
                  onClick={() => setSelectedMonths(m)}
                  className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                    selectedMonths === m
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {m}M
                </button>
              ))}
            </div>

            {/* Price preview */}
            <div className="rounded-lg bg-slate-50 border border-slate-100 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Monthly rate</span>
                <span className="font-medium">₹{displayMonthlyPrice.toFixed(0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Duration</span>
                <span className="font-medium">{selectedMonths} month{selectedMonths > 1 ? 's' : ''}</span>
              </div>
              <div className="border-t border-slate-200 pt-2 flex justify-between">
                <span className="font-bold text-slate-900">Base amount</span>
                <span className="font-bold text-indigo-600 text-lg">₹{displayTotalPrice.toFixed(0)}</span>
              </div>
              <p className="text-xs text-slate-500">+ seat extra charge (if any) + gateway fees at checkout</p>
            </div>
          </div>

          <Button 
            className="w-full" 
            size="lg"
            onClick={() => setStep('datetime')}
          >
            Continue to Date & Time →
          </Button>
        </div>
      )}

      {/* ── Step 3: Date & Time ──────────────────────────────────────────────── */}
      {step === 'datetime' && selectedPlan && (
        <div className="p-4 space-y-4 max-w-md mx-auto">
          {/* Selected plan summary */}
          <div className="rounded-2xl bg-indigo-50 border border-indigo-100 p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="font-bold text-indigo-900">{selectedPlan.name}</p>
                {isMonthlyRate ? (
                  <p className="text-sm text-indigo-700">
                    ₹{displayMonthlyPrice.toFixed(0)} × {selectedMonths} month{selectedMonths > 1 ? 's' : ''} = ₹{displayTotalPrice.toFixed(0)}
                  </p>
                ) : (
                  <p className="text-sm text-indigo-700">₹{selectedPlan.price.toFixed(0)} for {formatDuration(selectedPlan.durationValue, selectedPlan.durationUnit)}</p>
                )}
              </div>
              <button onClick={() => setStep(isMonthlyRate ? 'months' : 'plan')} className="text-sm text-indigo-600 underline font-medium">Change</button>
            </div>
            <div className="flex gap-2 text-xs">
              <span className="bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full font-medium">
                {formatDailyMins(selectedPlan.dailyMinutes)}
              </span>
              <span className="bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full font-medium">
                {isMonthlyRate 
                  ? `${selectedMonths} month${selectedMonths > 1 ? 's' : ''}`
                  : formatDuration(selectedPlan.durationValue, selectedPlan.durationUnit)
                }
              </span>
            </div>
          </div>

          <div className="rounded-2xl bg-white border border-slate-100 p-4 space-y-4">
            {/* Start date */}
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                <Calendar className="h-4 w-4 text-indigo-500" /> Plan Start Date
              </label>
              <input type="date" value={startDate} min={format(new Date(), 'yyyy-MM-dd')}
                onChange={e => setStartDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium" />
              {endDate && (
                <div className="mt-2 p-2 bg-slate-50 rounded-lg text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Plan period:</span>
                    <span className="font-semibold text-slate-900">{formatDate(startDate)} → {formatDate(endDate)}</span>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-slate-600">Total duration:</span>
                    <span className="font-semibold text-indigo-600">
                      {isMonthlyRate 
                        ? `${selectedMonths} month${selectedMonths > 1 ? 's' : ''}`
                        : formatDuration(selectedPlan.durationValue, selectedPlan.durationUnit)
                      }
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Daily time — only for FLEXIBLE */}
            {selectedPlan.timeSelectionMode === 'FLEXIBLE' && (
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                  <Clock className="h-4 w-4 text-indigo-500" /> Daily Start Time
                </label>
                <input type="time" value={dailyStartTime} onChange={e => setDailyStartTime(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium" />
                <p className="text-xs text-slate-500 mt-2 p-2 bg-slate-50 rounded-lg">
                  <strong>Daily slot:</strong> {resolvedDailyStart} → {resolvedDailyEnd}
                  <span className="text-indigo-600 ml-1">({formatDailyMins(selectedPlan.dailyMinutes)})</span>
                </p>
              </div>
            )}

            {/* Fixed time display */}
            {selectedPlan.timeSelectionMode === 'FIXED' && (
              <div className="rounded-xl bg-amber-50 border border-amber-100 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4 text-amber-600" />
                  <p className="font-semibold text-amber-800 text-sm">Fixed Daily Time</p>
                </div>
                <p className="text-amber-800 font-medium">
                  {selectedPlan.fixedStartTime} → {selectedPlan.fixedEndTime}
                </p>
                <p className="text-xs text-amber-700 mt-1">
                  {formatDailyMins(selectedPlan.dailyMinutes)} • This timing cannot be changed
                </p>
              </div>
            )}

            {/* Allowed days display */}
            <div>
              <p className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-indigo-500" />
                Available Study Days
              </p>
              <div className="flex gap-1.5 flex-wrap">
                {DAYS_SHORT.map((d, i) => (
                  <span key={i} className={`text-xs px-2 py-1.5 rounded-lg font-medium ${
                    selectedPlan.allowedDays.includes(i)
                      ?'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      :'bg-slate-100 text-slate-400'
                  }`}>{d}</span>
                ))}
              </div>
              {selectedPlan.allowedDays.length < 7 && (
                <p className="text-xs text-amber-600 mt-2 p-2 bg-amber-50 rounded-lg">
                  Note: This plan is only available on selected days of the week
                </p>
              )}
            </div>
          </div>

          <Button className="w-full" size="lg" loading={loadingSeats} onClick={() => {
            if (!startDate) { toast.error('Select a start date'); return }
            fetchSeats()
          }}>
            Check Available Seats →
          </Button>
        </div>
      )}

      {/* ── Step 3: Seat Selection ──────────────────────────────────────────── */}
      {step === 'seat' && selectedPlan && (
        <div className="p-4 space-y-4">
          {/* Summary bar */}
          <div className="rounded-2xl bg-indigo-50 border border-indigo-100 p-3 text-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-indigo-900">{selectedPlan.name}</p>
                <p className="text-indigo-700">{resolvedDailyStart}–{resolvedDailyEnd} • {formatDate(startDate)} → {endDate ? formatDate(endDate) : '...'}</p>
                <p className="text-xs text-indigo-600 mt-0.5">
                  {formatDuration(selectedPlan.durationValue, selectedPlan.durationUnit)} • {formatDailyMins(selectedPlan.dailyMinutes)}
                </p>
              </div>
              <button onClick={() => setStep('datetime')} className="text-indigo-600 underline text-xs font-medium">Change</button>
            </div>
          </div>

          {/* Seat selection info */}
          <div className="rounded-2xl bg-white border border-slate-100 p-3 text-sm">
            <div className="flex items-center gap-2 mb-2">
              <Info className="h-4 w-4 text-indigo-500" />
              <p className="font-medium text-slate-900">Seat Selection</p>
            </div>
            <p className="text-slate-600 text-xs leading-relaxed">
              Choose a seat that will be reserved for your entire plan duration. 
              The selected seat must be available for all {resolvedDailyStart}–{resolvedDailyEnd} slots in your plan period.
            </p>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 flex-wrap text-xs">
            {Object.entries({ 
              Available: COLORS.available, 
              Booked: COLORS.booked, 
              Maintenance: COLORS.maintenance, 
              Selected: COLORS.selected 
            }).map(([label, color]) => (
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
                <defs><pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse"><path d="M 30 0 L 0 0 0 30" fill="none" stroke="#e2e8f0" strokeWidth="0.5" /></pattern></defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
              </svg>
              {layoutObjects.map(obj => (
                <div key={obj.id} className="absolute flex items-center justify-center text-[10px] text-slate-600 rounded-lg"
                  style={{ left: obj.x, top: obj.y, width: obj.width, height: obj.height, background: obj.color ?? '#e2e8f0' }}>
                  {obj.label ?? obj.objectType}
                </div>
              ))}
              {seats.map(seat => {
                const available = seat.isAvailableForSlot && seat.status !== 'MAINTENANCE' && seat.status !== 'DISABLED'
                const isSelected = selectedSeat?.id === seat.id
                const bg = isSelected ? COLORS.selected : available ? COLORS.available : COLORS.booked
                return (
                  <div key={seat.id} onClick={() => { if (available) setSelectedSeat(seat) }}
                    className={`absolute flex flex-col items-center justify-center rounded-xl text-white text-[11px] font-bold transition-all
                      ${available ? 'cursor-pointer hover:scale-110 hover:shadow-lg' : 'cursor-not-allowed opacity-70'}
                      ${isSelected ? 'ring-2 ring-white ring-offset-1 scale-110 shadow-lg' : ''}`}
                    style={{ left: seat.x, top: seat.y, width: seat.width, height: seat.height, background: bg }}>
                    <span className="leading-none">{seat.label}</span>
                    {seat.extraPrice && seat.extraPrice > 0 && <span className="text-[8px] opacity-90">+₹{seat.extraPrice}</span>}
                  </div>
                )
              })}
            </div>
          </div>

          {seats.length === 0 && <p className="text-center text-slate-400 py-8 text-sm">No seats configured for this library yet</p>}

          {selectedSeat && (
            <div className="rounded-2xl bg-indigo-600 text-white p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-bold">Seat {selectedSeat.label}</p>
                  <p className="text-indigo-200 text-sm capitalize">{selectedSeat.seatType.toLowerCase()}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold">₹{selectedPlan.price + (selectedSeat.extraPrice || 0)}</p>
                  <p className="text-indigo-200 text-xs">plan + seat extra</p>
                </div>
              </div>
              
              {selectedSeat.extraPrice && selectedSeat.extraPrice > 0 && (
                <div className="bg-indigo-500 rounded-xl p-2 mb-3 text-xs">
                  <p className="text-indigo-100">Premium seat includes ₹{selectedSeat.extraPrice} extra charge</p>
                </div>
              )}
              
              <Button onClick={handleProceedToSummary} loading={creatingOrder}
                className="w-full bg-white text-indigo-600 hover:bg-indigo-50" size="sm">
                Continue to Payment →
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Export with Suspense (required for useSearchParams) ─────────────────────

export default function BookSeatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: libraryId } = use(params)
  return (
    <Suspense>
      <BookSeatPageInner libraryId={libraryId} />
    </Suspense>
  )
}
