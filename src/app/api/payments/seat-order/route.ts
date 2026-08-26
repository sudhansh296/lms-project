/**
 * POST /api/payments/seat-order
 *
 * Creates a recurring-plan PENDING booking + occurrences + PENDING payment + Razorpay order.
 * ALL amounts and dates are calculated server-side.
 *
 * Body: { libraryId, planId, seatId, startDate, dailyStartTime }
 *   - For FIXED plans, dailyStartTime is ignored (taken from plan).
 *
 * Returns: { orderId, amount(paise), currency, key, bookingId, bookingRef,
 *             plan, breakdown, holdExpiresAt }
 */
import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import Razorpay from 'razorpay'
import prisma from '@/lib/prisma'
import { calculatePaymentBreakdown, toPaise } from '@/lib/payment-calc'
import { cancelExpiredBookingHolds } from '@/lib/payment-service'
import { calcPlanEndDate } from '@/lib/validations'
import {
  generateOccurrences,
  calcEndTimeHHMM,
  fitsLibraryHours,
} from '@/lib/booking-occurrences'

const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID     ?? '',
  key_secret: process.env.RAZORPAY_KEY_SECRET ?? '',
})

const HOLD_MINUTES = parseInt(process.env.BOOKING_HOLD_MINUTES ?? '10', 10)

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(['STUDENT'])
    const body = await request.json()
    const { libraryId, planId, seatId, startDate, dailyStartTime, months } = body

    if (!libraryId || !planId || !seatId || !startDate) {
      return Response.json({ error: 'Missing required fields: libraryId, planId, seatId, startDate' }, { status: 400 })
    }

    // ── 1. Release expired holds ──────────────────────────────────────────────
    await cancelExpiredBookingHolds().catch(() => {})

    // ── 2. Verify library is ACTIVE ───────────────────────────────────────────
    const library = await prisma.library.findUnique({
      where: { id: libraryId, status: 'ACTIVE' },
      include: {
        owner: { select: { id: true, settlementReady: true } },
        hours: { orderBy: { dayOfWeek: 'asc' } },
      },
    })
    if (!library) {
      return Response.json({ error: 'Library not found or not active' }, { status: 404 })
    }

    // ── 3. Load and validate plan ─────────────────────────────────────────────
    const plan = await prisma.membershipPlan.findFirst({
      where: { id: planId, libraryId, isActive: true },
    })
    if (!plan) {
      return Response.json({ error: 'Pricing plan not found or inactive' }, { status: 404 })
    }

    // For MONTHLY_RATE plans, months parameter is required
    const isMonthlyRate = plan.pricingModel === 'MONTHLY_RATE'
    let selectedMonths = 1
    let effectiveDurationValue = plan.durationValue
    let effectiveDurationUnit = plan.durationUnit as 'DAY'|'WEEK'|'MONTH'|'YEAR'
    
    if (isMonthlyRate) {
      if (!months || typeof months !== 'number' || months < 1 || months > 24) {
        return Response.json({ error: 'For monthly rate plans, months parameter is required (1-24)' }, { status: 400 })
      }
      selectedMonths = Math.floor(months)
      effectiveDurationValue = selectedMonths
      effectiveDurationUnit = 'MONTH'
    }

    // ── 4. Verify seat ────────────────────────────────────────────────────────
    const seat = await prisma.seat.findFirst({ where: { id: seatId, libraryId } })
    if (!seat) {
      return Response.json({ error: 'Seat not found' }, { status: 404 })
    }
    if (seat.status === 'MAINTENANCE' || seat.status === 'DISABLED') {
      return Response.json({ error: 'Seat is not available for booking' }, { status: 409 })
    }

    // ── 5. Determine daily time ───────────────────────────────────────────────
    const resolvedDailyStart: string =
      plan.timeSelectionMode === 'FIXED' && plan.fixedStartTime
        ? plan.fixedStartTime
        : dailyStartTime

    if (!resolvedDailyStart || !/^\d{2}:\d{2}$/.test(resolvedDailyStart)) {
      return Response.json({ error: 'dailyStartTime is required for flexible plans (HH:MM)' }, { status: 400 })
    }

    const resolvedDailyEnd = calcEndTimeHHMM(resolvedDailyStart, plan.dailyMinutes)

    // ── 6. Calculate plan period ──────────────────────────────────────────────
    const parsedStart = new Date(startDate)
    if (isNaN(parsedStart.getTime())) {
      return Response.json({ error: 'Invalid startDate' }, { status: 400 })
    }
    parsedStart.setUTCHours(0, 0, 0, 0)

    // Must not be in the past
    const today = new Date(); today.setUTCHours(0,0,0,0)
    if (parsedStart < today) {
      return Response.json({ error: 'Start date cannot be in the past' }, { status: 400 })
    }

    const endDate = calcPlanEndDate(parsedStart, effectiveDurationValue, effectiveDurationUnit)
    // endDate is exclusive (e.g. 1 month from Sep 1 = Oct 1), subtract 1 day for last occurrence
    const lastDay = new Date(endDate)
    lastDay.setUTCDate(lastDay.getUTCDate() - 1)

    // ── 7. Generate occurrences ───────────────────────────────────────────────
    const occurrences = generateOccurrences(
      parsedStart,
      lastDay,
      resolvedDailyStart,
      plan.dailyMinutes,
      plan.allowedDays
    )

    if (occurrences.length === 0) {
      return Response.json({ error: 'No valid study days in selected period and allowed days' }, { status: 400 })
    }

    // ── 8. Validate library hours for each occurrence ─────────────────────────
    const badDay = occurrences.find(occ => {
      const dow = occ.date.getUTCDay()
      return !fitsLibraryHours(resolvedDailyStart, resolvedDailyEnd, library.hours, library.is24Hours, dow)
    })
    if (badDay) {
      return Response.json({
        error: `Library is not open at ${resolvedDailyStart}–${resolvedDailyEnd} on some days in the plan period. Please choose a different time.`,
      }, { status: 400 })
    }

    // ── 9. Check settlementReady (skip for free plans) ────────────────────────
    const willCharge = plan.price > 0 || (seat.extraPrice ?? 0) > 0
    if (willCharge && !library.owner.settlementReady) {
      return Response.json({
        error: 'OWNER_SETTLEMENT_NOT_ACTIVE',
        message: 'Online payment is unavailable for this library until settlement verification is complete.',
      }, { status: 403 })
    }

    // ── 10. Check seat availability for ALL occurrences ───────────────────────
    // Only active holds and confirmed/active bookings conflict.
    const now = new Date()
    const existingOccurrences = await prisma.bookingOccurrence.findMany({
      where: {
        seatId,
        status: { in: ['HELD', 'CONFIRMED'] },
        // At least one occurrence overlaps our slot on ANY day in the range
        startTime: { gte: occurrences[0].startTime },
        endTime:   { lte: occurrences[occurrences.length - 1].endTime },
      },
      select: { startTime: true, endTime: true, bookingId: true },
    })

    // Also check hold expiry on the parent booking
    const conflictingBookingIds = new Set(existingOccurrences.map(o => o.bookingId))
    const activeParents = conflictingBookingIds.size > 0
      ? await prisma.booking.findMany({
          where: {
            id: { in: [...conflictingBookingIds] },
            status: { in: ['PENDING', 'CONFIRMED', 'ACTIVE'] },
            OR: [
              { status: { in: ['CONFIRMED', 'ACTIVE'] } },
              { status: 'PENDING', OR: [{ holdExpiresAt: null }, { holdExpiresAt: { gt: now } }] },
            ],
          },
          select: { id: true },
        })
      : []
    const activeParentIds = new Set(activeParents.map(p => p.id))

    for (const occ of occurrences) {
      const conflict = existingOccurrences.find(
        ex =>
          activeParentIds.has(ex.bookingId) &&
          ex.startTime < occ.endTime &&
          ex.endTime > occ.startTime
      )
      if (conflict) {
        return Response.json({
          error: `Seat is already booked on ${occ.date.toISOString().slice(0, 10)} at ${resolvedDailyStart}. Please choose another seat or time.`,
        }, { status: 409 })
      }
    }

    // ── 11. Calculate price (server-side, never from frontend) ────────────────
    // For MONTHLY_RATE plans: libraryBaseAmount = (monthlyPrice × selectedMonths) + seatExtra
    // For LEGACY_PACKAGE plans: libraryBaseAmount = price + seatExtra
    const planBasePrice = isMonthlyRate 
      ? (plan.monthlyPrice ?? plan.price) * selectedMonths
      : plan.price
    
    const breakdown = calculatePaymentBreakdown(planBasePrice, seat.extraPrice ?? 0, {
      months: isMonthlyRate ? selectedMonths : undefined,
      monthlyPrice: isMonthlyRate ? (plan.monthlyPrice ?? plan.price) : undefined,
    })
    const holdExpiresAt = new Date(Date.now() + HOLD_MINUTES * 60 * 1000)

    // ── 12. Snapshots (immutable record of what was purchased) ────────────────
    const durationSnapshot = isMonthlyRate 
      ? `${selectedMonths} MONTH`
      : `${plan.durationValue} ${plan.durationUnit}`
    const planNameSnapshot      = plan.name
    const planPriceSnapshot     = planBasePrice
    const monthlyPriceSnapshot  = isMonthlyRate ? (plan.monthlyPrice ?? plan.price) : null
    const seatExtraSnapshot     = seat.extraPrice ?? 0
    const dailyMinutesSnapshot  = plan.dailyMinutes

    // ── 13. Free plan — confirm immediately ───────────────────────────────────
    if (breakdown.totalAmount === 0) {
      const booking = await prisma.booking.create({
        data: {
          libraryId, studentId: session.id, seatId,
          planId,
          startDate: parsedStart, endDate: lastDay,
          dailyStartTime: resolvedDailyStart, dailyEndTime: resolvedDailyEnd,
          planNameSnapshot, planPriceSnapshot, seatExtraSnapshot,
          dailyMinutesSnapshot, durationSnapshot,
          selectedMonths: isMonthlyRate ? selectedMonths : null,
          monthlyPriceSnapshot,
          bookingDate: parsedStart,
          startTime: occurrences[0].startTime,
          endTime:   occurrences[occurrences.length - 1].endTime,
          status: 'CONFIRMED', totalAmount: 0,
          occurrences: {
            createMany: {
              data: occurrences.map(o => ({
                seatId,
                date: o.date,
                startTime: o.startTime,
                endTime: o.endTime,
                status: 'CONFIRMED',
              })),
            },
          },
        },
      })
      await prisma.payment.create({
        data: {
          studentId: session.id, bookingId: booking.id,
          amount: 0, status: 'PAID',
          paymentMethod: 'FREE', paymentType: 'SEAT_BOOKING',
          planPrice: 0, seatExtraAmount: 0,
          monthlyPrice: monthlyPriceSnapshot,
          selectedMonths: isMonthlyRate ? selectedMonths : null,
          baseAmount: 0, platformFee: 0, processingFee: 0, gstAmount: 0, ownerAmount: 0,
          gatewayFee: 0, gatewayFeeGst: 0,
          settlementStatus: 'NOT_REQUIRED',
        },
      })
      return Response.json({
        free: true,
        bookingId: booking.id, bookingRef: booking.bookingRef,
        plan: { 
          name: planNameSnapshot, 
          dailyMinutes: plan.dailyMinutes, 
          startDate: parsedStart, 
          endDate: lastDay, 
          dailyStartTime: resolvedDailyStart, 
          dailyEndTime: resolvedDailyEnd,
          durationValue: effectiveDurationValue,
          durationUnit: effectiveDurationUnit,
        },
        breakdown,
      })
    }

    // ── 14. Create PENDING booking + hold occurrences ─────────────────────────
    const booking = await prisma.booking.create({
      data: {
        libraryId, studentId: session.id, seatId,
        planId,
        startDate: parsedStart, endDate: lastDay,
        dailyStartTime: resolvedDailyStart, dailyEndTime: resolvedDailyEnd,
        planNameSnapshot, planPriceSnapshot, seatExtraSnapshot,
        dailyMinutesSnapshot, durationSnapshot,
        selectedMonths: isMonthlyRate ? selectedMonths : null,
        monthlyPriceSnapshot,
        bookingDate: parsedStart,
        startTime: occurrences[0].startTime,
        endTime:   occurrences[occurrences.length - 1].endTime,
        status: 'PENDING',
        totalAmount: breakdown.baseAmount,
        holdExpiresAt,
        occurrences: {
          createMany: {
            data: occurrences.map(o => ({
              seatId,
              date: o.date,
              startTime: o.startTime,
              endTime: o.endTime,
              status: 'HELD',
            })),
          },
        },
      },
    })

    // ── 15. Create Razorpay order ─────────────────────────────────────────────
    let order
    try {
      order = await razorpay.orders.create({
        amount: toPaise(breakdown.studentTotal ?? breakdown.totalAmount),
        currency: 'INR',
        receipt: `rcpt_${booking.id.slice(-8)}`,
        notes: { bookingId: booking.id, studentId: session.id, libraryId, planId, seatId, type: 'SEAT_BOOKING' },
      })
    } catch (rzErr: unknown) {
      // Clean up on Razorpay failure
      await prisma.bookingOccurrence.deleteMany({ where: { bookingId: booking.id } }).catch(() => {})
      await prisma.booking.delete({ where: { id: booking.id } }).catch(() => {})
      const rzMsg = (rzErr as { error?: { description?: string } })?.error?.description
        ?? (rzErr instanceof Error ? rzErr.message : 'Order creation failed')
      return Response.json({ error: `Payment gateway error: ${rzMsg}` }, { status: 502 })
    }

    // ── 16. Create PENDING Payment record ─────────────────────────────────────
    await prisma.payment.create({
      data: {
        studentId: session.id, bookingId: booking.id,
        amount: breakdown.studentTotal ?? breakdown.totalAmount, 
        status: 'PENDING',
        paymentMethod: 'RAZORPAY', paymentType: 'SEAT_BOOKING',
        gatewayOrderId: order.id,
        planPrice: breakdown.planPrice ?? planBasePrice, 
        seatExtraAmount: breakdown.seatExtraAmount,
        monthlyPrice: monthlyPriceSnapshot,
        selectedMonths: isMonthlyRate ? selectedMonths : null,
        baseAmount: breakdown.baseAmount ?? breakdown.libraryBaseAmount, 
        platformFee: breakdown.platformFee ?? breakdown.platformCommission,
        processingFee: breakdown.processingFee ?? 0, 
        gstAmount: breakdown.gstAmount ?? 0,
        gatewayFee: breakdown.gatewayFee ?? 0,
        gatewayFeeGst: breakdown.gatewayFeeGst ?? 0,
        ownerAmount: breakdown.ownerAmount,
        settlementStatus: 'NOT_REQUIRED', transferAttempts: 0,
      },
    })

    return Response.json({
      orderId:    order.id,
      amount:     order.amount,
      currency:   order.currency,
      key:        process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      bookingId:  booking.id,
      bookingRef: booking.bookingRef,
      plan: {
        name: planNameSnapshot,
        dailyMinutes: plan.dailyMinutes,
        startDate: parsedStart.toISOString().slice(0,10),
        endDate:   lastDay.toISOString().slice(0,10),
        dailyStartTime: resolvedDailyStart,
        dailyEndTime:   resolvedDailyEnd,
        durationValue: effectiveDurationValue,
        durationUnit: effectiveDurationUnit,
        occurrenceCount: occurrences.length,
      },
      breakdown,
      holdExpiresAt: holdExpiresAt.toISOString(),
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : ''
    if (msg === 'UNAUTHORIZED') return Response.json({ error: 'Unauthorized' }, { status: 401 })
    if (msg === 'FORBIDDEN')    return Response.json({ error: 'Forbidden' },    { status: 403 })
    console.error('Seat order error:', error)
    return Response.json({ error: 'Payment initialization failed' }, { status: 500 })
  }
}
