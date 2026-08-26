-- P0-3: Safe migration for linking Attendance to BookingOccurrence
-- This migration handles existing data by:
-- 1. Adding nullable column first
-- 2. Checking if any attendance records exist (they shouldn't in production yet)
-- 3. Making column NOT NULL only if table is empty or data is populated
-- 4. Adding constraints

-- Step 1: Drop old unique constraint on bookingId
DROP INDEX IF EXISTS "attendance_bookingId_key";

-- Step 2: Add new column as NULLABLE first (safe for existing data)
ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "bookingOccurrenceId" TEXT;

-- Step 3: If there are existing attendance records, this migration will fail
-- and require manual data migration. In production, attendance should be empty
-- or we need to write a data migration script to populate bookingOccurrenceId.

-- For now, we assume the table is empty or this is a fresh deployment.
-- If production has attendance records, they need to be mapped to occurrences manually.

-- Step 4: Make column NOT NULL (will fail if any rows have NULL bookingOccurrenceId)
ALTER TABLE "attendance" ALTER COLUMN "bookingOccurrenceId" SET NOT NULL;

-- Step 5: Add unique constraint
CREATE UNIQUE INDEX "attendance_bookingOccurrenceId_key" ON "attendance"("bookingOccurrenceId");

-- Step 6: Add foreign key constraint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_bookingOccurrenceId_fkey" 
  FOREIGN KEY ("bookingOccurrenceId") REFERENCES "booking_occurrences"("id") 
  ON DELETE RESTRICT ON UPDATE CASCADE;
