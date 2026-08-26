-- Migration: Convert MembershipPlan to monthly rate pricing model
-- This adds new fields for the corrected business model where:
-- - Owner sets a MONTHLY price for each daily duration
-- - Student chooses how many months to purchase
-- - Platform takes 5% commission FROM owner (not added to student)

-- Add new fields for monthly rate pricing
ALTER TABLE "membership_plans" ADD COLUMN "pricing_model" TEXT DEFAULT 'LEGACY_PACKAGE';
ALTER TABLE "membership_plans" ADD COLUMN "monthly_price" DOUBLE PRECISION;

-- Add comment for clarity
COMMENT ON COLUMN "membership_plans"."pricing_model" IS 'LEGACY_PACKAGE for old duration-based plans, MONTHLY_RATE for new monthly pricing';
COMMENT ON COLUMN "membership_plans"."monthly_price" IS 'Price per month for this daily duration tier (authoritative for MONTHLY_RATE plans)';

-- Mark all existing plans as LEGACY_PACKAGE
UPDATE "membership_plans" SET "pricing_model" = 'LEGACY_PACKAGE' WHERE "pricing_model" IS NULL OR "pricing_model" = '';

-- Set NOT NULL constraint now that we've populated the field
ALTER TABLE "membership_plans" ALTER COLUMN "pricing_model" SET NOT NULL;

-- Add fields to Booking for storing selected months
ALTER TABLE "bookings" ADD COLUMN "selected_months" INTEGER;
ALTER TABLE "bookings" ADD COLUMN "monthly_price_snapshot" DOUBLE PRECISION;

-- Add fields to Payment for better reconciliation
ALTER TABLE "payments" ADD COLUMN "monthly_price" DOUBLE PRECISION;
ALTER TABLE "payments" ADD COLUMN "selected_months" INTEGER;

-- Add gateway fee tracking (separate from platform commission)
ALTER TABLE "payments" ADD COLUMN "gateway_fee" DOUBLE PRECISION DEFAULT 0;
ALTER TABLE "payments" ADD COLUMN "gateway_fee_gst" DOUBLE PRECISION DEFAULT 0;

COMMENT ON COLUMN "bookings"."selected_months" IS 'Number of months student purchased (for MONTHLY_RATE plans)';
COMMENT ON COLUMN "bookings"."monthly_price_snapshot" IS 'Monthly rate at time of booking (immutable)';
COMMENT ON COLUMN "payments"."monthly_price" IS 'Monthly rate used for this payment';
COMMENT ON COLUMN "payments"."selected_months" IS 'Number of months purchased';
COMMENT ON COLUMN "payments"."gateway_fee" IS 'Razorpay payment gateway fee (recovered from student)';
COMMENT ON COLUMN "payments"."gateway_fee_gst" IS 'GST on gateway fee (recovered from student)';

-- Create index for faster plan lookups by pricing model
CREATE INDEX IF NOT EXISTS "membership_plans_pricing_model_idx" ON "membership_plans"("pricing_model") WHERE "is_active" = true;

-- Create unique constraint to prevent duplicate monthly rates for same library+duration
-- Note: Only enforced for MONTHLY_RATE plans, allows multiple LEGACY_PACKAGE plans
CREATE UNIQUE INDEX IF NOT EXISTS "membership_plans_library_daily_unique_idx" 
ON "membership_plans"("library_id", "daily_minutes") 
WHERE "pricing_model" = 'MONTHLY_RATE' AND "is_active" = true;
