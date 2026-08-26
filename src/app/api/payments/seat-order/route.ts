/**
 * POST /api/payments/seat-order
 *
 * Creates a PENDING booking + PENDING payment + Razorpay order.
 * All amounts are calculated server-side; the frontend sends only IDs.
 *
 * Body:    { libraryId, seatId, startTime, endTime }
 * Returns: { orderId, amount(paise), currency, key,
 *             bookingId, bookingRef, breakdown }
 *
 * Rejects if owner.settlementReady === false (no active payout account).
 */
import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import Razorpay from 'razorpay'
import prisma from '@/lib/prisma'
import { calculatePaymentBreakdown, toPaise } from '@/lib/payment-calc'
import { cancelExpiredBookingHolds } from '@/lib/payment-service'

const razorpay = new Razorpay({
  key_id:    process.env.RAZORPAY_KEY_ID    ?? '',
  key_secret: process.env.RAZORPAY_KEY_SECRET ?? '',
})

const HOLD_MINUTES = parseInt(process.env.BOOKING_HOLD_MINUTES ?? '10', 10)

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(['STUDENT'])
    const body = await request.json()
    const { libraryId, seatId, startTime, endTime } = body

    if (!libraryId || !seatId || !startTime || !endTime) {
      return Response.json({ error: 'Missing required fields: libraryId, seatId, startTime, endTime' }, { status: 400 })
    }

    const start = new Date(startTime)
    const end   = new Date(endTime)

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return Response.json({ error: 'Invalid date/time format' }, { status: 400 })
    }
    if (end <= start) {
      return Response.json({ error: 'End time must be after start time' }, { status: 400 })
    }
    if (start < new Date()) {
      return Response.json({ error: 'Cannot book in the past' }, { status: 400 })
    }

    // ── 1. Release expired holds so stale PENDING bookings don't block ────────
    await cancelExpiredBookingHolds().catch(() => {})

    // ── 2. Verify library is ACTIVE ───────────────────────────────────────────
    const library = await prisma.library.findUnique({
      where: { id: libraryId, status: 'ACTIVE' },
      include: { owner: { select: { id: true, settlementReady: true } } },
    })
    if (!library) {
      return Response.json({ error: 'Library not found or not active' }, { status: 404 })
    }

    // ── 3. Check owner settlementReady ────────────────────────────────────────
    // Allow free (₹0) bookings to pass through without settlement
    const baseSeatPrice = (library.basePrice ?? 0)
    const willCharge = baseSeatPrice > 0

    if (willCharge && !library.owner.settlementReady) {
      return Response.json({
        error: 'OWNER_SETTLEMENT_NOT_ACTIVE',
        message: 'Online payment is unavailable for this library until settlement verification is complete.',
      }, { status: 403 })
    }

    // ── 4. Duration validation ─────────────────────────────────────────────────
    const durationMins = (end.getTime() - start.getTime()) / 60000
    if (durationMins < library.minBookingMins) {
      return Response.json({ error: `Minimum booking duration is ${library.minBookingMins} minutes` }, { status: 400 })
    }
    if (durationMins > library.maxBookingMins) {
      return Response.json({ error: `Maximum booking duration is ${library.maxBookingMins} minutes` }, { status: 400 })
    }

    // ── 5. Verify seat ────────────────────────────────────────────────────────
    const seat = await prisma.seat.findFirst({ where: { id: seatId, libraryId } })
    if (!seat) {
      return Response.json({ error: 'Seat not found' }, { status: 404 })
    }
    if (seat.status === 'MAINTENANCE' || seat.status === 'DISABLED') {
      return Response.json({ error: 'Seat is not available for booking' }, { status: 409 })
    }

    // ── 6. Seat availability — exclude expired holds ───────────────────────────
    const now = new Date()
    const seatConflict = await prisma.booking.findFirst({
      where: {
        seatId,
        status: { in: ['PENDING', 'CONFIRMED', 'ACTIVE'] },
        // PENDING is only blocking if holdExpiresAt is in the future (or null = legacy)
        OR: [
          { status: { in: ['CONFIRMED', 'ACTIVE'] } },
          {
            status: 'PENDING',
            OR: [
              { holdExpiresAt: null },
              { holdExpiresAt: { gt: now } },
            ],
          },
        ],
        AND: [{ startTime: { lt: end } }, { endTime: { gt: start } }],
      },
    })
    if (seatConflict) {
      return Response.json({ error: 'Seat is already booked for this time slot' }, { status: 409 })
    }

    // ── 7. Student conflict check ──────────────────────────────────────────────
    const studentConflict = await prisma.booking.findFirst({
      where: {
        studentId: session.id,
        libraryId,
        status: { in: ['PENDING', 'CONFIRMED', 'ACTIVE'] },
        OR: [
          { status: { in: ['CONFIRMED', 'ACTIVE'] } },
          { status: 'PENDING', OR: [{ holdExpiresAt: null }, { holdExpiresAt: { gt: now } }] },
        ],
        AND: [{ startTime: { lt: end } }, { endTime: { gt: start } }],
      },
    })
    if (studentConflict) {
      return Response.json({ error: 'You already have a booking overlapping this time' }, { status: 409 })
    }

    // ── 8. Calculate price (server-side only) ─────────────────────────────────
    const fullBasePrice = baseSeatPrice + (seat.extraPrice ?? 0)
    const breakdown = calculatePaymentBreakdown(fullBasePrice)

    const holdExpiresAt = new Date(Date.now() + HOLD_MINUTES * 60 * 1000)

    // ── 9. Free booking — confirm immediately ──────────────────────────────────
    if (breakdown.totalAmount === 0) {
      const booking = await prisma.booking.create({
        data: {
          libraryId, studentId: session.id, seatId,
          bookingDate: start, startTime: start, endTime: end,
          status: 'CONFIRMED', totalAmount: 0,
        },
      })
      await prisma.payment.create({
        data: {
          studentId: session.id, bookingId: booking.id,
          amount: 0, status: 'PAID',
          paymentMethod: 'FREE', paymentType: 'SEAT_BOOKING',
          baseAmount: 0, platformFee: 0, processingFee: 0,
          gstAmount: 0, ownerAmount: 0,
          settlementStatus: 'NOT_REQUIRED',
        },
      })
      return Response.json({ free: true, bookingId: booking.id, bookingRef: booking.bookingRef, breakdown })
    }

    // ── 10. Create PENDING booking with hold expiry ───────────────────────────
    const booking = await prisma.booking.create({
      data: {
        libraryId, studentId: session.id, seatId,
        bookingDate: start, startTime: start, endTime: end,
        status: 'PENDING',
        totalAmount: breakdown.baseAmount,  // base price stored; full total on Payment
        holdExpiresAt,
      },
    })

    // ── 11. Create Razorpay order ─────────────────────────────────────────────
    let order
    try {
      order = await razorpay.orders.create({
        amount: toPaise(breakdown.totalAmount),
        currency: 'INR',
        receipt: `rcpt_${booking.id.slice(-8)}`,
        notes: {
          bookingId: booking.id,
          studentId: session.id,
          libraryId,
          seatId,
          type: 'SEAT_BOOKING',
        },
      })
    } catch (razorpayErr: unknown) {
      await prisma.booking.delete({ where: { id: booking.id } }).catch(() => {})
      const rzMsg =
        (razorpayErr as { error?: { description?: string } })?.error?.description ??
        (razorpayErr instanceof Error ? razorpayErr.message : 'Order creation failed')
      console.error('Razorpay order error:', razorpayErr)
      return Response.json({ error: `Payment gateway error: ${rzMsg}` }, { status: 502 })
    }

    // ── 12. Create PENDING payment record immediately ─────────────────────────
    await prisma.payment.create({
      data: {
        studentId: session.id,
        bookingId: booking.id,
        amount: breakdown.totalAmount,
        status: 'PENDING',
        paymentMethod: 'RAZORPAY',
        paymentType: 'SEAT_BOOKING',
        gatewayOrderId: order.id,
        baseAmount: breakdown.baseAmount,
        platformFee: breakdown.platformFee,
        processingFee: breakdown.processingFee,
        gstAmount: breakdown.gstAmount,
        ownerAmount: breakdown.ownerAmount,
        settlementStatus: 'NOT_REQUIRED',
        transferAttempts: 0,
      },
    })

    return Response.json({
      orderId:    order.id,
      amount:     order.amount,
      currency:   order.currency,
      key:        process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      bookingId:  booking.id,
      bookingRef: booking.bookingRef,
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
