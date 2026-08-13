import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import Razorpay from 'razorpay'
import prisma from '@/lib/prisma'

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID ?? '',
  key_secret: process.env.RAZORPAY_KEY_SECRET ?? '',
})

/**
 * POST /api/payments/seat-order
 *
 * Creates a PENDING booking and a Razorpay order whose amount is fetched
 * entirely from the database. The frontend sends only identifiers — never
 * an amount.
 *
 * Body: { libraryId, seatId, startTime, endTime }
 * Returns: { orderId, amount, currency, key, bookingId, bookingRef }
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

    // ── 1. Verify library exists and is active ─────────────────────────────
    const library = await prisma.library.findUnique({
      where: { id: libraryId, status: 'ACTIVE' },
      include: {
        membershipPlans: {
          where: { isActive: true },
          orderBy: { price: 'asc' },
          take: 1,
        },
      },
    })
    if (!library) {
      return Response.json({ error: 'Library not found or not active' }, { status: 404 })
    }

    // Validate booking duration
    const durationMins = (end.getTime() - start.getTime()) / 60000
    if (durationMins < library.minBookingMins) {
      return Response.json({ error: `Minimum booking duration is ${library.minBookingMins} minutes` }, { status: 400 })
    }
    if (durationMins > library.maxBookingMins) {
      return Response.json({ error: `Maximum booking duration is ${library.maxBookingMins} minutes` }, { status: 400 })
    }

    // ── 2. Verify seat exists, belongs to library, and is available ────────
    const seat = await prisma.seat.findFirst({
      where: { id: seatId, libraryId },
    })
    if (!seat) {
      return Response.json({ error: 'Seat not found' }, { status: 404 })
    }
    if (seat.status === 'MAINTENANCE' || seat.status === 'DISABLED') {
      return Response.json({ error: 'Seat is not available for booking' }, { status: 409 })
    }

    // ── 3. Check seat is not already booked for this time slot ────────────
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

    // ── 4. Check student doesn't have an overlapping booking at this library
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

    // ── 5. Determine price from DB (never from frontend) ──────────────────
    const plan = library.membershipPlans[0] ?? null
    const basePrice = plan?.price ?? 0
    const seatExtra = seat.extraPrice ?? 0
    const totalAmount = basePrice + seatExtra

    // ── 6. Create PENDING booking ─────────────────────────────────────────
    const booking = await prisma.booking.create({
      data: {
        libraryId,
        studentId: session.id,
        seatId,
        bookingDate: start,
        startTime: start,
        endTime: end,
        status: 'PENDING',
        totalAmount,
      },
    })

    // ── 7. Free booking — confirm immediately, no Razorpay needed ─────────
    if (totalAmount === 0) {
      await prisma.$transaction(async (tx) => {
        // Create payment first
        const payment = await tx.payment.create({
          data: {
            studentId: session.id,
            bookingId: booking.id,
            amount: 0,
            status: 'PAID',
            paymentMethod: 'FREE',
            paymentType: 'SEAT_BOOKING',
          },
        })
        
        // Confirm booking
        await tx.booking.update({
          where: { id: booking.id },
          data: { status: 'CONFIRMED' },
        })
        
        // Create membership if plan exists
        if (plan) {
          const membership = await tx.studentMembership.create({
            data: {
              studentId: session.id,
              libraryId,
              planId: plan.id,
              status: 'ACTIVE',
              startDate: start,
              endDate: end,
              paidAmount: 0,
            },
          })
          
          // Link payment to membership
          await tx.payment.update({
            where: { id: payment.id },
            data: { membershipId: membership.id },
          })
        }
      })
      return Response.json({
        free: true,
        bookingId: booking.id,
        bookingRef: booking.bookingRef,
      })
    }

    // ── 8. Create Razorpay order (paid booking) ───────────────────────────
    let order
    try {
      order = await razorpay.orders.create({
        amount: Math.round(totalAmount * 100), // paise — always > 0 here
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
      // Clean up the pending booking so the seat isn't stuck
      await prisma.booking.delete({ where: { id: booking.id } }).catch(() => {})
      // Surface the real Razorpay error
      const rzMsg =
        (razorpayErr as { error?: { description?: string } })?.error?.description ??
        (razorpayErr instanceof Error ? razorpayErr.message : 'Razorpay order creation failed')
      console.error('Razorpay order creation failed:', razorpayErr)
      return Response.json({ error: `Payment gateway error: ${rzMsg}` }, { status: 502 })
    }

    return Response.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      bookingId: booking.id,
      bookingRef: booking.bookingRef,
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : ''
    if (msg === 'UNAUTHORIZED') return Response.json({ error: 'Unauthorized' }, { status: 401 })
    if (msg === 'FORBIDDEN') return Response.json({ error: 'Forbidden' }, { status: 403 })
    console.error('Seat order error:', error)
    return Response.json({ error: 'Payment initialization failed' }, { status: 500 })
  }
}
