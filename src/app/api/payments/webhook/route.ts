import { NextRequest } from 'next/server'
import crypto from 'crypto'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    const signature = request.headers.get('x-razorpay-signature') ?? ''
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET ?? ''

    // Verify webhook signature
    if (webhookSecret) {
      const expected = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawBody)
        .digest('hex')
      if (expected !== signature) {
        return Response.json({ error: 'Invalid webhook signature' }, { status: 400 })
      }
    } else {
      console.warn('RAZORPAY_WEBHOOK_SECRET not set — skipping verification')
    }

    const event = JSON.parse(rawBody)
    const eventType: string = event.event
    const payment = event.payload?.payment?.entity

    // ── payment.captured ────────────────────────────────────────────────────
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

      // Determine payment type from notes
      const paymentType: string = notes.type ?? ''

      if (paymentType === 'SUBSCRIPTION') {
        // Owner subscription payment — confirm via webhook as fallback
        const ownerPayment = await prisma.ownerPayment.findFirst({
          where: { gatewayOrderId: razorpayOrderId },
        })
        if (ownerPayment) {
          await prisma.ownerPayment.update({
            where: { id: ownerPayment.id },
            data: { status: 'PAID', gatewayPaymentId: razorpayPaymentId, gatewayOrderId: razorpayOrderId },
          })
        }
      } else {
        // Seat booking payment — fallback if browser /pay callback never arrived.
        // At this point NO Payment row exists yet — find the PENDING Booking by
        // the Razorpay order notes, confirm it and create Payment + Membership.
        const bookingIdFromNotes: string | undefined = notes.bookingId

        if (bookingIdFromNotes) {
          const pendingBooking = await prisma.booking.findFirst({
            where: { id: bookingIdFromNotes, status: 'PENDING' },
            include: {
              library: {
                include: {
                  membershipPlans: {
                    where: { isActive: true },
                    orderBy: { price: 'asc' },
                    take: 1,
                  },
                },
              },
            },
          })

          if (pendingBooking) {
            const plan = pendingBooking.library.membershipPlans[0] ?? null

            await prisma.$transaction(async (tx) => {
              // Create payment first
              const payment = await tx.payment.create({
                data: {
                  studentId: pendingBooking.studentId,
                  bookingId: pendingBooking.id,
                  amount: pendingBooking.totalAmount,
                  status: 'PAID',
                  paymentMethod: 'RAZORPAY',
                  paymentType: 'SEAT_BOOKING',
                  gatewayOrderId: razorpayOrderId,
                  gatewayPaymentId: razorpayPaymentId,
                },
              })

              // Confirm booking
              await tx.booking.update({
                where: { id: pendingBooking.id },
                data: { status: 'CONFIRMED' },
              })

              // Activate membership
              if (plan) {
                const existingMembership = await tx.studentMembership.findFirst({
                  where: {
                    studentId: pendingBooking.studentId,
                    libraryId: pendingBooking.libraryId,
                    status: 'ACTIVE',
                    endDate: { gte: new Date() },
                  },
                })
                if (existingMembership) {
                  const newEnd =
                    pendingBooking.endTime > existingMembership.endDate
                      ? pendingBooking.endTime
                      : existingMembership.endDate
                  await tx.studentMembership.update({
                    where: { id: existingMembership.id },
                    data: { endDate: newEnd },
                  })
                } else {
                  const membership = await tx.studentMembership.create({
                    data: {
                      studentId: pendingBooking.studentId,
                      libraryId: pendingBooking.libraryId,
                      planId: plan.id,
                      status: 'ACTIVE',
                      startDate: pendingBooking.startTime,
                      endDate: pendingBooking.endTime,
                      paidAmount: pendingBooking.totalAmount,
                    },
                  })
                  
                  // Link payment to membership
                  await tx.payment.update({
                    where: { id: payment.id },
                    data: { membershipId: membership.id },
                  })
                }
              }
            })
          }
        } else {
          // Legacy fallback: if notes.bookingId is missing, try matching by gatewayOrderId
          // on an already-existing Payment row (old flow compatibility)
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

    // ── payment.failed ──────────────────────────────────────────────────────
    if (eventType === 'payment.failed' && payment) {
      // Mark any pending payment records as FAILED
      await prisma.payment.updateMany({
        where: { gatewayOrderId: payment.order_id, status: 'PENDING' },
        data: { status: 'FAILED' },
      })
      await prisma.ownerPayment.updateMany({
        where: { gatewayOrderId: payment.order_id, status: 'PENDING' },
        data: { status: 'FAILED' },
      })
    }

    // ── transfer.processed ─────────────────────────────────────────────────
    // Fired when Razorpay completes transfer to library owner's linked account
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
