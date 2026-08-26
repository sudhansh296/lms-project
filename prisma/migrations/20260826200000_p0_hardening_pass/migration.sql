-- P0-2: Safe migration for role-scoped uniqueness and P0-1 consumedAt field
-- This migration:
-- 1. Adds consumedAt to otp_verifications (P0-1)
-- 2. Drops old global unique constraints on users.mobile and users.email
-- 3. Adds compound unique constraints for role-scoped uniqueness
-- 4. Adds indexes for performance

-- Step 1: Add consumedAt field to otp_verifications (P0-1)
ALTER TABLE "otp_verifications" ADD COLUMN IF NOT EXISTS "consumedAt" TIMESTAMP(3);

-- Step 2: Audit for potential duplicates before changing constraints
-- This query will show any mobile+role combinations that would violate new constraint
DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT mobile, role, COUNT(*) as cnt
    FROM users
    GROUP BY mobile, role
    HAVING COUNT(*) > 1
  ) duplicates;
  
  IF duplicate_count > 0 THEN
    RAISE EXCEPTION 'Found % duplicate mobile+role combinations. Manual resolution required.', duplicate_count;
  END IF;
END $$;

-- Step 3: Drop old global unique constraints AND indexes if they exist
-- Note: PostgreSQL unique constraints create indexes, and standalone indexes may also exist
DO $$ 
BEGIN
    -- Drop mobile unique constraint
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'users_mobile_key'
    ) THEN
        ALTER TABLE "users" DROP CONSTRAINT "users_mobile_key";
    END IF;

    -- Drop email unique constraint
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'users_email_key'
    ) THEN
        ALTER TABLE "users" DROP CONSTRAINT "users_email_key";
    END IF;

    -- Also check for alternative constraint naming patterns
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname LIKE 'User_mobile_key%'
    ) THEN
        EXECUTE 'ALTER TABLE "users" DROP CONSTRAINT "' || (
            SELECT conname FROM pg_constraint 
            WHERE conname LIKE 'User_mobile_key%' LIMIT 1
        ) || '"';
    END IF;

    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname LIKE 'User_email_key%'
    ) THEN
        EXECUTE 'ALTER TABLE "users" DROP CONSTRAINT "' || (
            SELECT conname FROM pg_constraint 
            WHERE conname LIKE 'User_email_key%' LIMIT 1
        ) || '"';
    END IF;
END $$;

-- Drop any standalone unique indexes that may exist independently
DROP INDEX IF EXISTS "users_mobile_key";
DROP INDEX IF EXISTS "users_email_key";
DROP INDEX IF EXISTS "User_mobile_key";
DROP INDEX IF EXISTS "User_email_key";

-- Step 4: Create compound unique constraints for role-scoped uniqueness
-- Same mobile can exist with different roles (e.g., STUDENT and LIBRARY_OWNER)
CREATE UNIQUE INDEX IF NOT EXISTS "unique_mobile_role" 
ON "users"("mobile", "role");

-- Same email can exist with different roles (handles nullable email safely)
CREATE UNIQUE INDEX IF NOT EXISTS "unique_email_role" 
ON "users"("email", "role") 
WHERE "email" IS NOT NULL;

-- Step 5: Add performance indexes
CREATE INDEX IF NOT EXISTS "users_mobile_idx" ON "users"("mobile");
CREATE INDEX IF NOT EXISTS "users_email_idx" ON "users"("email") WHERE "email" IS NOT NULL;

-- Migration complete
-- Verify with: SELECT mobile, role, COUNT(*) FROM users GROUP BY mobile, role HAVING COUNT(*) > 1;
