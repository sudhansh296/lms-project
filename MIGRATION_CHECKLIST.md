# Database Migration Checklist - Monthly Rate Pricing Model

## Migration: 20260826000001_monthly_rate_pricing_model

### ⚠️ CRITICAL - READ BEFORE EXECUTING

This migration adds new fields for the monthly rate pricing model and corrects the money flow.

### Pre-Migration Checklist

- [ ] **Backup Database**: Ensure you have a recent backup of the production database
- [ ] **Review Migration**: The migration SQL file has been created at `prisma/migrations/20260826000001_monthly_rate_pricing_model/migration.sql`
- [ ] **Test Environment**: Ideally test this migration on a staging database first
- [ ] **Active Users**: Consider maintenance window if you have active users booking seats

### What This Migration Does

1. **Adds to `membership_plans` table:**
   - `pricing_model` (LEGACY_PACKAGE | MONTHLY_RATE) - defaults all existing to LEGACY_PACKAGE
   - `monthly_price` - price per month for MONTHLY_RATE plans

2. **Adds to `bookings` table:**
   - `selected_months` - number of months student purchased
   - `monthly_price_snapshot` - immutable snapshot of monthly price at booking time

3. **Adds to `payments` table:**
   - `monthly_price` - monthly rate for reconciliation
   - `selected_months` - months purchased for this payment
   - `gateway_fee` - Razorpay gateway fee recovered from student
   - `gateway_fee_gst` - GST on gateway fee

4. **Creates indexes:**
   - `membership_plans_pricing_model_idx` - faster lookups by pricing model
   - `membership_plans_library_daily_unique_idx` - prevents duplicate monthly rates for same library+duration

### Safety Features

✅ **Backward Compatible**: All existing plans marked as LEGACY_PACKAGE and continue working
✅ **Non-Breaking**: New columns are nullable (except pricing_model which has default)
✅ **Preserves Data**: No data deletion, only additions
✅ **Indexed**: Added indexes for performance

### Post-Migration Verification

After running the migration, verify:

1. All existing membership plans have `pricing_model = 'LEGACY_PACKAGE'`
2. All existing bookings and payments are unaffected
3. No foreign key constraint violations
4. Application starts without errors

### Rolling Back

If issues occur, Prisma doesn't support automatic rollback. You would need to:
1. Restore from backup, OR
2. Manually run reverse migration (drop columns/indexes)

**Reverse migration SQL (if needed):**
```sql
-- Drop indexes
DROP INDEX IF EXISTS "membership_plans_library_daily_unique_idx";
DROP INDEX IF EXISTS "membership_plans_pricing_model_idx";

-- Drop columns from payments
ALTER TABLE "payments" DROP COLUMN IF EXISTS "gateway_fee_gst";
ALTER TABLE "payments" DROP COLUMN IF EXISTS "gateway_fee";
ALTER TABLE "payments" DROP COLUMN IF EXISTS "selected_months";
ALTER TABLE "payments" DROP COLUMN IF EXISTS "monthly_price";

-- Drop columns from bookings
ALTER TABLE "bookings" DROP COLUMN IF EXISTS "monthly_price_snapshot";
ALTER TABLE "bookings" DROP COLUMN IF EXISTS "selected_months";

-- Drop columns from membership_plans
ALTER TABLE "membership_plans" DROP COLUMN IF EXISTS "monthly_price";
ALTER TABLE "membership_plans" DROP COLUMN IF EXISTS "pricing_model";
```

### Execution Command

**Development/Testing:**
```bash
npx prisma migrate dev
```

**Production:**
```bash
npx prisma migrate deploy
```

### Environment Variables Required

Ensure these are in your `.env` file:
- `PLATFORM_COMMISSION_PERCENT=5`
- `RAZORPAY_PG_FEE_PERCENT=2`
- `RAZORPAY_PG_FEE_GST_PERCENT=18`
- `CUSTOMER_PAYS_GATEWAY_FEE=true`
- `MAX_BOOKING_MONTHS=24`

---

## Ready to Execute?

Once you've completed the checklist and are ready to proceed, run:

```bash
npx prisma migrate dev
```

Or in production:

```bash
npx prisma migrate deploy
```
