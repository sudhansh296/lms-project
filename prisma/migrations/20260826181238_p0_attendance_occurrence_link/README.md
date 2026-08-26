# P0-3: Attendance → BookingOccurrence Migration

## What Changed
- Attendance now links to BookingOccurrence (one-to-one) instead of just Booking
- This enables daily check-in/out tracking for recurring bookings
- A 3-month booking now has 90+ attendance records (one per day), not just 1

## Schema Changes
- **attendance.bookingOccurrenceId**: New column (String, @unique, required)
- **attendance.bookingId**: Constraint changed from @unique to regular (one-to-many)
- **booking.attendance**: Renamed to `attendances` (one-to-many relation)
- **booking_occurrences.status**: Now includes "COMPLETED" status

## Migration Safety

### Development/Staging
```bash
# Use db push for development (no migration history)
npx prisma db push
```

### Production
```bash
# Step 1: Check if safe to migrate
npx tsx scripts/apply-p0-migrations.ts

# Step 2: If safe, apply migration
npx prisma migrate deploy

# Step 3: Verify
npx prisma migrate status
```

## Rollback Plan
If this migration causes issues:

```sql
-- 1. Remove new constraint
ALTER TABLE "attendance" DROP CONSTRAINT IF EXISTS "attendance_bookingOccurrenceId_fkey";
DROP INDEX IF EXISTS "attendance_bookingOccurrenceId_key";

-- 2. Remove new column
ALTER TABLE "attendance" DROP COLUMN IF EXISTS "bookingOccurrenceId";

-- 3. Restore old constraint
CREATE UNIQUE INDEX "attendance_bookingId_key" ON "attendance"("bookingId");
```

## Data Migration (if needed)
If production has existing attendance records, use this query to map them:

```sql
-- This would need to be run BEFORE making bookingOccurrenceId NOT NULL
UPDATE attendance a
SET "bookingOccurrenceId" = (
  SELECT bo.id 
  FROM booking_occurrences bo 
  WHERE bo."bookingId" = a."bookingId" 
  ORDER BY bo."startTime" ASC 
  LIMIT 1
)
WHERE a."bookingOccurrenceId" IS NULL;
```

**Note**: This maps each attendance to the FIRST occurrence of the booking. 
Manual review may be needed if attendance was tracked mid-booking.
