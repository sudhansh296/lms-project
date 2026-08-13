import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import crypto from 'crypto'
import Razorpay from 'razorpay'

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

    // ── 1. Verify Razorpay signature first — prevents tampered payment data ─
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
      // Find and return the existing confirmed booking
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
        library: {
          include: {
            owner: true,
            membershipPlans: {
              where: { isActive: true },
              orderBy: { price: 'asc' },
              take: 1,
            },
          },
        },
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
        id: { not: bookingId }, // exclude current booking
        status: { in: ['CONFIRMED', 'ACTIVE'] },
        AND: [{ startTime: { lt: booking.endTime } }, { endTime: { gt: booking.startTime } }],
      },
    })
    if (seatConflict) {
      // Payment captured but seat taken — mark booking cancelled, we'll handle refund separately
      await prisma.booking.update({
        where: { id: bookingId },
        data: { status: 'CANCELLED' },
      })
      return Response.json(
        { error: 'Seat was just booked by another student. Please contact support for a refund.' },
        { status: 409 }
      )
    }

    // ── 5. Route payment to library owner's linked Razorpay account ─────────
    let transferId: string | null = null
    const ownerAccountId = booking.library.owner.razorpayAccountId
    const amountPaise = Math.round(booking.totalAmount * 100)

    if (ownerAccountId && amountPaise > 0) {
      try {
        const transfer = await razorpay.payments.transfer(razorpayPaymentId, {
          transfers: [
            {
              account: ownerAccountId,
              amount: amountPaise,
              currency: 'INR',
              notes: {
                bookingId: booking.id,
                libraryId: booking.libraryId,
                seatLabel: booking.seat.label,
              },
              linked_account_notes: ['bookingId'],
              on_hold: false,
            },
          ],
        })
        transferId = (transfer as unknown as { items: Array<{ id: string }> }).items?.[0]?.id ?? null
      } catch (transferErr) {
        // Transfer failure should not cancel the booking — log and proceed
        console.error('Razorpay transfer to owner failed:', transferErr)
      }
    } else if (!ownerAccountId) {
      console.warn(
        `Library owner ${booking.library.owner.id} has no Razorpay linked account. Payment held in platform.`
      )
    }

    // ── 6. Determine membership plan for activation ───────────────────────
    // Use the library's first active plan to create membership.
    // If the library has no plan, membership cannot be created — booking
    // still proceeds so the student is not left in a bad state.
    const plan = booking.library.membershipPlans[0] ?? null

    // ── 7. Run everything in a transaction ────────────────────────────────
    const updatedBooking = await prisma.$transaction(async (tx) => {
      // Step 1: Create Payment record first
      const payment = await tx.payment.create({
        data: {
          studentId: session.id,
          bookingId: bookingId,
          amount: booking.totalAmount,
          status: 'PAID',
          paymentMethod: 'RAZORPAY',
          paymentType: 'SEAT_BOOKING',
          gatewayOrderId: razorpayOrderId,
          gatewayPaymentId: razorpayPaymentId,
          gatewaySignature: razorpaySignature,
          gatewayTransferId: transferId,
          platformFee: 0,
          ownerAmount: booking.totalAmount,
        },
      })

      // Step 2: Confirm booking (now payment exists)
      const confirmed = await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: 'CONFIRMED',
        },
        include: {
          library: { select: { name: true, city: true, owner: { include: { user: true } } } },
          seat: true,
          payment: true,
        },
      })

      // Step 3: Activate / create StudentMembership with dates = booking dates
      if (plan) {
        // Check if student already has an active membership at this library
        const existingMembership = await tx.studentMembership.findFirst({
          where: {
            studentId: session.id,
            libraryId: booking.libraryId,
            status: 'ACTIVE',
            endDate: { gte: new Date() },
          },
        })

        if (existingMembership) {
          // Extend existing membership end date to the booking end time if later
          const newEnd =
            booking.endTime > existingMembership.endDate ? booking.endTime : existingMembership.endDate
          await tx.studentMembership.update({
            where: { id: existingMembership.id },
            data: { endDate: newEnd },
          })
        } else {
          // Create new membership tied to this booking's period
          const membership = await tx.studentMembership.create({
            data: {
              studentId: session.id,
              libraryId: booking.libraryId,
              planId: plan.id,
              status: 'ACTIVE',
              startDate: booking.startTime,
              endDate: booking.endTime,
              paidAmount: booking.totalAmount,
            },
          })
          
          // Link payment to membership
          await tx.payment.update({
            where: { id: payment.id },
            data: { membershipId: membership.id },
          })
        }
      }

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
          message: `₹${booking.totalAmount} received for seat ${booking.seat.label}`,
          data: {
            bookingId: booking.id,
            amount: booking.totalAmount,
            transferId,
            transferredToAccount: !!transferId,
          },
        },
      })
    } catch {
      // Notification failure must not fail the payment confirmation
    }

    return Response.json({ booking: updatedBooking, success: true, transferId })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : ''
    if (msg === 'UNAUTHORIZED') return Response.json({ error: 'Unauthorized' }, { status: 401 })
    if (msg === 'FORBIDDEN') return Response.json({ error: 'Forbidden' }, { status: 403 })
    console.error('Booking payment error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
