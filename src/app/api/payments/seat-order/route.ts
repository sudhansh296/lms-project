import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import Razorpay from 'razorpay'
import prisma from '@/lib/prisma'
import { calculatePaymentBreakdown, toPaise } from '@/lib/payment-calc'

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID ?? '',
  key_secret: process.env.RAZORPAY_KEY_SECRET ?? '',
})

/**
 * POST /api/payments/seat-order
 *
 * Creates a PENDING booking and a Razorpay order whose total amount is
 * calculated entirely server-side. The frontend sends only identifiers —
 * never an amount.
 *
 * Body:   { libraryId, seatId, startTime, endTime }
 * Returns: {
 *   orderId, amount (paise), currency, key,
 *   bookingId, bookingRef,
 *   breakdown: { baseAmount, platformFee, processingFee, gstAmount, totalAmount, ownerAmount }
 * }
 *
 * Also accepts a GET request (query params) so the frontend can fetch the
 * breakdown for display BEFORE opening Razorpay checkout (payment summary step).
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(['STUDENT'])
    const body = await request.json()
    const { libraryId, seatId, startTime, endTime } = body

    if (!libraryId || !seatId || !startTime || !endTime) {
      return Response.json({ error: 'Missing required fields: libraryId, seatId, startTime, endTime' }, { status: 400 })
    }

    const start = new Date(startTime)
    const end = new Date(endTime)

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return Response.json({ error: 'Invalid date/time format' }, { status: 400 })
    }
    if (end <= start) {
      return Response.json({ error: 'End time must be after start time' }, { status: 400 })
    }
    if (start < new Date()) {
      return Response.json({ error: 'Cannot book in the past' }, { status: 400 })
    }

    // ── 1. Verify library exists and is active ────────────────────────────
    const library = await prisma.library.findUnique({
      where: { id: libraryId, status: 'ACTIVE' },
    })
    if (!library) {
      return Response.json({ error: 'Library not found or not active' }, { status: 404 })
    }

    const durationMins = (end.getTime() - start.getTime()) / 60000
    if (durationMins < library.minBookingMins) {
      return Response.json({ error: `Minimum booking duration is ${library.minBookingMins} minutes` }, { status: 400 })
    }
    if (durationMins > library.maxBookingMins) {
      return Response.json({ error: `Maximum booking duration is ${library.maxBookingMins} minutes` }, { status: 400 })
    }

    // ── 2. Verify seat ────────────────────────────────────────────────────
    const seat = await prisma.seat.findFirst({ where: { id: seatId, libraryId } })
    if (!seat) {
      return Response.json({ error: 'Seat not found' }, { status: 404 })
    }
    if (seat.status === 'MAINTENANCE' || seat.status === 'DISABLED') {
      return Response.json({ error: 'Seat is not available for booking' }, { status: 409 })
    }

    // ── 3. Check seat availability ────────────────────────────────────────
    const seatConflict = await prisma.booking.findFirst({
      where: {
        seatId,
        status: { in: ['PENDING', 'CONFIRMED', 'ACTIVE'] },
        AND: [{ startTime: { lt: end } }, { endTime: { gt: start } }],
      },
    })
    if (seatConflict) {
      return Response.json({ error: 'Seat is already booked for this time slot' }, { status: 409 })
    }

    // ── 4. Check student doesn't have overlapping booking ─────────────────
    const studentConflict = await prisma.booking.findFirst({
      where: {
        studentId: session.id,
        libraryId,
        status: { in: ['PENDING', 'CONFIRMED', 'ACTIVE'] },
        AND: [{ startTime: { lt: end } }, { endTime: { gt: start } }],
      },
    })
    if (studentConflict) {
      return Response.json({ error: 'You already have a booking overlapping this time' }, { status: 409 })
    }

    // ── 5. Calculate price from DB — never from frontend ─────────────────
    // basePrice is set directly on the library; seat.extraPrice is optional extra
    const baseSeatPrice = (library.basePrice ?? 0) + (seat.extraPrice ?? 0)
    const breakdown = calculatePaymentBreakdown(baseSeatPrice)

    // ── 6. Create PENDING booking with the BASE amount ────────────────────
    // totalAmount on the booking stores the base price (owner's amount).
    // The student's full charge (breakdown.totalAmount) is on the Payment record.
    const booking = await prisma.booking.create({
      data: {
        libraryId,
        studentId: session.id,
        seatId,
        bookingDate: start,
        startTime: start,
        endTime: end,
        status: 'PENDING',
        totalAmount: breakdown.baseAmount,
      },
    })

    // ── 7. Free booking — confirm immediately ─────────────────────────────
    if (breakdown.totalAmount === 0) {
      await prisma.$transaction(async (tx) => {
        await tx.payment.create({
          data: {
            studentId: session.id,
            bookingId: booking.id,
            amount: 0,
            status: 'PAID',
            paymentMethod: 'FREE',
            paymentType: 'SEAT_BOOKING',
            baseAmount: 0,
            platformFee: 0,
            processingFee: 0,
            gstAmount: 0,
            ownerAmount: 0,
          },
        })
        await tx.booking.update({ where: { id: booking.id }, data: { status: 'CONFIRMED' } })
      })
      return Response.json({ free: true, bookingId: booking.id, bookingRef: booking.bookingRef, breakdown })
    }

    // ── 8. Create Razorpay order for the student's total payable amount ───
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
          baseAmount: String(breakdown.baseAmount),
          platformFee: String(breakdown.platformFee),
          processingFee: String(breakdown.processingFee),
          gstAmount: String(breakdown.gstAmount),
          ownerAmount: String(breakdown.ownerAmount),
        },
      })
    } catch (razorpayErr: unknown) {
      await prisma.booking.delete({ where: { id: booking.id } }).catch(() => {})
      const rzMsg =
        (razorpayErr as { error?: { description?: string } })?.error?.description ??
        (razorpayErr instanceof Error ? razorpayErr.message : 'Razorpay order creation failed')
      console.error('Razorpay order creation failed:', razorpayErr)
      return Response.json({ error: `Payment gateway error: ${rzMsg}` }, { status: 502 })
    }

    return Response.json({
      orderId: order.id,
      amount: order.amount,   // paise — used by Razorpay checkout
      currency: order.currency,
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      bookingId: booking.id,
      bookingRef: booking.bookingRef,
      breakdown,              // full fee breakdown for payment summary UI
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : ''
    if (msg === 'UNAUTHORIZED') return Response.json({ error: 'Unauthorized' }, { status: 401 })
    if (msg === 'FORBIDDEN') return Response.json({ error: 'Forbidden' }, { status: 403 })
    console.error('Seat order error:', error)
    return Response.json({ error: 'Payment initialization failed' }, { status: 500 })
  }
}
