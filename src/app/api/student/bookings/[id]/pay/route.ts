/**
 * POST /api/student/bookings/:id/pay
 *
 * Called by the browser Razorpay handler after payment completes.
 *
 * Steps:
 *  1. Verify HMAC signature
 *  2. Look up expected amount from our local PENDING Payment record
 *  3. Delegate to finalizeCapturedBookingPayment (shared with webhook)
 */
import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import crypto from 'crypto'
import { finalizeCapturedBookingPayment } from '@/lib/payment-service'
import { toPaise } from '@/lib/payment-calc'

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

    // ── 1. Verify HMAC signature ───────────────────────────────────────────────
    const expectedSig = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET ?? '')
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex')

    if (expectedSig !== razorpaySignature) {
      return Response.json({ error: 'Payment verification failed — invalid signature' }, { status: 400 })
    }

    // ── 2. Look up expected amount from our local Payment record ──────────────
    const pendingPayment = await prisma.payment.findFirst({
      where: { bookingId, gatewayOrderId: razorpayOrderId },
      select: { amount: true },
    })
    const expectedAmountPaise = pendingPayment
      ? toPaise(pendingPayment.amount)
      : 0  // payment-service will still verify against Razorpay

    // ── 3. Delegate to shared finalization logic ───────────────────────────────
    const result = await finalizeCapturedBookingPayment({
      bookingId,
      studentId: session.id,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      expectedAmountPaise,
    })

    if (!result.success) {
      return Response.json({ error: result.error }, { status: 400 })
    }

    // Return booking for confirmation screen
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        library: { select: { name: true, city: true } },
        seat: { select: { label: true } },
        payment: true,
      },
    })

    return Response.json({
      success: true,
      alreadyProcessed: result.alreadyProcessed ?? false,
      booking,
      breakdown: result.breakdown,
      transferId: result.transferId,
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : ''
    if (msg === 'UNAUTHORIZED') return Response.json({ error: 'Unauthorized' }, { status: 401 })
    if (msg === 'FORBIDDEN')    return Response.json({ error: 'Forbidden' },    { status: 403 })
    console.error('Booking pay error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
