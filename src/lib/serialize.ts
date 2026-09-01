/**
 * Recursively converts all Prisma Decimal objects AND numeric strings
 * returned from Decimal columns to plain JS numbers so they serialize
 * correctly over the wire as JSON numbers (not strings or {s,e,c} objects).
 *
 * Prisma Decimal with pg driver adapter serializes as plain strings like "1500.00".
 * Prisma Decimal in other adapters exposes .toNumber() method.
 *
 * Usage in API routes:
 *   return Response.json(serialize({ plans }))
 */

// Keys that are always strings — never convert these even if they look numeric
const STRING_KEYS = new Set([
  'mobile', 'phone', 'id', 'userId', 'studentId', 'ownerId', 'libraryId',
  'bookingId', 'planId', 'seatId', 'paymentId', 'membershipId', 'referralCode',
  'bookingRef', 'studentStudentId', 'gatewayOrderId', 'gatewayPaymentId',
  'gatewayTransferId', 'refundId', 'razorpayAccountId', 'razorpayStakeholderId',
  'razorpayProductId', 'pincode', 'postalCode', 'openTime', 'closeTime',
  'fixedStartTime', 'fixedEndTime', 'dailyStartTime', 'dailyEndTime',
])

// Decimal column names — always numeric
const DECIMAL_KEYS = new Set([
  'price', 'monthlyPrice', 'extraPrice', 'basePrice',
  'totalAmount', 'paidAmount', 'amount', 'refundAmount',
  'platformFee', 'ownerAmount', 'gatewayFee', 'gatewayFeeGst',
  'processingFee', 'gstAmount', 'baseAmount', 'planPrice',
  'seatExtraAmount', 'planPriceSnapshot', 'seatExtraSnapshot', 'monthlyPriceSnapshot',
])

export function serialize<T>(data: T, parentKey?: string): T {
  if (data === null || data === undefined) return data

  // Prisma Decimal instance (has .toNumber() method)
  if (
    typeof data === 'object' &&
    !Array.isArray(data) &&
    typeof (data as any).toNumber === 'function'
  ) {
    return (data as any).toNumber() as unknown as T
  }

  // String value on a known Decimal key → convert to number
  if (
    typeof data === 'string' &&
    parentKey &&
    DECIMAL_KEYS.has(parentKey) &&
    !STRING_KEYS.has(parentKey) &&
    data !== '' &&
    !isNaN(Number(data))
  ) {
    return Number(data) as unknown as T
  }

  if (Array.isArray(data)) {
    return data.map(item => serialize(item, parentKey)) as unknown as T
  }

  if (typeof data === 'object' && data !== null) {
    if (data instanceof Date) return data

    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      result[key] = serialize(value, key)
    }
    return result as T
  }

  return data
}
