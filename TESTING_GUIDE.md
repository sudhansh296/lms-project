# Testing Guide - Monthly Rate Pricing Model

## Overview

This guide provides comprehensive test scenarios to verify the corrected pricing model implementation.

## Pre-Test Setup

### 1. Environment Variables
Verify these are in your `.env`:
```
PLATFORM_COMMISSION_PERCENT=5
RAZORPAY_PG_FEE_PERCENT=2
RAZORPAY_PG_FEE_GST_PERCENT=18
CUSTOMER_PAYS_GATEWAY_FEE=true
MAX_BOOKING_MONTHS=24
```

### 2. Database State
- Ensure migration has been applied
- Have at least one active library with seats
- Have owner with settlement account configured

### 3. Test Accounts
- **Owner Account**: With Razorpay Route settlement ready
- **Student Account**: For booking seats

---

## Test Scenarios

### Scenario 1: Create Monthly Rate Plan (₹100/month for 2 hrs/day)

**Expected Behavior:**
- Owner sets: ₹100 per month for 2 hours daily access
- System calculates: Owner receives ₹95 (after 5% commission)
- System displays: "You'll receive ₹95 per month (95% after 5% platform commission)"

**Test Steps:**
1. Login as Owner
2. Navigate to Memberships page
3. Click "Create New Plan"
4. Enter:
   - Name: "2 Hours / Day" (auto-generated)
   - Daily Minutes: 120
   - Monthly Price: 100
5. Verify preview shows: ₹95 owner net

**Verification:**
```sql
SELECT id, name, pricing_model, daily_minutes, monthly_price, price 
FROM membership_plans 
WHERE library_id = '<library_id>' 
ORDER BY created_at DESC LIMIT 1;

-- Expected:
-- pricing_model: MONTHLY_RATE
-- daily_minutes: 120
-- monthly_price: 100
-- price: 100 (mirrored for compatibility)
```

---

### Scenario 2: Student Books 1 Month (₹100 base)

**Expected Money Flow:**
- Student pays: ₹102.36 (₹100 + ₹2.36 gateway recovery)
- Gateway fee deduction: ~₹2.36 (Razorpay keeps this)
- Platform commission: ₹5.00 (from ₹100 base)
- Owner receives: ₹95.00 (via Route transfer)

**Test Steps:**
1. Login as Student
2. Browse library, view monthly rate plan
3. Click "Choose This Rate"
4. Select: 1 month (default)
5. Verify price preview: ₹100 base
6. Select date & time
7. Choose seat (no extra charge)
8. Review breakdown:
   - Monthly Rate: ₹100
   - Duration: 1 month
   - Base Amount: ₹100
   - Gateway Fee: ~₹2.36
   - **Total: ₹102.36**
9. Complete payment

**Database Verification:**
```sql
-- Check Booking
SELECT id, selected_months, monthly_price_snapshot, plan_price_snapshot, total_amount
FROM bookings 
WHERE student_id = '<student_id>' 
ORDER BY created_at DESC LIMIT 1;

-- Expected:
-- selected_months: 1
-- monthly_price_snapshot: 100
-- plan_price_snapshot: 100
-- total_amount: 100

-- Check Payment
SELECT 
  monthly_price, selected_months, 
  base_amount, platform_fee, owner_amount,
  gateway_fee, gateway_fee_gst, amount
FROM payments 
WHERE booking_id = '<booking_id>';

-- Expected:
-- monthly_price: 100
-- selected_months: 1
-- base_amount: 100
-- platform_fee: 5 (5% of 100)
-- owner_amount: 95 (100 - 5)
-- gateway_fee: ~1.96
-- gateway_fee_gst: ~0.40
-- amount: ~102.36
```

**Route Transfer Verification:**
Check Razorpay dashboard for transfer of ₹95.00 (9500 paise) to owner account.

---

### Scenario 3: Student Books 3 Months (₹300 base)

**Expected Money Flow:**
- Student pays: ₹307.07 (₹300 + ₹7.07 gateway recovery)
- Gateway fee deduction: ~₹7.07
- Platform commission: ₹15.00 (5% of ₹300)
- Owner receives: ₹285.00

**Test Steps:**
1. Same as Scenario 2, but select **3 months** on months selection step
2. Verify price preview updates: ₹100 × 3 = ₹300 base
3. Complete payment

**Verification:**
```sql
SELECT 
  monthly_price, selected_months, 
  base_amount, platform_fee, owner_amount, amount
FROM payments 
WHERE booking_id = '<booking_id>';

-- Expected:
-- monthly_price: 100
-- selected_months: 3
-- base_amount: 300
-- platform_fee: 15
-- owner_amount: 285
-- amount: ~307.07
```

---

### Scenario 4: Create Monthly Rate Plan (₹450/month for 4 hrs/day)

**Test Steps:**
1. Create plan with monthlyPrice: 450, dailyMinutes: 240
2. Verify owner preview: "You'll receive ₹427.50"

**Student Books 1 Month:**
- Student pays: ₹460.88 (₹450 + ₹10.88 gateway)
- Platform commission: ₹22.50
- Owner receives: ₹427.50

---

### Scenario 5: Create Monthly Rate Plan (₹900/month for 8 hrs/day)

**Test Steps:**
1. Create plan with monthlyPrice: 900, dailyMinutes: 480
2. Verify owner preview: "You'll receive ₹855"

**Student Books 6 Months:**
- Student pays: ₹5,521.26 (₹5,400 + ₹121.26 gateway)
- Platform commission: ₹270.00 (5% of ₹5,400)
- Owner receives: ₹5,130.00

**Verification:**
```sql
SELECT 
  monthly_price * selected_months as total_base,
  platform_fee, 
  owner_amount,
  gateway_fee + gateway_fee_gst as total_gateway,
  amount as student_total
FROM payments 
WHERE booking_id = '<booking_id>';

-- Expected:
-- total_base: 5400
-- platform_fee: 270
-- owner_amount: 5130
-- total_gateway: ~121.26
-- student_total: ~5521.26
```

---

### Scenario 6: Seat with Extra Charge (₹100/month + ₹50 seat)

**Expected Money Flow:**
- Base: ₹100 (monthly) + ₹50 (seat) = ₹150 library base
- Platform commission: ₹7.50 (5% of ₹150)
- Owner receives: ₹142.50
- Gateway fee: ~₹3.53
- Student pays: ₹153.53

**Verification:**
```sql
SELECT 
  monthly_price, seat_extra_amount, base_amount,
  platform_fee, owner_amount, amount
FROM payments 
WHERE booking_id = '<booking_id>';

-- Expected:
-- monthly_price: 100
-- seat_extra_amount: 50
-- base_amount: 150
-- platform_fee: 7.50
-- owner_amount: 142.50
-- amount: ~153.53
```

---

### Scenario 7: Legacy Package Plan (Backward Compatibility)

**Test Steps:**
1. Verify existing LEGACY_PACKAGE plans still work
2. Student books legacy package
3. Verify no "months" selection step appears
4. Verify breakdown uses old format (but with corrected commission)

**Expected:**
- Old plans show fixed duration (e.g., "1 Month", "3 Months")
- Booking flow goes directly from plan → datetime → seat
- Payment still uses corrected money flow (5% FROM owner)

---

### Scenario 8: Owner Revenue Dashboard

**Verification Steps:**
1. Login as Owner
2. View Dashboard stats
3. Check "Today's Revenue" and "Monthly Revenue"
4. Navigate to Revenue Reports page
5. Verify all amounts shown are **ownerAmount** (95% after commission)

**Example:**
If 3 bookings today:
- Booking 1: ₹95 (owner share of ₹100)
- Booking 2: ₹285 (owner share of ₹300)
- Booking 3: ₹427.50 (owner share of ₹450)
- **Dashboard shows: ₹807.50** (not student totals)

---

### Scenario 9: Price Change Impact (Snapshot Verification)

**Test Steps:**
1. Owner creates plan: ₹100/month
2. Student books 3 months: pays ₹307.07
3. Owner changes plan to ₹150/month
4. Verify existing booking still shows ₹100/month in history
5. New student books: pays ₹460.88 (₹450 + gateway)

**Critical Verification:**
```sql
-- Old booking should use old price snapshot
SELECT monthly_price_snapshot, selected_months, total_amount
FROM bookings 
WHERE id = '<old_booking_id>';

-- Expected: monthly_price_snapshot = 100

-- Payment should NEVER recalculate
SELECT monthly_price, base_amount, owner_amount
FROM payments 
WHERE booking_id = '<old_booking_id>';

-- Expected: monthly_price = 100, base_amount = 300, owner_amount = 285
```

---

### Scenario 10: Student Expiry Page

**Test Steps:**
1. Login as Student
2. Navigate to My Bookings / Expiring Soon
3. View booking details
4. Verify shows:
   - Monthly Rate: ₹100
   - Duration: 3 months
   - Total Paid: ₹307.07
   - End Date: [calculated correctly]

---

## Edge Cases to Test

### EC1: Maximum Months (24)
- Select 24 months
- Verify: No errors, correct calculation (₹100 × 24 = ₹2,400 base)

### EC2: Minimum Months (1)
- Verify 1 month is default
- Verify slider/buttons work correctly

### EC3: Duplicate Daily Duration
- Try to create second MONTHLY_RATE plan with same daily minutes
- Expected: Error message about duplicate

### EC4: Mixed Plan Types
- Library has both MONTHLY_RATE and LEGACY_PACKAGE plans
- Student sees both types correctly labeled
- Both booking flows work independently

---

## Commission Verification Matrix

| Base Amount | Platform Commission (5%) | Owner Receives (95%) | Gateway Fee (~2.36%) | Student Pays |
|-------------|--------------------------|----------------------|----------------------|--------------|
| ₹100        | ₹5.00                   | ₹95.00              | ₹2.36                | ₹102.36      |
| ₹300        | ₹15.00                  | ₹285.00             | ₹7.07                | ₹307.07      |
| ₹450        | ₹22.50                  | ₹427.50             | ₹10.88               | ₹460.88      |
| ₹900        | ₹45.00                  | ₹855.00             | ₹21.76               | ₹921.76      |
| ₹5,400      | ₹270.00                 | ₹5,130.00           | ₹121.26              | ₹5,521.26    |

**Formula Verification:**
- `platformCommission = baseAmount × 0.05`
- `ownerAmount = baseAmount - platformCommission`
- `gatewayFee = (baseAmount / 0.9764) × 0.02` (approx)
- `studentTotal = baseAmount + gatewayFee + gatewayFeeGst`

---

## Automated Test Checklist

- [ ] All test scenarios pass
- [ ] Database constraints enforced correctly
- [ ] Payment breakdown calculations accurate
- [ ] Route transfers send correct amounts
- [ ] Owner dashboard shows correct revenue
- [ ] Student sees correct pricing
- [ ] Legacy plans still functional
- [ ] Snapshots preserved correctly
- [ ] Edge cases handled gracefully
- [ ] No errors in console/logs

---

## Rollback Procedure

If major issues found:
1. Stop accepting new bookings
2. Restore database from pre-migration backup
3. Revert code changes (git reset)
4. Investigate issues
5. Fix and re-test in staging

---

## Sign-off

- [ ] All critical scenarios tested and passed
- [ ] Money flow verified correct (5% FROM owner)
- [ ] Route transfers confirmed in Razorpay dashboard
- [ ] Owner revenue reports accurate
- [ ] No data integrity issues
- [ ] Ready for production use

**Tested by:** _________________  
**Date:** _________________  
**Environment:** _________________
