/**
 * Payment calculation utilities for student seat bookings.
 *
 * All fee percentages are read from environment variables so they can be
 * changed without touching application code.
 *
 * Fee structure (student pays everything transparently):
 *   baseAmount             — library's agreed seat price
 *   platformFee            — PLATFORM_COMMISSION_PERCENT % of baseAmount
 *   processingFee          — RAZORPAY_PROCESSING_FEE_PERCENT % of (baseAmount + platformFee)
 *   gstAmount              — RAZORPAY_PROCESSING_FEE_GST_PERCENT % of processingFee
 *   totalAmount            — baseAmount + platformFee + processingFee + gstAmount
 *
 * The owner's settlement is the baseAmount only.
 * The platform retains the platformFee.
 * The processingFee + gstAmount covers Razorpay's charges.
 */

export interface PaymentBreakdown {
  /** Library's agreed seat price */
  baseAmount: number
  /** Platform/service commission (5% of base) */
  platformFee: number
  /** Razorpay / payment processing fee */
  processingFee: number
  /** GST on the processing fee */
  gstAmount: number
  /** Total the student pays — sum of all above, rounded to 2dp */
  totalAmount: number
  /** Amount that will be transferred to the library owner */
  ownerAmount: number
}

/** Round to 2 decimal places to avoid floating-point display errors */
function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Calculate the full payment breakdown for a student seat booking.
 *
 * @param baseSeatPrice  The library's configured seat/plan price in INR.
 */
export function calculatePaymentBreakdown(baseSeatPrice: number): PaymentBreakdown {
  const commissionPct = parseFloat(process.env.PLATFORM_COMMISSION_PERCENT ?? '5')
  const processingPct = parseFloat(process.env.RAZORPAY_PROCESSING_FEE_PERCENT ?? '2')
  const gstPct        = parseFloat(process.env.RAZORPAY_PROCESSING_FEE_GST_PERCENT ?? '18')

  const baseAmount  = round2(baseSeatPrice)
  const platformFee = round2(baseAmount * commissionPct / 100)

  // Processing fee applies to the subtotal that Razorpay will charge on
  // (base + platform fee — i.e. the full amount collected in that order)
  const processingBase = round2(baseAmount + platformFee)
  const processingFee  = round2(processingBase * processingPct / 100)
  const gstAmount      = round2(processingFee * gstPct / 100)

  const totalAmount = round2(baseAmount + platformFee + processingFee + gstAmount)

  return {
    baseAmount,
    platformFee,
    processingFee,
    gstAmount,
    totalAmount,
    ownerAmount: baseAmount, // owner always gets the agreed base price
  }
}

/**
 * Convert a rupee amount to paise (Razorpay uses smallest currency unit).
 * Always returns an integer.
 */
export function toPaise(rupees: number): number {
  return Math.round(rupees * 100)
}

/**
 * Format a rupee amount to exactly 2 decimal places as a string.
 * Use this for display only — not for arithmetic.
 */
export function formatRupees(amount: number): string {
  return `₹${amount.toFixed(2)}`
}
