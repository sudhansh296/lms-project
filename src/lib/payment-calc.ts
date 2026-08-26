/**
 * Payment calculation for student seat bookings.
 *
 * CORRECTED Business Model (August 2026):
 * 
 * 1. libraryBaseAmount = (monthlyPrice × months) + seatExtraAmount
 * 2. platformCommission = 5% OF libraryBaseAmount (deducted FROM owner)
 * 3. ownerAmount = libraryBaseAmount - platformCommission (owner receives 95%)
 * 4. gatewayFee + gatewayGST = Razorpay processing cost (recovered FROM student)
 * 5. studentTotal = libraryBaseAmount + gatewayFee + gatewayGST
 *
 * Key changes from previous WRONG implementation:
 * - Platform commission is NOW deducted from owner's earnings (not added to student)
 * - Gateway fees are separate and recovered from student via gross-up
 * - Owner receives exactly 95% of the library base amount via Razorpay Route
 *
 * Example: ₹450 library charge
 *   Student pays: ~₹460.88 (₹450 + ₹10.88 gateway recovery)
 *   After Razorpay PG fee: ~₹450 remains
 *   Platform commission: ₹22.50 (5% of ₹450)
 *   Owner receives: ₹427.50 (95% of ₹450)
 */

export interface PaymentBreakdown {
  /** Monthly rate × months (or legacy plan price) */
  planPrice: number
  /** Number of months selected (for MONTHLY_RATE plans) */
  months: number
  /** Monthly rate per month (for MONTHLY_RATE plans) */
  monthlyPrice: number
  /** Seat extra charge (from seat.extraPrice) */
  seatExtraAmount: number
  /** Library base amount = planPrice + seatExtraAmount */
  libraryBaseAmount: number
  /** Platform commission = 5% of libraryBaseAmount (deducted FROM owner) */
  platformCommission: number
  /** Owner settlement amount = libraryBaseAmount - platformCommission */
  ownerAmount: number
  /** Razorpay gateway fee (recovered from student) */
  gatewayFee: number
  /** GST on gateway fee (recovered from student) */
  gatewayFeeGst: number
  /** Total student pays = libraryBaseAmount + gatewayFee + gatewayFeeGst */
  studentTotal: number
  
  // Legacy compatibility fields
  /** @deprecated Use libraryBaseAmount */
  baseAmount: number
  /** @deprecated Use platformCommission */
  platformFee: number
  /** @deprecated Use gatewayFee */
  processingFee: number
  /** @deprecated Use gatewayFeeGst */
  gstAmount: number
  /** @deprecated Use studentTotal */
  totalAmount: number
}

function round2(v: number): number {
  return Math.round(v * 100) / 100
}

/**
 * Calculate Razorpay gateway fee gross-up using integer paise arithmetic.
 * 
 * Given a desired net amount (libraryBaseAmount), calculates the total
 * payment amount needed so that after Razorpay deducts its fee + GST,
 * approximately the net amount remains.
 * 
 * Standard Razorpay pricing: 2% + 18% GST on fee = ~2.36% effective
 * 
 * Formula: studentTotal = libraryBaseAmount / (1 - effectiveRate)
 * 
 * Uses paise (integer) arithmetic to avoid floating point errors.
 */
function calculateGatewayGrossUp(
  libraryBaseAmountRupees: number,
  gatewayRatePercent: number,
  gstRatePercent: number
): { studentTotal: number; gatewayFee: number; gatewayFeeGst: number } {
  // Convert to paise
  const basePaise = Math.round(libraryBaseAmountRupees * 100)
  
  // Calculate effective deduction rate
  const gatewayRate = gatewayRatePercent / 100
  const gstRate = gstRatePercent / 100
  const effectiveRate = gatewayRate * (1 + gstRate)
  
  // Gross up: studentTotal = base / (1 - effectiveRate)
  const grossUpFactor = 1 / (1 - effectiveRate)
  let studentTotalPaise = Math.ceil(basePaise * grossUpFactor)
  
  // Calculate fees on this total
  let gatewayFeePaise = Math.ceil(studentTotalPaise * gatewayRate)
  let gatewayGstPaise = Math.ceil(gatewayFeePaise * gstRate)
  
  // Verify: studentTotal - gatewayFee - gatewayGst >= base
  let netPaise = studentTotalPaise - gatewayFeePaise - gatewayGstPaise
  
  // Adjust if needed (should rarely happen with proper gross-up)
  while (netPaise < basePaise && studentTotalPaise < basePaise * 1.1) {
    studentTotalPaise++
    gatewayFeePaise = Math.ceil(studentTotalPaise * gatewayRate)
    gatewayGstPaise = Math.ceil(gatewayFeePaise * gstRate)
    netPaise = studentTotalPaise - gatewayFeePaise - gatewayGstPaise
  }
  
  // Try to reduce by 1 paise if we're over-recovering
  const testTotal = studentTotalPaise - 1
  const testFee = Math.ceil(testTotal * gatewayRate)
  const testGst = Math.ceil(testFee * gstRate)
  const testNet = testTotal - testFee - testGst
  if (testNet >= basePaise) {
    studentTotalPaise = testTotal
    gatewayFeePaise = testFee
    gatewayGstPaise = testGst
  }
  
  return {
    studentTotal: studentTotalPaise / 100,
    gatewayFee: gatewayFeePaise / 100,
    gatewayFeeGst: gatewayGstPaise / 100,
  }
}

/**
 * Calculate payment breakdown for both monthly rate and legacy package pricing.
 * 
 * @param planPrice - For MONTHLY_RATE: monthly price. For LEGACY_PACKAGE: total package price
 * @param seatExtraAmount - One-time seat premium charge
 * @param options - Optional: months (for MONTHLY_RATE), monthlyPrice (for MONTHLY_RATE)
 */
export function calculatePaymentBreakdown(
  planPrice: number,
  seatExtraAmount: number = 0,
  options?: { months?: number; monthlyPrice?: number }
): PaymentBreakdown {
  // Load configurable rates
  const platformCommissionPct = parseFloat(process.env.PLATFORM_COMMISSION_PERCENT ?? '5')
  const gatewayFeePct = parseFloat(process.env.RAZORPAY_PG_FEE_PERCENT ?? '2')
  const gatewayGstPct = parseFloat(process.env.RAZORPAY_PG_FEE_GST_PERCENT ?? '18')
  const customerPaysGatewayFee = (process.env.CUSTOMER_PAYS_GATEWAY_FEE ?? 'true') === 'true'
  
  // Extract options
  const months = options?.months ?? 1
  const monthlyPrice = options?.monthlyPrice ?? planPrice
  
  // 1. Calculate library base amount
  const pPrice = round2(planPrice)
  const sExtra = round2(seatExtraAmount)
  const libraryBaseAmount = round2(pPrice + sExtra)
  
  // 2. Calculate platform commission (deducted FROM owner)
  const platformCommission = round2(libraryBaseAmount * platformCommissionPct / 100)
  
  // 3. Calculate owner amount (what they receive via Route)
  const ownerAmount = round2(libraryBaseAmount - platformCommission)
  
  // 4. Calculate gateway fee recovery (if customer pays)
  let gatewayFee = 0
  let gatewayFeeGst = 0
  let studentTotal = libraryBaseAmount
  
  if (customerPaysGatewayFee && gatewayFeePct > 0) {
    const grossUp = calculateGatewayGrossUp(libraryBaseAmount, gatewayFeePct, gatewayGstPct)
    studentTotal = round2(grossUp.studentTotal)
    gatewayFee = round2(grossUp.gatewayFee)
    gatewayFeeGst = round2(grossUp.gatewayFeeGst)
  }
  
  return {
    planPrice: pPrice,
    months,
    monthlyPrice: round2(monthlyPrice),
    seatExtraAmount: sExtra,
    libraryBaseAmount,
    platformCommission,
    ownerAmount,
    gatewayFee,
    gatewayFeeGst,
    studentTotal,
    
    // Legacy compatibility
    baseAmount: libraryBaseAmount,
    platformFee: platformCommission,
    processingFee: gatewayFee,
    gstAmount: gatewayFeeGst,
    totalAmount: studentTotal,
  }
}

/** Rupees → paise. Always an integer. */
export function toPaise(rupees: number): number {
  return Math.round(rupees * 100)
}

export function formatRupees(amount: number): string {
  return `₹${amount.toFixed(2)}`
}

/**
 * Legacy plan calculation (for LEGACY_PACKAGE plans).
 * Treats the plan.price as a fixed package price (not monthly rate).
 */
export function calculateLegacyPackageBreakdown(
  packagePrice: number,
  seatExtraAmount: number = 0
): PaymentBreakdown {
  // For legacy plans, treat package price as the planPrice with no months multiplier
  return calculatePaymentBreakdown(packagePrice, seatExtraAmount)
}
