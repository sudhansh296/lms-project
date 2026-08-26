/**
 * Central payment finalization service.
 *
 * Both the browser /pay callback AND the Razorpay webhook use the SAME
 * functions here so no business logic is duplicated.
 *
 * Responsibilities:
 *   - finalizeCapturedBookingPayment  — confirm booking, create Payment row, trigger transfer
 *   - attemptOwnerSettlement          — transfer base amount to owner's linked account
 *   - processFailedBookingPayment     — mark booking CANCELLED, payment FAILED
 *   - cancelExpiredBookingHold        — release expired PENDING holds
 */

import prisma from './prisma'
import { calculatePaymentBreakdown, toPaise } from './payment-calc'
import {
  fetchPayment,
  transferPaymentToOwner,
  refundPayment,
  RzpPaymentEntity,
} from './razorpay-route'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FinalizeResult {
  success: boolean
  alreadyProcessed?: boolean
  breakdown?: ReturnType<typeof calculatePaymentBreakdown>
  transferId?: string | null
  error?: string
}

// ─── Finalize captured booking payment ───────────────────────────────────────

/**
 * Called after Razorpay signature is verified.
 *
 * Steps:
 *   1. Idempotency check — return existing result if already processed
 *   2. Fetch payment from Razorpay and verify amount + status
 *   3. Double-check seat is still available
 *   4. DB transaction: Payment=PAID, Booking=CONFIRMED, settlementStatus=PENDING
 *   5. Attempt Route transfer to owner
 *   6. Update settlementStatus to PROCESSED or RETRY_REQUIRED
 */
export async function finalizeCapturedBookingPayment(params: {
  bookingId: string
  studentId: string
  razorpayOrderId: string
  razorpayPaymentId: string
  razorpaySignature: string
  /** Expected total in paise (from our local order) */
  expectedAmountPaise: number
}): Promise<FinalizeResult> {
  const {
    bookingId,
    studentId,
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
    expectedAmountPaise,
  } = params

  // ── 1. Idempotency ─────────────────────────────────────────────────────────
  const existingPayment = await prisma.payment.findFirst({
    where: { gatewayPaymentId: razorpayPaymentId },
  })
  if (existingPayment) {
    const bd = existingPayment.baseAmount !== null
      ? calculatePaymentBreakdown(existingPayment.baseAmount)
      : undefined
    return {
      success: true,
      alreadyProcessed: true,
      breakdown: bd,
      transferId: existingPayment.gatewayTransferId ?? null,
    }
  }

  // ── 2. Fetch and verify from Razorpay ──────────────────────────────────────
  let rzpPayment: RzpPaymentEntity
  try {
    rzpPayment = await fetchPayment(razorpayPaymentId)
  } catch (err) {
    console.error('Failed to fetch payment from Razorpay:', err)
    return { success: false, error: 'Could not verify payment with Razorpay' }
  }

  if (rzpPayment.status !== 'captured') {
    return { success: false, error: `Payment not captured (status: ${rzpPayment.status})` }
  }
  if (rzpPayment.order_id !== razorpayOrderId) {
    return { success: false, error: 'Payment order ID mismatch' }
  }
  if (rzpPayment.currency !== 'INR') {
    return { success: false, error: 'Unexpected currency' }
  }
  if (rzpPayment.amount !== expectedAmountPaise) {
    console.error(`Amount mismatch: expected ${expectedAmountPaise} got ${rzpPayment.amount}`)
    return { success: false, error: 'Payment amount does not match expected amount' }
  }

  // ── 3. Load booking ────────────────────────────────────────────────────────
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, studentId },
    include: {
      library: {
        include: {
          owner: { select: { id: true, userId: true, razorpayAccountId: true, settlementReady: true } },
        },
      },
      seat: { select: { label: true } },
    },
  })

  if (!booking) {
    return { success: false, error: 'Booking not found' }
  }

  // Already confirmed (e.g. webhook arrived first)
  if (booking.status === 'CONFIRMED' || booking.status === 'ACTIVE') {
    const existingPmt = await prisma.payment.findFirst({ where: { bookingId } })
    const bd = existingPmt?.baseAmount !== null && existingPmt?.baseAmount !== undefined
      ? calculatePaymentBreakdown(existingPmt.baseAmount)
      : undefined
    return {
      success: true,
      alreadyProcessed: true,
      breakdown: bd,
      transferId: existingPmt?.gatewayTransferId ?? null,
    }
  }

  if (booking.status === 'CANCELLED') {
    // Payment captured but booking was cancelled (seat race). Initiate refund.
    try {
      await refundPayment(razorpayPaymentId, expectedAmountPaise, {
        reason: 'Seat unavailable at confirmation time',
        bookingId,
      })
    } catch (refundErr) {
      console.error('Auto-refund failed:', refundErr)
    }
    return { success: false, error: 'Booking was cancelled — refund initiated' }
  }

  // ── 4. Double-check seat availability ─────────────────────────────────────
  const seatConflict = await prisma.booking.findFirst({
    where: {
      seatId: booking.seatId,
      id: { not: bookingId },
      status: { in: ['CONFIRMED', 'ACTIVE'] },
      AND: [{ startTime: { lt: booking.endTime } }, { endTime: { gt: booking.startTime } }],
    },
  })

  if (seatConflict) {
    // Seat taken after payment — cancel booking and auto-refund
    await prisma.booking.update({ where: { id: bookingId }, data: { status: 'CANCELLED' } })
    try {
      await refundPayment(razorpayPaymentId, expectedAmountPaise, {
        reason: 'Seat booked by another student',
        bookingId,
      })
    } catch (refundErr) {
      console.error('Auto-refund after seat race failed:', refundErr)
    }
    return { success: false, error: 'Seat just booked by another student — refund initiated' }
  }

  // ── 5. Recalculate breakdown (never trust frontend) ────────────────────────
  const breakdown = calculatePaymentBreakdown(booking.totalAmount)

  // ── 6. DB transaction — Payment + Booking ─────────────────────────────────
  await prisma.$transaction(async (tx) => {
    await tx.payment.create({
      data: {
        studentId,
        bookingId,
        amount: breakdown.totalAmount,
        status: 'PAID',
        paymentMethod: 'RAZORPAY',
        paymentType: 'SEAT_BOOKING',
        gatewayOrderId: razorpayOrderId,
        gatewayPaymentId: razorpayPaymentId,
        gatewaySignature: razorpaySignature,
        baseAmount: breakdown.baseAmount,
        platformFee: breakdown.platformFee,
        processingFee: 0,
        gstAmount: 0,
        ownerAmount: breakdown.ownerAmount,
        settlementStatus: 'PENDING',
        transferAttempts: 0,
      },
    })

    await tx.booking.update({
      where: { id: bookingId },
      data: { status: 'CONFIRMED' },
    })
  })

  // ── 7. Attempt Route transfer after committing DB state ────────────────────
  const transferResult = await attemptOwnerSettlement({
    bookingId,
    razorpayPaymentId,
    ownerAccountId: booking.library.owner.razorpayAccountId,
    ownerAmountPaise: toPaise(breakdown.ownerAmount),
    meta: {
      bookingId,
      libraryId: booking.libraryId,
      seatLabel: booking.seat.label,
    },
  })

  // ── 8. Notify owner ────────────────────────────────────────────────────────
  try {
    await prisma.notification.create({
      data: {
        userId: booking.library.owner.userId,
        libraryId: booking.libraryId,
        type: 'PAYMENT_RECEIVED',
        title: 'Booking Payment Received',
        message: `₹${breakdown.totalAmount.toFixed(2)} received for seat ${booking.seat.label} (your share: ₹${breakdown.ownerAmount.toFixed(2)})`,
        data: {
          bookingId,
          totalAmount: breakdown.totalAmount,
          ownerAmount: breakdown.ownerAmount,
          platformFee: breakdown.platformFee,
          transferId: transferResult.transferId,
        },
      },
    })
  } catch { /* non-critical */ }

  return {
    success: true,
    breakdown,
    transferId: transferResult.transferId,
  }
}

// ─── Attempt owner settlement ─────────────────────────────────────────────────

export async function attemptOwnerSettlement(params: {
  bookingId: string
  razorpayPaymentId: string
  ownerAccountId: string | null | undefined
  ownerAmountPaise: number
  meta: Record<string, string>
}): Promise<{ transferId: string | null }> {
  const { bookingId, razorpayPaymentId, ownerAccountId, ownerAmountPaise, meta } = params

  // Find the payment row for this booking
  const payment = await prisma.payment.findFirst({ where: { bookingId } })
  if (!payment) return { transferId: null }

  // Idempotency — already settled
  if (payment.settlementStatus === 'PROCESSED' && payment.gatewayTransferId) {
    return { transferId: payment.gatewayTransferId }
  }

  if (!ownerAccountId || ownerAmountPaise <= 0) {
    const reason = !ownerAccountId
      ? 'Owner has no Razorpay linked account'
      : 'Owner amount is zero'
    console.warn(`Settlement skipped for booking ${bookingId}: ${reason}`)
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        settlementStatus: 'RETRY_REQUIRED',
        transferFailureReason: reason,
        transferAttempts: { increment: 1 },
      },
    })
    return { transferId: null }
  }

  try {
    const transfer = await transferPaymentToOwner(
      razorpayPaymentId,
      ownerAccountId,
      ownerAmountPaise,
      meta
    )

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        gatewayTransferId: transfer.id,
        settlementStatus: 'PROCESSED',
        settledAt: new Date(),
        transferAttempts: { increment: 1 },
      },
    })

    return { transferId: transfer.id }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    console.error(`Owner transfer failed for booking ${bookingId}:`, reason)

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        settlementStatus: 'RETRY_REQUIRED',
        transferFailureReason: reason,
        transferAttempts: { increment: 1 },
      },
    })

    return { transferId: null }
  }
}

// ─── Process failed payment ───────────────────────────────────────────────────

export async function processFailedBookingPayment(gatewayOrderId: string): Promise<void> {
  // Mark any PENDING payment for this order as FAILED
  await prisma.payment.updateMany({
    where: { gatewayOrderId, status: 'PENDING' },
    data: { status: 'FAILED', settlementStatus: 'NOT_REQUIRED' },
  })

  // Find linked pending booking and release it
  const payment = await prisma.payment.findFirst({
    where: { gatewayOrderId },
    select: { bookingId: true },
  })
  if (payment?.bookingId) {
    await prisma.booking.updateMany({
      where: { id: payment.bookingId, status: 'PENDING' },
      data: { status: 'CANCELLED' },
    })
  }
}

// ─── Cancel expired pending holds ────────────────────────────────────────────

/**
 * Release PENDING bookings whose holdExpiresAt has passed.
 * Call this from a cron job or on-demand before checking availability.
 */
export async function cancelExpiredBookingHolds(): Promise<number> {
  const result = await prisma.booking.updateMany({
    where: {
      status: 'PENDING',
      holdExpiresAt: { lt: new Date() },
    },
    data: { status: 'CANCELLED' },
  })
  if (result.count > 0) {
    // Also mark any associated PENDING payments as FAILED
    await prisma.payment.updateMany({
      where: {
        booking: { status: 'CANCELLED' },
        status: 'PENDING',
      },
      data: { status: 'FAILED', settlementStatus: 'NOT_REQUIRED' },
    })
  }
  return result.count
}
