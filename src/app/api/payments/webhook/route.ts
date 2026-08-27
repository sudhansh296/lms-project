/**
 * POST /api/payments/webhook
 *
 * Razorpay webhook receiver.
 *
 * Production rule: RAZORPAY_WEBHOOK_SECRET must be set.
 * Without it the endpoint returns 500 in production rather than
 * silently skipping verification.
 *
 * Handled events:
 *   payment.captured   — finalize booking (fallback when browser callback missed)
 *   payment.failed     — mark payment/booking failed
 *   transfer.processed — mark settlement PROCESSED
 *   transfer.failed    — mark settlement RETRY_REQUIRED
 *   refund.processed   — record refund
 */
import { NextRequest } from 'next/server'
import crypto from 'crypto'
import prisma from '@/lib/prisma'
import { finalizeCapturedBookingPayment, processFailedBookingPayment } from '@/lib/payment-service'
import { toPaise } from '@/lib/payment-calc'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    const signature = request.headers.get('x-razorpay-signature') ?? ''
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET ?? ''

    // Signature verification — REQUIRED in production
    const isPlaceholder =
      !webhookSecret ||
      webhookSecret === 'your_webhook_secret_from_razorpay_dashboard'

    if (isPlaceholder) {
      if (process.env.NODE_ENV === 'production') {
        console.error('RAZORPAY_WEBHOOK_SECRET not configured in production')
        return Response.json({ error: 'Webhook secret not configured' }, { status: 500 })
      }
      console.warn('RAZORPAY_WEBHOOK_SECRET not set — skipping in development')
    } else {
      const expected = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawBody)
        .digest('hex')
      if (expected !== signature) {
        return Response.json({ error: 'Invalid webhook signature' }, { status: 400 })
      }
    }

    const event = JSON.parse(rawBody)
    const eventType: string = event.event

    // ── payment.captured ──────────────────────────────────────────────────────
    if (eventType === 'payment.captured') {
      const payment = event.payload?.payment?.entity
      if (!payment) return Response.json({ received: true })

      const razorpayPaymentId: string = payment.id
      const razorpayOrderId:   string = payment.order_id
      const notes = payment.notes ?? {}

      // Skip non-seat-booking payments (e.g. legacy subscription)
      if (notes.type === 'SUBSCRIPTION') {
        const ownerPayment = await prisma.ownerPayment.findFirst({
          where: { gatewayOrderId: razorpayOrderId },
        })
        if (ownerPayment && ownerPayment.status !== 'PAID') {
          await prisma.ownerPayment.update({
            where: { id: ownerPayment.id },
            data: { status: 'PAID', gatewayPaymentId: razorpayPaymentId },
          })
        }
        return Response.json({ received: true })
      }

      const bookingId: string | undefined = notes.bookingId
      if (!bookingId) {
        // Legacy fallback — match existing Payment by gatewayOrderId
        const existing = await prisma.payment.findFirst({
          where: { gatewayOrderId: razorpayOrderId, status: { not: 'PAID' } },
          include: { booking: { select: { studentId: true } } },
        })
        if (existing?.booking) {
          await finalizeCapturedBookingPayment({
            bookingId: existing.bookingId!,
            studentId: existing.booking.studentId,
            razorpayOrderId,
            razorpayPaymentId,
            razorpaySignature: '',   // signature already verified above
            expectedAmountPaise: toPaise(Number(existing.amount)),
          })
        }
        return Response.json({ received: true })
      }

      // Look up expected amount from local PENDING Payment
      const localPayment = await prisma.payment.findFirst({
        where: { bookingId, gatewayOrderId: razorpayOrderId },
        select: { amount: true, booking: { select: { studentId: true } } },
      })
      const expectedAmountPaise = localPayment ? toPaise(Number(localPayment.amount)) : payment.amount
      const studentId = localPayment?.booking?.studentId

      if (!studentId) {
        console.warn(`Webhook: no student found for booking ${bookingId}`)
        return Response.json({ received: true })
      }

      await finalizeCapturedBookingPayment({
        bookingId,
        studentId,
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature: '',   // already verified above
        expectedAmountPaise,
      })
    }

    // ── payment.failed ─────────────────────────────────────────────────────────
    if (eventType === 'payment.failed') {
      const payment = event.payload?.payment?.entity
      if (payment?.order_id) {
        await processFailedBookingPayment(payment.order_id)
        await prisma.ownerPayment.updateMany({
          where: { gatewayOrderId: payment.order_id, status: 'PENDING' },
          data: { status: 'FAILED' },
        })
      }
    }

    // ── transfer.processed ─────────────────────────────────────────────────────
    if (eventType === 'transfer.processed') {
      const transfer = event.payload?.transfer?.entity
      if (transfer?.id) {
        await prisma.payment.updateMany({
          where: { gatewayTransferId: transfer.id },
          data: {
            settlementStatus: 'PROCESSED',
            settledAt: new Date(),
          },
        })
      }
    }

    // ── transfer.failed ────────────────────────────────────────────────────────
    if (eventType === 'transfer.failed') {
      const transfer = event.payload?.transfer?.entity
      if (transfer?.id) {
        await prisma.payment.updateMany({
          where: { gatewayTransferId: transfer.id },
          data: {
            settlementStatus: 'RETRY_REQUIRED',
            transferFailureReason: transfer.error_code ?? 'Transfer failed',
          },
        })
      }
    }

    // ── refund.processed ───────────────────────────────────────────────────────
    if (eventType === 'refund.processed') {
      const refund = event.payload?.refund?.entity
      if (refund?.payment_id) {
        await prisma.payment.updateMany({
          where: { gatewayPaymentId: refund.payment_id },
          data: {
            status: 'REFUNDED',
            refundId: refund.id,
            refundAmount: refund.amount / 100,
          },
        })
      }
    }

    return Response.json({ received: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return Response.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
