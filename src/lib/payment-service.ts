/**
 * Central payment finalization service.
 * Used by both the browser /pay callback AND the Razorpay webhook.
 */
import prisma from './prisma'
import { calculatePaymentBreakdown, toPaise } from './payment-calc'
import { fetchPayment, transferPaymentToOwner, refundPayment, RzpPaymentEntity } from './razorpay-route'

export interface FinalizeResult {
  success: boolean
  alreadyProcessed?: boolean
  breakdown?: ReturnType<typeof calculatePaymentBreakdown>
  transferId?: string | null
  error?: string
}

// ─── Finalize captured booking payment ───────────────────────────────────────

export async function finalizeCapturedBookingPayment(params: {
  bookingId: string
  studentId: string
  razorpayOrderId: string
  razorpayPaymentId: string
  razorpaySignature: string
  expectedAmountPaise: number
}): Promise<FinalizeResult> {
  const { bookingId, studentId, razorpayOrderId, razorpayPaymentId, razorpaySignature, expectedAmountPaise } = params

  // ── 1. Idempotency ─────────────────────────────────────────────────────────
  const existingPayment = await prisma.payment.findFirst({
    where: { gatewayPaymentId: razorpayPaymentId },
  })
  if (existingPayment) {
    // Use stored breakdown from Payment record (never recalculate)
    const bd = {
      planPrice: existingPayment.planPrice ?? 0,
      months: existingPayment.selectedMonths ?? 1,
      monthlyPrice: existingPayment.monthlyPrice ?? existingPayment.planPrice ?? 0,
      seatExtraAmount: existingPayment.seatExtraAmount ?? 0,
      libraryBaseAmount: existingPayment.baseAmount ?? 0,
      platformCommission: existingPayment.platformFee ?? 0,
      ownerAmount: existingPayment.ownerAmount ?? 0,
      gatewayFee: existingPayment.gatewayFee ?? 0,
      gatewayFeeGst: existingPayment.gatewayFeeGst ?? 0,
      studentTotal: existingPayment.amount ?? 0,
      baseAmount: existingPayment.baseAmount ?? 0,
      platformFee: existingPayment.platformFee ?? 0,
      processingFee: existingPayment.gatewayFee ?? 0,
      gstAmount: existingPayment.gatewayFeeGst ?? 0,
      totalAmount: existingPayment.amount ?? 0,
    }
    return { success: true, alreadyProcessed: true, breakdown: bd as any, transferId: existingPayment.gatewayTransferId ?? null }
  }

  // ── 2. Fetch and verify from Razorpay ──────────────────────────────────────
  let rzpPayment: RzpPaymentEntity
  try {
    rzpPayment = await fetchPayment(razorpayPaymentId)
  } catch (err) {
    console.error('Failed to fetch payment from Razorpay:', err)
    return { success: false, error: 'Could not verify payment with Razorpay' }
  }

  if (rzpPayment.status !== 'captured')           return { success: false, error: `Payment not captured (status: ${rzpPayment.status})` }
  if (rzpPayment.order_id !== razorpayOrderId)    return { success: false, error: 'Payment order ID mismatch' }
  if (rzpPayment.currency !== 'INR')              return { success: false, error: 'Unexpected currency' }
  if (expectedAmountPaise > 0 && rzpPayment.amount !== expectedAmountPaise) {
    console.error(`Amount mismatch: expected ${expectedAmountPaise} got ${rzpPayment.amount}`)
    return { success: false, error: 'Payment amount does not match expected amount' }
  }

  // ── 3. Load booking ────────────────────────────────────────────────────────
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, studentId },
    include: {
      library: { include: { owner: { select: { id: true, userId: true, razorpayAccountId: true, settlementReady: true } } } },
      seat: { select: { label: true } },
    },
  })
  if (!booking) return { success: false, error: 'Booking not found' }

  // Already confirmed
  if (booking.status === 'CONFIRMED' || booking.status === 'ACTIVE') {
    const ep = await prisma.payment.findFirst({ where: { bookingId } })
    // Use stored breakdown from Payment record (never recalculate)
    const bd = ep ? {
      planPrice: ep.planPrice ?? 0,
      months: ep.selectedMonths ?? 1,
      monthlyPrice: ep.monthlyPrice ?? ep.planPrice ?? 0,
      seatExtraAmount: ep.seatExtraAmount ?? 0,
      libraryBaseAmount: ep.baseAmount ?? 0,
      platformCommission: ep.platformFee ?? 0,
      ownerAmount: ep.ownerAmount ?? 0,
      gatewayFee: ep.gatewayFee ?? 0,
      gatewayFeeGst: ep.gatewayFeeGst ?? 0,
      studentTotal: ep.amount ?? 0,
      baseAmount: ep.baseAmount ?? 0,
      platformFee: ep.platformFee ?? 0,
      processingFee: ep.gatewayFee ?? 0,
      gstAmount: ep.gatewayFeeGst ?? 0,
      totalAmount: ep.amount ?? 0,
    } as any : undefined
    return { success: true, alreadyProcessed: true, breakdown: bd, transferId: ep?.gatewayTransferId ?? null }
  }

  if (booking.status === 'CANCELLED') {
    try { await refundPayment(razorpayPaymentId, rzpPayment.amount, { reason: 'Seat unavailable', bookingId }) }
    catch { /* log */ }
    return { success: false, error: 'Booking was cancelled — refund initiated' }
  }

  // ── 4. Recheck seat availability via occurrences ───────────────────────────
  const myOccurrences = await prisma.bookingOccurrence.findMany({
    where: { bookingId, status: 'HELD' },
    select: { id: true, seatId: true, startTime: true, endTime: true },
  })

  for (const occ of myOccurrences) {
    // P0-2: Only HELD/CONFIRMED occurrences conflict (COMPLETED don't block new bookings)
    const conflict = await prisma.bookingOccurrence.findFirst({
      where: {
        seatId: occ.seatId,
        id: { not: occ.id },
        status: { in: ['HELD', 'CONFIRMED'] },
        startTime: { lt: occ.endTime },
        endTime:   { gt: occ.startTime },
      },
    })
    if (conflict) {
      await prisma.booking.update({ where: { id: bookingId }, data: { status: 'CANCELLED' } })
      await prisma.bookingOccurrence.updateMany({ where: { bookingId }, data: { status: 'CANCELLED' } })
      try { await refundPayment(razorpayPaymentId, rzpPayment.amount, { reason: 'Seat race', bookingId }) }
      catch { /* log */ }
      return { success: false, error: 'Seat just booked by another student — refund initiated' }
    }
  }

  // ── 5. Get breakdown from PENDING payment record ──────────────────────────
  // CRITICAL: Use stored breakdown from Payment record created at order time.
  // NEVER recalculate using current plan prices - use snapshot values.
  // FIX 10: If no PENDING payment exists, reject (don't reconstruct)
  const pendingPayment = await prisma.payment.findFirst({ where: { bookingId, status: 'PENDING' } })
  
  if (!pendingPayment) {
    console.error(`[SECURITY] No PENDING payment found for booking ${bookingId}. Rejecting.`)
    await prisma.booking.update({ where: { id: bookingId }, data: { status: 'CANCELLED' } })
    await prisma.bookingOccurrence.updateMany({ where: { bookingId }, data: { status: 'CANCELLED' } })
    try { 
      await refundPayment(razorpayPaymentId, rzpPayment.amount, { 
        reason: 'Invalid payment state - no pending payment record', 
        bookingId 
      }) 
    } catch { /* log */ }
    return { success: false, error: 'Payment record not found - booking cancelled and refund initiated' }
  }
  
  // Use stored breakdown from PENDING payment (correct approach)
  const breakdown = {
    planPrice: pendingPayment.planPrice ?? 0,
    months: pendingPayment.selectedMonths ?? 1,
    monthlyPrice: pendingPayment.monthlyPrice ?? pendingPayment.planPrice ?? 0,
    seatExtraAmount: pendingPayment.seatExtraAmount ?? 0,
    libraryBaseAmount: pendingPayment.baseAmount ?? 0,
    platformCommission: pendingPayment.platformFee ?? 0,
    ownerAmount: pendingPayment.ownerAmount ?? 0,
    gatewayFee: pendingPayment.gatewayFee ?? 0,
    gatewayFeeGst: pendingPayment.gatewayFeeGst ?? 0,
    studentTotal: pendingPayment.amount ?? 0,
    baseAmount: pendingPayment.baseAmount ?? 0,
    platformFee: pendingPayment.platformFee ?? 0,
    processingFee: pendingPayment.gatewayFee ?? 0,
    gstAmount: pendingPayment.gatewayFeeGst ?? 0,
    totalAmount: pendingPayment.amount ?? 0,
  } as ReturnType<typeof calculatePaymentBreakdown>

  // ── 6. DB transaction: Payment=PAID, Booking=CONFIRMED, Occurrences=CONFIRMED ──
  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: pendingPayment.id },
      data: {
        status: 'PAID',
        gatewayPaymentId: razorpayPaymentId,
        gatewaySignature: razorpaySignature,
        // Keep all stored breakdown values (do NOT recalculate)
        settlementStatus: 'PENDING',
      },
    })
    await tx.booking.update({ where: { id: bookingId }, data: { status: 'CONFIRMED' } })
    await tx.bookingOccurrence.updateMany({ where: { bookingId, status: 'HELD' }, data: { status: 'CONFIRMED' } })
  })

  // ── 7. Attempt Route transfer ──────────────────────────────────────────────
  const transferResult = await attemptOwnerSettlement({
    bookingId,
    razorpayPaymentId,
    ownerAccountId: booking.library.owner.razorpayAccountId,
    ownerAmountPaise: toPaise(breakdown.ownerAmount),
    meta: { bookingId, libraryId: booking.libraryId, seatLabel: booking.seat.label },
  })

  // ── 8. Notify owner ────────────────────────────────────────────────────────
  try {
    await prisma.notification.create({
      data: {
        userId: booking.library.owner.userId,
        libraryId: booking.libraryId,
        type: 'PAYMENT_RECEIVED',
        title: 'Booking Payment Received',
        message: `₹${breakdown.studentTotal.toFixed(2)} received for seat ${booking.seat.label} (your share: ₹${breakdown.ownerAmount.toFixed(2)})`,
        data: { 
          bookingId, 
          totalAmount: breakdown.studentTotal, 
          ownerAmount: breakdown.ownerAmount, 
          platformFee: breakdown.platformCommission, 
          transferId: transferResult.transferId 
        },
      },
    })
  } catch { /* non-critical */ }

  return { success: true, breakdown, transferId: transferResult.transferId }
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
  
  // FIX 13: Atomic claim - use transaction to prevent concurrent processing
  const claimed = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findFirst({ 
      where: { bookingId },
      select: { id: true, settlementStatus: true, gatewayTransferId: true }
    })
    if (!payment) return null

    // Already processed
    if (payment.settlementStatus === 'PROCESSED' && payment.gatewayTransferId) {
      return { alreadyProcessed: true, transferId: payment.gatewayTransferId }
    }

    // Already being processed
    if (payment.settlementStatus === 'PROCESSING') {
      return { alreadyProcessed: true, transferId: null }
    }

    // FIX 14: Set to PROCESSING state atomically to claim this settlement
    const updated = await tx.payment.updateMany({
      where: { 
        id: payment.id,
        settlementStatus: { in: ['PENDING', 'RETRY_REQUIRED'] } // Only claim if not already claimed
      },
      data: { settlementStatus: 'PROCESSING', transferAttempts: { increment: 1 } }
    })

    if (updated.count === 0) {
      // Another process claimed it
      return { alreadyProcessed: true, transferId: null }
    }

    return { claimed: true, paymentId: payment.id }
  })

  if (!claimed) return { transferId: null }
  if ('alreadyProcessed' in claimed) return { transferId: claimed.transferId ?? null }
  
  const paymentId = claimed.paymentId

  // Validation checks
  if (!ownerAccountId || ownerAmountPaise <= 0) {
    const reason = !ownerAccountId ? 'Owner has no Razorpay linked account' : 'Owner amount is zero'
    await prisma.payment.update({
      where: { id: paymentId },
      data: { settlementStatus: 'RETRY_REQUIRED', transferFailureReason: reason },
    })
    return { transferId: null }
  }

  // Attempt transfer
  try {
    const transfer = await transferPaymentToOwner(razorpayPaymentId, ownerAccountId, ownerAmountPaise, meta)
    
    // P1-1 FIX: Check actual transfer status from Razorpay response
    // Transfer may be created but not yet processed
    const transferStatus = transfer.status?.toLowerCase() ?? 'pending'
    
    if (transferStatus === 'processed' || transferStatus === 'settled') {
      // Transfer completed immediately
      await prisma.payment.update({
        where: { id: paymentId },
        data: { 
          gatewayTransferId: transfer.id, 
          settlementStatus: 'PROCESSED', 
          settledAt: new Date(),
        },
      })
      return { transferId: transfer.id }
    } else {
      // Transfer created but pending/processing - wait for webhook
      await prisma.payment.update({
        where: { id: paymentId },
        data: { 
          gatewayTransferId: transfer.id, 
          settlementStatus: 'PROCESSING', // Keep in PROCESSING state
          transferFailureReason: null,
        },
      })
      return { transferId: transfer.id }
    }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    await prisma.payment.update({
      where: { id: paymentId },
      data: { settlementStatus: 'RETRY_REQUIRED', transferFailureReason: reason },
    })
    return { transferId: null }
  }
}

// ─── Process failed payment ───────────────────────────────────────────────────

export async function processFailedBookingPayment(gatewayOrderId: string): Promise<void> {
  await prisma.payment.updateMany({
    where: { gatewayOrderId, status: 'PENDING' },
    data: { status: 'FAILED', settlementStatus: 'NOT_REQUIRED' },
  })
  const payment = await prisma.payment.findFirst({ where: { gatewayOrderId }, select: { bookingId: true } })
  if (payment?.bookingId) {
    await prisma.booking.updateMany({ where: { id: payment.bookingId, status: 'PENDING' }, data: { status: 'CANCELLED' } })
    await prisma.bookingOccurrence.updateMany({ where: { bookingId: payment.bookingId, status: 'HELD' }, data: { status: 'CANCELLED' } })
  }
}

// ─── Cancel expired pending holds ────────────────────────────────────────────

export async function cancelExpiredBookingHolds(): Promise<number> {
  const expired = await prisma.booking.findMany({
    where: { status: 'PENDING', holdExpiresAt: { lt: new Date() } },
    select: { id: true },
  })
  if (expired.length === 0) return 0

  const ids = expired.map(b => b.id)
  
  // Release all resources in a transaction
  await prisma.$transaction(async (tx) => {
    // Set occurrences to CANCELLED (not EXPIRED) so they don't block seats
    await tx.bookingOccurrence.updateMany({
      where: { bookingId: { in: ids }, status: 'HELD' },
      data: { status: 'CANCELLED' },
    })
    
    // Mark bookings as CANCELLED
    await tx.booking.updateMany({
      where: { id: { in: ids } },
      data: { status: 'CANCELLED' },
    })
    
    // Mark payments as FAILED
    await tx.payment.updateMany({
      where: { bookingId: { in: ids }, status: 'PENDING' },
      data: { status: 'FAILED', settlementStatus: 'NOT_REQUIRED' },
    })
  })

  return expired.length
}
