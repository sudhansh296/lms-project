/**
 * Payment calculation for student seat bookings.
 *
 * Business model:
 *   baseAmount   = planPrice + seatExtraAmount
 *   platformFee  = PLATFORM_COMMISSION_PERCENT % of baseAmount  (default 5%)
 *   totalAmount  = baseAmount + platformFee
 *   ownerAmount  = baseAmount  (owner always gets full agreed price)
 *
 * The owner sets the plan price. The platform fee is added on top.
 * processingFee/gstAmount remain 0 by default.
 */

export interface PaymentBreakdown {
  /** Owner-defined plan package price */
  planPrice: number
  /** Seat extra charge (from seat.extraPrice) */
  seatExtraAmount: number
  /** planPrice + seatExtraAmount */
  baseAmount: number
  /** Platform service commission */
  platformFee: number
  /** Payment processing fee (0 unless configured) */
  processingFee: number
  /** GST on processing fee (0 unless configured) */
  gstAmount: number
  /** Total the student pays — rounded to 2dp */
  totalAmount: number
  /** Amount transferred to the library owner */
  ownerAmount: number
}

function round2(v: number): number {
  return Math.round(v * 100) / 100
}

export function calculatePaymentBreakdown(
  planPrice: number,
  seatExtraAmount = 0
): PaymentBreakdown {
  const commissionPct = parseFloat(process.env.PLATFORM_COMMISSION_PERCENT ?? '5')
  const processingPct = parseFloat(process.env.RAZORPAY_PROCESSING_FEE_PERCENT ?? '0')
  const gstPct = processingPct > 0
    ? parseFloat(process.env.RAZORPAY_PROCESSING_FEE_GST_PERCENT ?? '0')
    : 0

  const pPrice      = round2(planPrice)
  const sExtra      = round2(seatExtraAmount)
  const baseAmount  = round2(pPrice + sExtra)
  const platformFee = round2(baseAmount * commissionPct / 100)

  const processingBase = round2(baseAmount + platformFee)
  const processingFee  = processingPct > 0 ? round2(processingBase * processingPct / 100) : 0
  const gstAmount      = gstPct > 0 ? round2(processingFee * gstPct / 100) : 0

  const totalAmount = round2(baseAmount + platformFee + processingFee + gstAmount)

  return {
    planPrice: pPrice,
    seatExtraAmount: sExtra,
    baseAmount,
    platformFee,
    processingFee,
    gstAmount,
    totalAmount,
    ownerAmount: baseAmount,
  }
}

/** Rupees → paise. Always an integer. */
export function toPaise(rupees: number): number {
  return Math.round(rupees * 100)
}

export function formatRupees(amount: number): string {
  return `₹${amount.toFixed(2)}`
}
