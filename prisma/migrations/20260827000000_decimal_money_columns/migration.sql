-- Float → Decimal migration for all financial columns
-- Precision: DECIMAL(12,2) — up to ₹9,999,999,999.99 (ten billion), 2 decimal places
-- Geometry columns (x, y, width, height, rotation, latitude, longitude) remain FLOAT — not financial
-- This migration is safe to run on an empty or live database; ALTER TYPE USING handles existing float data.

-- ── libraries ───────────────────────────────────────────────────────────────
ALTER TABLE "libraries"
  ALTER COLUMN "basePrice" TYPE DECIMAL(12,2) USING "basePrice"::DECIMAL(12,2);

-- ── seats ────────────────────────────────────────────────────────────────────
ALTER TABLE "seats"
  ALTER COLUMN "extraPrice" TYPE DECIMAL(12,2) USING "extraPrice"::DECIMAL(12,2);

-- ── membership_plans ─────────────────────────────────────────────────────────
ALTER TABLE "membership_plans"
  ALTER COLUMN "price"         TYPE DECIMAL(12,2) USING "price"::DECIMAL(12,2),
  ALTER COLUMN "monthly_price" TYPE DECIMAL(12,2) USING "monthly_price"::DECIMAL(12,2);

-- ── student_memberships ───────────────────────────────────────────────────────
ALTER TABLE "student_memberships"
  ALTER COLUMN "paidAmount" TYPE DECIMAL(12,2) USING "paidAmount"::DECIMAL(12,2);

-- ── bookings ──────────────────────────────────────────────────────────────────
ALTER TABLE "bookings"
  ALTER COLUMN "planPriceSnapshot"    TYPE DECIMAL(12,2) USING "planPriceSnapshot"::DECIMAL(12,2),
  ALTER COLUMN "seatExtraSnapshot"    TYPE DECIMAL(12,2) USING "seatExtraSnapshot"::DECIMAL(12,2),
  ALTER COLUMN "monthly_price_snapshot" TYPE DECIMAL(12,2) USING "monthly_price_snapshot"::DECIMAL(12,2),
  ALTER COLUMN "totalAmount"          TYPE DECIMAL(12,2) USING "totalAmount"::DECIMAL(12,2);

-- ── payments ──────────────────────────────────────────────────────────────────
ALTER TABLE "payments"
  ALTER COLUMN "amount"          TYPE DECIMAL(12,2) USING "amount"::DECIMAL(12,2),
  ALTER COLUMN "refundAmount"    TYPE DECIMAL(12,2) USING "refundAmount"::DECIMAL(12,2),
  ALTER COLUMN "platformFee"     TYPE DECIMAL(12,2) USING "platformFee"::DECIMAL(12,2),
  ALTER COLUMN "ownerAmount"     TYPE DECIMAL(12,2) USING "ownerAmount"::DECIMAL(12,2),
  ALTER COLUMN "gateway_fee"     TYPE DECIMAL(12,2) USING "gateway_fee"::DECIMAL(12,2),
  ALTER COLUMN "gateway_fee_gst" TYPE DECIMAL(12,2) USING "gateway_fee_gst"::DECIMAL(12,2),
  ALTER COLUMN "processingFee"   TYPE DECIMAL(12,2) USING "processingFee"::DECIMAL(12,2),
  ALTER COLUMN "gstAmount"       TYPE DECIMAL(12,2) USING "gstAmount"::DECIMAL(12,2),
  ALTER COLUMN "baseAmount"      TYPE DECIMAL(12,2) USING "baseAmount"::DECIMAL(12,2),
  ALTER COLUMN "planPrice"       TYPE DECIMAL(12,2) USING "planPrice"::DECIMAL(12,2),
  ALTER COLUMN "monthly_price"   TYPE DECIMAL(12,2) USING "monthly_price"::DECIMAL(12,2),
  ALTER COLUMN "seatExtraAmount" TYPE DECIMAL(12,2) USING "seatExtraAmount"::DECIMAL(12,2);

-- ── owner_payments ────────────────────────────────────────────────────────────
ALTER TABLE "owner_payments"
  ALTER COLUMN "amount" TYPE DECIMAL(12,2) USING "amount"::DECIMAL(12,2);

-- ── subscription_plans ───────────────────────────────────────────────────────
ALTER TABLE "subscription_plans"
  ALTER COLUMN "price" TYPE DECIMAL(12,2) USING "price"::DECIMAL(12,2);

-- ── Razorpay ID uniqueness (from task 1 in this hardening pass) ──────────────
-- Only add if not already present (safe to run multiple times via IF NOT EXISTS pattern)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'payments' AND indexname = 'payments_gatewayOrderId_key'
  ) THEN
    CREATE UNIQUE INDEX "payments_gatewayOrderId_key" ON "payments"("gatewayOrderId") WHERE "gatewayOrderId" IS NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'payments' AND indexname = 'payments_gatewayPaymentId_key'
  ) THEN
    CREATE UNIQUE INDEX "payments_gatewayPaymentId_key" ON "payments"("gatewayPaymentId") WHERE "gatewayPaymentId" IS NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'payments' AND indexname = 'payments_gatewayTransferId_key'
  ) THEN
    CREATE UNIQUE INDEX "payments_gatewayTransferId_key" ON "payments"("gatewayTransferId") WHERE "gatewayTransferId" IS NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'payments' AND indexname = 'payments_refundId_key'
  ) THEN
    CREATE UNIQUE INDEX "payments_refundId_key" ON "payments"("refundId") WHERE "refundId" IS NOT NULL;
  END IF;
END $$;
