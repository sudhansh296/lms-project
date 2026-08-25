import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import crypto from 'crypto'
import Razorpay from 'razorpay'
import { calculatePaymentBreakdown, toPaise } from '@/lib/payment-calc'

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID ?? '',
  key_secret: process.env.RAZORPAY_KEY_SECRET ?? '',
})

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await requireAuth(['STUDENT'])
    const { id: bookingId } = await context.params
    const body = await request.json()
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = body

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return Response.json({ error: 'Missing payment verification fields' }, { status: 400 })
    }

    // ── 1. Verify Razorpay signature — prevents tampered payment data ──────
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET ?? '')
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex')

    if (expectedSignature !== razorpaySignature) {
      return Response.json({ error: 'Payment verification failed — invalid signature' }, { status: 400 })
    }

    // ── 2. Idempotency — prevent double processing ─────────────────────────
    const alreadyProcessed = await prisma.payment.findFirst({
      where: { gatewayPaymentId: razorpayPaymentId },
    })
    if (alreadyProcessed) {
      const existingBooking = await prisma.booking.findFirst({
        where: { id: bookingId },
        include: {
          library: { select: { name: true, city: true } },
          seat: true,
          payment: true,
        },
      })
      return Response.json({ booking: existingBooking, success: true, alreadyProcessed: true })
    }

    // ── 3. Verify booking belongs to this student and is still PENDING ──────
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, studentId: session.id, status: 'PENDING' },
      include: {
        library: { include: { owner: true } },
        seat: true,
      },
    })

    if (!booking) {
      return Response.json({ error: 'Booking not found or already processed' }, { status: 404 })
    }

    // ── 4. Double-check seat availability before confirming ────────────────
    const seatConflict = await prisma.booking.findFirst({
      where: {
        seatId: booking.seatId,
        id: { not: bookingId },
        status: { in: ['CONFIRMED', 'ACTIVE'] },
        AND: [{ startTime: { lt: booking.endTime } }, { endTime: { gt: booking.startTime } }],
      },
    })
    if (seatConflict) {
      await prisma.booking.update({ where: { id: bookingId }, data: { status: 'CANCELLED' } })
      return Response.json(
        { error: 'Seat was just booked by another student. Please contact support for a refund.' },
        { status: 409 }
      )
    }

    // ── 5. Recalculate fee breakdown from the DB base price ─────────────────
    // We NEVER trust frontend-submitted amounts. The breakdown is always
    // recomputed from the booking's stored baseAmount.
    const breakdown = calculatePaymentBreakdown(booking.totalAmount) // totalAmount = baseAmount (stored at order creation)

    // ── 6. Route base amount to library owner's linked Razorpay account ────
    let transferId: string | null = null
    const ownerAccountId = booking.library.owner.razorpayAccountId
    const ownerAmountPaise = toPaise(breakdown.ownerAmount)

    if (ownerAccountId && ownerAmountPaise > 0) {
      try {
        const transfer = await razorpay.payments.transfer(razorpayPaymentId, {
          transfers: [
            {
              account: ownerAccountId,
              amount: ownerAmountPaise,
              currency: 'INR',
              notes: {
                bookingId: booking.id,
                libraryId: booking.libraryId,
                seatLabel: booking.seat.label,
                baseAmount: String(breakdown.baseAmount),
              },
              linked_account_notes: ['bookingId'],
              on_hold: false,
            },
          ],
        })
        transferId = (transfer as unknown as { items: Array<{ id: string }> }).items?.[0]?.id ?? null
      } catch (transferErr) {
        // Transfer failure must not cancel the booking — log and continue
        console.error('Razorpay transfer to owner failed:', transferErr)
      }
    } else if (!ownerAccountId) {
      console.warn(
        `Library owner ${booking.library.owner.id} has no Razorpay linked account. ` +
        `Base amount ₹${breakdown.ownerAmount} held in platform account.`
      )
    }

    // ── 7. Run everything in a DB transaction ─────────────────────────────
    const updatedBooking = await prisma.$transaction(async (tx) => {
      // Create Payment record with full fee breakdown
      const payment = await tx.payment.create({
        data: {
          studentId: session.id,
          bookingId: bookingId,
          amount: breakdown.totalAmount,     // what the student actually paid
          status: 'PAID',
          paymentMethod: 'RAZORPAY',
          paymentType: 'SEAT_BOOKING',
          gatewayOrderId: razorpayOrderId,
          gatewayPaymentId: razorpayPaymentId,
          gatewaySignature: razorpaySignature,
          gatewayTransferId: transferId,
          // Fee breakdown — stored for transparency and reconciliation
          baseAmount: breakdown.baseAmount,
          platformFee: breakdown.platformFee,
          processingFee: breakdown.processingFee,
          gstAmount: breakdown.gstAmount,
          ownerAmount: breakdown.ownerAmount,
        },
      })

      // Confirm booking
      const confirmed = await tx.booking.update({
        where: { id: bookingId },
        data: { status: 'CONFIRMED' },
        include: {
          library: { select: { name: true, city: true, owner: { include: { user: true } } } },
          seat: true,
          payment: true,
        },
      })

      return confirmed
    })

    // ── 8. Notify library owner ────────────────────────────────────────────
    try {
      await prisma.notification.create({
        data: {
          userId: updatedBooking.library.owner.userId,
          libraryId: booking.libraryId,
          type: 'PAYMENT_RECEIVED',
          title: 'Booking Payment Received',
          message: `₹${breakdown.totalAmount.toFixed(2)} received for seat ${booking.seat.label} (your share: ₹${breakdown.ownerAmount.toFixed(2)})`,
          data: {
            bookingId: booking.id,
            totalAmount: breakdown.totalAmount,
            ownerAmount: breakdown.ownerAmount,
            platformFee: breakdown.platformFee,
            transferId,
            transferredToAccount: !!transferId,
          },
        },
      })
    } catch {
      // Non-critical
    }

    return Response.json({
      booking: updatedBooking,
      success: true,
      transferId,
      breakdown,
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : ''
    if (msg === 'UNAUTHORIZED') return Response.json({ error: 'Unauthorized' }, { status: 401 })
    if (msg === 'FORBIDDEN') return Response.json({ error: 'Forbidden' }, { status: 403 })
    console.error('Booking payment error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
