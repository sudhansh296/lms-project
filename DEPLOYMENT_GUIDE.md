# Deployment Guide - Monthly Rate Pricing Model

## 📋 Overview

This document provides a complete guide for deploying the corrected pricing model where:
- **Owners** set monthly rates per daily duration (not fixed packages)
- **Students** choose how many months to purchase (1-24 months)
- **Platform** takes 5% commission FROM owner (not added to student)
- **Gateway fees** are recovered separately from student

---

## 🎯 Business Model Summary

### OLD (WRONG) Model:
- Owner sets package (e.g., "3 months for ₹300")
- Student pays base + 5% platform fee
- Owner receives base amount
- **Problem**: Commission added on top, making pricing unclear

### NEW (CORRECT) Model:
- Owner sets monthly rate (e.g., "₹100 per month")
- Student chooses duration (1, 3, 6, 12, etc. months)
- Platform takes 5% FROM owner's earnings
- Owner receives 95% of library base amount
- Gateway fees recovered separately from student via gross-up

### Money Flow Example (₹100/month × 3 months):
```
Student chooses: ₹100/month plan, 3 months duration
├─ Library Base Amount: ₹300
├─ Platform Commission: ₹15 (5% of ₹300, deducted FROM owner)
├─ Owner Receives: ₹285 (95% of ₹300, via Route transfer)
├─ Gateway Fee Recovery: ₹7.07 (Razorpay 2% + 18% GST)
└─ Student Pays: ₹307.07 (₹300 + ₹7.07)
```

---

## 📦 What Changed

### Database Schema Changes (17 fields added)

**MembershipPlan table:**
- `pricing_model` (LEGACY_PACKAGE | MONTHLY_RATE)
- `monthly_price` (price per month for MONTHLY_RATE plans)

**Booking table:**
- `selected_months` (number of months purchased)
- `monthly_price_snapshot` (immutable snapshot at booking time)

**Payment table:**
- `monthly_price` (for reconciliation)
- `selected_months` (duration purchased)
- `gateway_fee` (Razorpay fee recovered from student)
- `gateway_fee_gst` (GST on gateway fee)

### Code Changes (17 files modified)

#### Core Logic Files:
1. **`payment-calc.ts`** - Completely rewritten with correct money flow
2. **`payment-service.ts`** - Now uses stored snapshots (never recalculates)
3. **`validations.ts`** - Discriminated union schema for both pricing models
4. **`razorpay-route.ts`** - Verified correct (already sends ownerAmount)

#### API Routes:
5. **`api/owner/memberships/route.ts`** - Handles both pricing models
6. **`api/owner/memberships/[id]/route.ts`** - PATCH respects pricing model
7. **`api/payments/seat-order/route.ts`** - Accepts months parameter
8. **`api/owner/revenue/route.ts`** - Aggregates ownerAmount
9. **`api/owner/stats/route.ts`** - Dashboard shows owner's 95% share

#### UI Components:
10. **`owner/memberships/page.tsx`** - Monthly rate input with preview
11. **`student/library/[id]/page.tsx`** - Shows monthly rates with examples
12. **`student/library/[id]/book/page.tsx`** - Months selection step added
13. **`student/expiry/page.tsx`** - Displays monthly pricing breakdown

#### Configuration:
14. **`schema.prisma`** - New fields with proper types
15. **`migrations/...sql`** - Database migration script
16. **`.env.example`** - New environment variables
17. **`MIGRATION_CHECKLIST.md`**, **`TESTING_GUIDE.md`** - Documentation

---

## 🚀 Deployment Steps

### Phase 1: Pre-Deployment Preparation

#### 1.1 Backup Current State
```bash
# Backup database
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Create git branch for rollback reference
git checkout -b pre-monthly-pricing-backup
git add .
git commit -m "Backup before monthly pricing deployment"
git push origin pre-monthly-pricing-backup
git checkout main
```

#### 1.2 Verify Environment Variables
Add to production `.env`:
```bash
PLATFORM_COMMISSION_PERCENT=5
RAZORPAY_PG_FEE_PERCENT=2
RAZORPAY_PG_FEE_GST_PERCENT=18
CUSTOMER_PAYS_GATEWAY_FEE=true
MAX_BOOKING_MONTHS=24
```

#### 1.3 Review Code Changes
```bash
# Review all modified files
git diff main..monthly-pricing-implementation

# Count changes
git diff --stat main..monthly-pricing-implementation
```

---

### Phase 2: Staging Environment Testing

#### 2.1 Deploy to Staging
```bash
# Pull latest changes
git checkout monthly-pricing-implementation
git pull origin monthly-pricing-implementation

# Install dependencies (if any new ones)
npm install

# Run migration on staging database
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate

# Build application
npm run build

# Start application
npm run start
```

#### 2.2 Execute Test Scenarios
Follow `TESTING_GUIDE.md` and verify:

- [ ] Owner can create monthly rate plans
- [ ] Student sees monthly rates with examples
- [ ] Student can select 1-24 months
- [ ] Payment breakdown shows correct amounts
- [ ] Razorpay order created with correct total
- [ ] Payment success updates database correctly
- [ ] Route transfer sends 95% to owner
- [ ] Owner dashboard shows correct revenue
- [ ] Legacy plans still work correctly
- [ ] Expiry page shows monthly pricing

#### 2.3 Staging Acceptance Criteria
All test scenarios must pass before proceeding to production.

---

### Phase 3: Production Deployment

#### 3.1 Schedule Maintenance Window
- **Recommended**: Off-peak hours (2-4 AM local time)
- **Duration**: 30-60 minutes
- **Notification**: Inform users 24 hours in advance

#### 3.2 Pre-Production Checklist
- [ ] Database backup completed
- [ ] All tests passed on staging
- [ ] Rollback procedure documented
- [ ] Team members on standby
- [ ] Monitoring dashboards ready

#### 3.3 Production Deployment Sequence

**Step 1: Enable Maintenance Mode** (Optional)
```bash
# Put site in maintenance mode if you have one
# echo "MAINTENANCE_MODE=true" >> .env
```

**Step 2: Pull Latest Code**
```bash
git fetch origin
git checkout monthly-pricing-implementation
git pull origin monthly-pricing-implementation
```

**Step 3: Install Dependencies**
```bash
npm ci --production
```

**Step 4: Run Database Migration**
```bash
# CRITICAL: This modifies production database
npx prisma migrate deploy

# Verify migration was applied
npx prisma migrate status
```

**Step 5: Generate Prisma Client**
```bash
npx prisma generate
```

**Step 6: Build Application**
```bash
npm run build
```

**Step 7: Restart Application**
```bash
# For PM2
pm2 restart all

# For Docker
docker-compose down && docker-compose up -d

# For Kubernetes
kubectl rollout restart deployment/library-app
```

**Step 8: Verify Health**
```bash
# Check application is running
curl https://your-domain.com/api/health

# Check database connection
npx prisma db execute --stdin
# Run: SELECT 1;
```

**Step 9: Disable Maintenance Mode**
```bash
# Remove maintenance mode flag
# sed -i '/MAINTENANCE_MODE/d' .env
```

---

### Phase 4: Post-Deployment Verification

#### 4.1 Immediate Checks (Within 5 minutes)
- [ ] Application is accessible
- [ ] No error logs in server console
- [ ] Database connections working
- [ ] Existing bookings visible
- [ ] Owner dashboard loads

#### 4.2 Functional Verification (Within 15 minutes)
- [ ] Owner can view existing plans
- [ ] Owner can create new monthly rate plan
- [ ] Student can browse libraries
- [ ] Student can view monthly rates
- [ ] Test booking flow (small amount)
- [ ] Payment processed successfully
- [ ] Route transfer executed

#### 4.3 Data Integrity Checks
```sql
-- Verify all existing plans marked as LEGACY_PACKAGE
SELECT COUNT(*) as legacy_count
FROM membership_plans
WHERE pricing_model = 'LEGACY_PACKAGE';

-- Verify no null pricing_model
SELECT COUNT(*) as null_count
FROM membership_plans
WHERE pricing_model IS NULL;
-- Expected: 0

-- Check payment snapshots
SELECT 
  COUNT(*) as total_payments,
  COUNT(monthly_price) as monthly_price_count,
  COUNT(selected_months) as selected_months_count,
  COUNT(gateway_fee) as gateway_fee_count
FROM payments;

-- Verify owner revenue aggregation
SELECT 
  SUM(owner_amount) as total_owner_revenue,
  SUM(amount) as total_student_payments,
  SUM(platform_fee) as total_platform_commission
FROM payments
WHERE status = 'PAID'
AND created_at > NOW() - INTERVAL '7 days';
```

---

## 🔄 Rollback Procedure

### If Issues Detected Within 1 Hour:

#### Quick Rollback
```bash
# 1. Stop application
pm2 stop all

# 2. Restore database from backup
psql $DATABASE_URL < backup_YYYYMMDD_HHMMSS.sql

# 3. Checkout previous code version
git checkout pre-monthly-pricing-backup

# 4. Install dependencies
npm ci

# 5. Build
npm run build

# 6. Restart
pm2 restart all
```

### If Issues Detected After 1 Hour:

⚠️ **DO NOT rollback database** - may have new bookings/payments

Instead:
1. Fix the specific issue in code
2. Deploy hotfix
3. Document incident for post-mortem

---

## 📊 Monitoring & Alerts

### Metrics to Watch (First 24 Hours)

#### Application Metrics:
- Response times for `/api/payments/seat-order`
- Error rates on payment endpoints
- Booking completion rate

#### Business Metrics:
- Number of monthly rate plans created
- Bookings using monthly rates vs legacy
- Average months selected per booking
- Payment success rate
- Route transfer success rate

#### Database Metrics:
- Query performance on new indexes
- Payment table growth rate
- Failed migrations (should be 0)

### Alert Thresholds:
- **Critical**: Payment success rate < 95%
- **Critical**: Route transfer failures > 5%
- **Warning**: Average booking time > 30 seconds
- **Warning**: Error rate > 1%

---

## 🐛 Common Issues & Solutions

### Issue 1: Migration Failed
**Symptom**: `prisma migrate deploy` fails

**Solution**:
```bash
# Check migration status
npx prisma migrate status

# If stuck, resolve manually
npx prisma migrate resolve --applied 20260826000001_monthly_rate_pricing_model

# Then execute SQL manually
npx prisma db execute --file ./prisma/migrations/20260826000001_monthly_rate_pricing_model/migration.sql
```

### Issue 2: Existing Plans Not Showing
**Symptom**: Owner sees empty membership plans list

**Diagnosis**:
```sql
SELECT id, name, pricing_model, is_active
FROM membership_plans
WHERE library_id = '<library_id>';
```

**Solution**: Plans must have `pricing_model` set. Run migration again.

### Issue 3: Payment Breakdown Incorrect
**Symptom**: Owner receives wrong amount

**Diagnosis**:
```sql
SELECT 
  id, base_amount, platform_fee, owner_amount,
  monthly_price, selected_months, gateway_fee
FROM payments
WHERE id = '<payment_id>';
```

**Solution**: Verify `payment-calc.ts` formulas. Check environment variables.

### Issue 4: Student Can't Select Months
**Symptom**: Months step doesn't appear

**Diagnosis**: Check plan `pricing_model` in database

**Solution**: Ensure plan has `pricing_model = 'MONTHLY_RATE'` and `monthly_price` is set

---

## 📈 Success Metrics

### Week 1 Targets:
- [ ] 0 critical bugs reported
- [ ] > 95% payment success rate
- [ ] > 90% Route transfer success rate
- [ ] At least 3 libraries create monthly rate plans
- [ ] At least 10 students book using monthly rates

### Month 1 Targets:
- [ ] 50% of new plans use monthly rate model
- [ ] Average booking value increases (students buying more months)
- [ ] Owner satisfaction with new pricing clarity
- [ ] Platform commission tracked accurately

---

## 🔐 Security Considerations

### Data Privacy:
- ✅ No PII exposed in new fields
- ✅ Payment breakdowns logged securely
- ✅ Razorpay transfers use secure API

### Financial Accuracy:
- ✅ Snapshot values prevent price manipulation
- ✅ Integer paise arithmetic prevents rounding errors
- ✅ Platform commission calculated server-side only
- ✅ Gateway fee recovery formula verified

### Access Control:
- ✅ Only owners can create/edit plans
- ✅ Students can only book their own seats
- ✅ Admin revenue API shows full platform view
- ✅ Owner revenue API shows only their 95% share

---

## 📞 Support & Escalation

### During Deployment:
**On-Call Team**: [Your Team Contact]
**Escalation**: [Manager Contact]
**Razorpay Support**: support@razorpay.com

### Post-Deployment:
**Bug Reports**: GitHub Issues
**Feature Requests**: Product Board
**Incidents**: PagerDuty / Slack #incidents

---

## ✅ Final Deployment Checklist

### Before Deployment:
- [ ] Code review completed
- [ ] All tests passing on staging
- [ ] Database backup completed
- [ ] Rollback procedure documented
- [ ] Team notified of deployment
- [ ] Monitoring dashboards ready
- [ ] Environment variables configured

### During Deployment:
- [ ] Maintenance mode enabled (if applicable)
- [ ] Code pulled and built successfully
- [ ] Migration executed successfully
- [ ] Application restarted successfully
- [ ] Health checks passing
- [ ] Maintenance mode disabled

### After Deployment:
- [ ] Functional verification completed
- [ ] Data integrity checks passed
- [ ] Test booking completed successfully
- [ ] Route transfer verified in Razorpay
- [ ] Owner revenue dashboard accurate
- [ ] No critical errors in logs
- [ ] Monitoring alerts configured
- [ ] Team notified of successful deployment

---

## 📚 Additional Resources

- **Migration Checklist**: `MIGRATION_CHECKLIST.md`
- **Testing Guide**: `TESTING_GUIDE.md`
- **Code Changes**: See git diff or PR description
- **Architecture**: See system design docs
- **Razorpay Route**: https://razorpay.com/docs/route/

---

## 🎉 Deployment Complete!

Once all checks pass, the monthly rate pricing model is live. Monitor closely for the first 24 hours and celebrate the successful deployment!

**Remember**: The platform now shows owners their TRUE earnings (95%) and students see clear, honest pricing. This builds trust and transparency. 🚀

---

*Last Updated: August 26, 2026*
*Version: 1.0.0*
*Deployment Guide for Monthly Rate Pricing Model*
