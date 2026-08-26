/**
 * Payment calculation utilities for student seat bookings.
 *
 * Business model (per task spec):
 *   baseAmount   = library's configured seat price
 *   platformFee  = PLATFORM_COMMISSION_PERCENT % of baseAmount  (default 5%)
 *   totalAmount  = baseAmount + platformFee
 *   ownerAmount  = baseAmount  (owner always gets the agreed base price)
 *
 * processingFee and gstAmount are kept as zero by default.
 * They remain in the Payment schema for future configurability but
 * are NOT added to the student total unless explicitly configured
 * via RAZORPAY_PROCESSING_FEE_PERCENT > 0.
 */

export interface PaymentBreakdown {
  /** Library's agreed seat price */
  baseAmount: number
  /** Platform/service commission */
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

/** Round to 2 decimal places — prevents floating-point display errors */
function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export function calculatePaymentBreakdown(baseSeatPrice: number): PaymentBreakdown {
  const commissionPct = parseFloat(process.env.PLATFORM_COMMISSION_PERCENT ?? '5')

  // Processing fee only applied if explicitly non-zero in env
  const processingPct = parseFloat(process.env.RAZORPAY_PROCESSING_FEE_PERCENT ?? '0')
  const gstPct        = processingPct > 0
    ? parseFloat(process.env.RAZORPAY_PROCESSING_FEE_GST_PERCENT ?? '0')
    : 0

  const baseAmount  = round2(baseSeatPrice)
  const platformFee = round2(baseAmount * commissionPct / 100)

  const processingBase = round2(baseAmount + platformFee)
  const processingFee  = processingPct > 0 ? round2(processingBase * processingPct / 100) : 0
  const gstAmount      = gstPct > 0 ? round2(processingFee * gstPct / 100) : 0

  const totalAmount = round2(baseAmount + platformFee + processingFee + gstAmount)

  return {
    baseAmount,
    platformFee,
    processingFee,
    gstAmount,
    totalAmount,
    ownerAmount: baseAmount,
  }
}

/** Rupees → paise (Razorpay smallest unit). Always an integer. */
export function toPaise(rupees: number): number {
  return Math.round(rupees * 100)
}

/** Format for display only — not for arithmetic */
export function formatRupees(amount: number): string {
  return `₹${amount.toFixed(2)}`
}
