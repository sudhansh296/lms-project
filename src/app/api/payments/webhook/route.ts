import { NextRequest } from 'next/server'
import crypto from 'crypto'
import prisma from '@/lib/prisma'
import { calculatePaymentBreakdown } from '@/lib/payment-calc'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    const signature = request.headers.get('x-razorpay-signature') ?? ''
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET ?? ''

    // Verify webhook signature
    if (webhookSecret && webhookSecret !== 'your_webhook_secret_from_razorpay_dashboard') {
      const expected = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawBody)
        .digest('hex')
      if (expected !== signature) {
        return Response.json({ error: 'Invalid webhook signature' }, { status: 400 })
      }
    } else {
      console.warn('RAZORPAY_WEBHOOK_SECRET not configured — skipping signature verification')
    }

    const event = JSON.parse(rawBody)
    const eventType: string = event.event
    const payment = event.payload?.payment?.entity

    // ── payment.captured ──────────────────────────────────────────────────
    if (eventType === 'payment.captured' && payment) {
      const razorpayPaymentId: string = payment.id
      const razorpayOrderId: string = payment.order_id
      const notes = payment.notes ?? {}

      // Idempotency: skip if already processed
      const existingStudentPayment = await prisma.payment.findFirst({
        where: { gatewayPaymentId: razorpayPaymentId, status: 'PAID' },
      })
      const existingOwnerPayment = await prisma.ownerPayment.findFirst({
        where: { gatewayPaymentId: razorpayPaymentId, status: 'PAID' },
      })
      if (existingStudentPayment || existingOwnerPayment) {
        return Response.json({ received: true, alreadyProcessed: true })
      }

      const paymentType: string = notes.type ?? ''

      if (paymentType === 'SUBSCRIPTION') {
        // Owner subscription payment — keep this handler for backward compat
        // (owner subscription payments are no longer created by new code but
        //  may still arrive for historically created orders)
        const ownerPayment = await prisma.ownerPayment.findFirst({
          where: { gatewayOrderId: razorpayOrderId },
        })
        if (ownerPayment) {
          await prisma.ownerPayment.update({
            where: { id: ownerPayment.id },
            data: { status: 'PAID', gatewayPaymentId: razorpayPaymentId },
          })
        }
      } else {
        // Seat booking payment — fallback if the browser /pay callback never arrived.
        const bookingIdFromNotes: string | undefined = notes.bookingId

        if (bookingIdFromNotes) {
          const pendingBooking = await prisma.booking.findFirst({
            where: { id: bookingIdFromNotes, status: 'PENDING' },
          })

          if (pendingBooking) {
            const breakdown = calculatePaymentBreakdown(pendingBooking.totalAmount)

            await prisma.$transaction(async (tx) => {
              await tx.payment.create({
                data: {
                  studentId: pendingBooking.studentId,
                  bookingId: pendingBooking.id,
                  amount: breakdown.totalAmount,
                  status: 'PAID',
                  paymentMethod: 'RAZORPAY',
                  paymentType: 'SEAT_BOOKING',
                  gatewayOrderId: razorpayOrderId,
                  gatewayPaymentId: razorpayPaymentId,
                  baseAmount: breakdown.baseAmount,
                  platformFee: breakdown.platformFee,
                  processingFee: breakdown.processingFee,
                  gstAmount: breakdown.gstAmount,
                  ownerAmount: breakdown.ownerAmount,
                },
              })

              await tx.booking.update({
                where: { id: pendingBooking.id },
                data: { status: 'CONFIRMED' },
              })
            })
          }
        } else {
          // Legacy fallback: match by gatewayOrderId on existing Payment row
          const studentPayment = await prisma.payment.findFirst({
            where: { gatewayOrderId: razorpayOrderId, status: { not: 'PAID' } },
            include: { booking: true },
          })
          if (studentPayment && studentPayment.bookingId && studentPayment.booking) {
            await prisma.payment.update({
              where: { id: studentPayment.id },
              data: { status: 'PAID', gatewayPaymentId: razorpayPaymentId },
            })
            await prisma.booking.update({
              where: { id: studentPayment.bookingId },
              data: { status: 'CONFIRMED' },
            })
          }
        }
      }
    }

    // ── payment.failed ────────────────────────────────────────────────────
    if (eventType === 'payment.failed' && payment) {
      await prisma.payment.updateMany({
        where: { gatewayOrderId: payment.order_id, status: 'PENDING' },
        data: { status: 'FAILED' },
      })
      await prisma.ownerPayment.updateMany({
        where: { gatewayOrderId: payment.order_id, status: 'PENDING' },
        data: { status: 'FAILED' },
      })
    }

    // ── transfer.processed ────────────────────────────────────────────────
    if (eventType === 'transfer.processed') {
      const transfer = event.payload?.transfer?.entity
      if (transfer) {
        await prisma.payment.updateMany({
          where: { gatewayTransferId: transfer.id },
          data: { gatewayTransferId: transfer.id },
        })
      }
    }

    return Response.json({ received: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return Response.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
