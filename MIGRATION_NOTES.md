# StudyLib Database Migration Strategy

## Overview

This document describes the database migration strategy for StudyLib, covering two distinct deployment scenarios:

- **CASE A**: Existing production database (already has tables and data)
- **CASE B**: Fresh empty database (new deployment)

## Current State (HEAD: cf3c20b)

### Migration History
```
prisma/migrations/
├── 20260826181238_p0_attendance_occurrence_link/
│   └── migration.sql (adds BookingOccurrence support)
└── 20260826200000_p0_hardening_pass/
    └── migration.sql (role-scoped uniqueness + OTP consumedAt)
```

### Schema Version
- Prisma Schema: Uses compound unique constraints for role-scoped auth
- Latest Migration: 20260826200000_p0_hardening_pass

---

## CASE A: Existing Production Database

### Scenario
You have a running production database with:
- Existing User, Booking, Payment, Library tables
- Live customer data
- Possible old unique constraints on `users.mobile` and `users.email`

### Migration Command
```bash
# Production deployment (applies only new migrations)
npx prisma migrate deploy
```

### What Happens
1. Prisma checks `_prisma_migrations` table
2. Applies only migrations NOT yet recorded
3. For 20260826200000_p0_hardening_pass:
   - Safely drops old global unique constraints/indexes
   - Creates new role-scoped unique indexes
   - Adds `consumedAt` to `otp_verifications`
4. Existing data preserved, no table recreation

### Safety Features
- ✅ Duplicate check before applying constraints
- ✅ IF EXISTS guards prevent errors if constraints already dropped
- ✅ No data deletion
- ✅ Transactional (rolls back on failure)

### Rollback Strategy
```bash
# If migration fails, manually investigate
psql $DATABASE_URL

# Check constraint status
SELECT conname, contype FROM pg_constraint 
WHERE conrelid = 'users'::regclass;

# Check index status
SELECT indexname FROM pg_indexes 
WHERE tablename = 'users';

# Manual rollback (if needed)
BEGIN;
-- Drop new role-scoped indexes
DROP INDEX IF EXISTS unique_mobile_role;
DROP INDEX IF EXISTS unique_email_role;

-- Recreate old global constraints (only if required for rollback)
ALTER TABLE users ADD CONSTRAINT users_mobile_key UNIQUE (mobile);
ALTER TABLE users ADD CONSTRAINT users_email_key UNIQUE (email);
COMMIT;
```

### Pre-Migration Verification
```bash
# 1. Backup database
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Check for duplicates that would violate new constraints
psql $DATABASE_URL -c "
SELECT mobile, role, COUNT(*) as count 
FROM users 
GROUP BY mobile, role 
HAVING COUNT(*) > 1;"

# 3. Check current migration status
npx prisma migrate status
```

### Post-Migration Verification
```bash
# Verify unique indexes applied
psql $DATABASE_URL -c "
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'users' AND indexname LIKE '%mobile%' OR indexname LIKE '%email%';"

# Test role-scoped uniqueness
psql $DATABASE_URL -c "
-- Should succeed: same mobile, different roles
INSERT INTO users (id, mobile, role, ...) VALUES 
  ('test1', '9999999999', 'STUDENT', ...),
  ('test2', '9999999999', 'LIBRARY_OWNER', ...);

-- Should fail: same mobile, same role
INSERT INTO users (id, mobile, role, ...) VALUES 
  ('test3', '9999999999', 'STUDENT', ...); -- duplicate key error
"
```

---

## CASE B: Fresh Empty Database

### Scenario
You are setting up StudyLib on:
- New staging environment
- New developer machine
- New production instance (first deployment)

### Initial Setup Command
```bash
# Generate Prisma Client
npx prisma generate

# Apply all migrations to empty database
npx prisma migrate deploy
```

### What Happens
1. Prisma creates `_prisma_migrations` tracking table
2. Applies ALL migrations in chronological order:
   - Base schema creation (implicit from first migration)
   - 20260826181238_p0_attendance_occurrence_link
   - 20260826200000_p0_hardening_pass
3. Creates all tables with current schema structure
4. No old constraints to drop (they never existed)

### Seed Data (Optional)
```bash
# After migrations, seed initial data
npx prisma db seed
```

### Alternative: Prisma DB Push (Development Only)
```bash
# For rapid development iteration (NOT for production)
npx prisma db push

# This bypasses migration history
# Use only on throwaway development databases
```

---

## Staging Environment

### Recommended Workflow
Staging should mirror production migration strategy (CASE A).

```bash
# 1. Clone production database structure
pg_dump $PROD_DB_URL --schema-only | psql $STAGING_DB_URL

# 2. Copy recent sanitized data (optional)
# ... sanitization logic ...

# 3. Apply migrations
npx prisma migrate deploy

# 4. Verify
npx prisma migrate status
```

---

## Migration Development Workflow

### Creating New Migrations

```bash
# 1. Modify prisma/schema.prisma
# 2. Create migration
npx prisma migrate dev --name descriptive_name

# This generates a new migration in prisma/migrations/
# Review the generated SQL before committing
```

### Testing Migration Before Production

```bash
# 1. Create test database
createdb studylib_migration_test

# 2. Restore production schema
pg_dump $PROD_DB_URL --schema-only | psql studylib_migration_test

# 3. Test migration
DATABASE_URL="postgresql://...studylib_migration_test" npx prisma migrate deploy

# 4. Verify results
psql studylib_migration_test -c "\d+ users"

# 5. Drop test database
dropdb studylib_migration_test
```

---

## Common Issues & Solutions

### Issue: "Migration already applied"
```bash
# Check migration status
npx prisma migrate status

# If needed, mark migration as applied without running
npx prisma migrate resolve --applied 20260826200000_p0_hardening_pass
```

### Issue: "Constraint already exists"
The migration uses `IF EXISTS` guards, but if you still encounter errors:

```sql
-- Manually drop conflicting constraints
DROP INDEX IF EXISTS users_mobile_key CASCADE;
DROP INDEX IF EXISTS users_email_key CASCADE;

-- Then retry
npx prisma migrate deploy
```

### Issue: "Duplicate key violations"
If you have actual duplicate mobile+role combinations:

```sql
-- Find duplicates
SELECT mobile, role, COUNT(*), string_agg(id, ', ') as user_ids
FROM users
GROUP BY mobile, role
HAVING COUNT(*) > 1;

-- Manual resolution required:
-- Option 1: Change mobile number for duplicates
-- Option 2: Merge user accounts (careful with foreign keys)
-- Option 3: Delete invalid duplicates
```

---

## Baseline Strategy for Existing Production

If your production database was created with `db push` and has NO migration history:

```bash
# 1. Create baseline migration matching current schema
npx prisma migrate diff \
  --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma \
  --script > baseline.sql

# 2. Create migrations directory structure (if needed)
mkdir -p prisma/migrations/0_baseline

# 3. Move baseline
mv baseline.sql prisma/migrations/0_baseline/migration.sql

# 4. Mark baseline as applied (don't actually run it)
npx prisma migrate resolve --applied 0_baseline

# 5. Now future migrations will work normally
npx prisma migrate deploy
```

---

## Production Deployment Checklist

### Pre-Deployment
- [ ] Database backup completed
- [ ] Migration tested on staging
- [ ] Duplicate data audit passed
- [ ] Rollback plan documented
- [ ] Maintenance window scheduled (if needed)
- [ ] Team notified

### Deployment
- [ ] Application maintenance mode enabled
- [ ] `npx prisma migrate deploy` executed
- [ ] Migration success verified
- [ ] Post-migration verification queries run
- [ ] Application restarted
- [ ] Smoke tests passed

### Post-Deployment
- [ ] Monitor error logs for 15 minutes
- [ ] Verify user registration working
- [ ] Verify login for both roles working
- [ ] Check no performance degradation
- [ ] Maintenance mode disabled

### Rollback Decision Points
**Rollback if:**
- Migration fails to apply
- Duplicate key violations in production data
- Application errors spike >10% after deployment
- Critical functionality broken

**Do NOT rollback for:**
- Minor UI glitches (can be fixed forward)
- Individual user issues (investigate separately)
- Performance degradation <5% (investigate then decide)

---

## Commands Quick Reference

```bash
# Check migration status
npx prisma migrate status

# Apply pending migrations (production)
npx prisma migrate deploy

# Create new migration (development)
npx prisma migrate dev --name my_migration

# Mark migration as applied without running
npx prisma migrate resolve --applied MIGRATION_NAME

# Mark migration as rolled back
npx prisma migrate resolve --rolled-back MIGRATION_NAME

# Generate Prisma Client
npx prisma generate

# Validate schema
npx prisma validate

# Format schema
npx prisma format

# Open Prisma Studio
npx prisma studio
```

---

## Additional Resources

- [Prisma Migrate Docs](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Prisma Migrate in Production](https://www.prisma.io/docs/guides/migrate/production-troubleshooting)
- [Baselining a Database](https://www.prisma.io/docs/guides/migrate/production-troubleshooting#baselining-a-database)

---

**Last Updated**: 2026-08-26  
**Schema Version**: cf3c20b72f99371d7c74702bea5b16f4fe5ad348
