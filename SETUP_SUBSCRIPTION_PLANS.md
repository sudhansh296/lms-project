# Setup Subscription Plans - Quick Guide

## Problem
The "SWITCH PLAN" header shows in `/owner/settings` but no plans are displayed because there are no subscription plans in the database yet.

---

## Solution: Create Subscription Plans

### Method 1: Via Admin Panel (Easiest)

1. **Login as Super Admin**:
   - Mobile: `9999999999`
   - Password: Check your `.env` file → `SUPER_ADMIN_PASSWORD` (default: `SuperAdmin@123`)

2. **Navigate to**:
   ```
   Admin Dashboard → Settings
   ```
   Or directly: `http://localhost:3000/admin/settings`

3. **Click the button**:
   - If no plans exist: Click **"Create Default Plans"** (center of Subscription Plans card)
   - If plans exist: Click **"Seed Default Plans"** (top right of card header)

4. **Verify**:
   - You should see 7 plans created:
     - ✅ Starter (Free)
     - ✅ Basic Monthly (₹499/mo)
     - ✅ Basic Yearly (₹4,790/yr)
     - ✅ Professional Monthly (₹999/mo)
     - ✅ Professional Yearly (₹9,590/yr)
     - ✅ Enterprise Monthly (₹2,499/mo)
     - ✅ Enterprise Yearly (₹22,490/yr)

5. **Now check Owner Settings**:
   - Login as a library owner
   - Go to `/owner/settings`
   - Scroll to "Platform Subscription" section
   - **All 7 plans should now be visible** under "SWITCH PLAN"

---

### Method 2: Via Direct API Call

If the button doesn't work, you can call the API directly:

1. **Start your development server** (if not running):
   ```bash
   npm run dev
   ```

2. **Open your browser console** (F12) and run:
   ```javascript
   fetch('http://localhost:3000/api/admin/seed-plans', {
     method: 'POST'
   })
   .then(r => r.json())
   .then(data => console.log(data))
   ```

3. **Or use a REST client** (Postman, Thunder Client, etc.):
   ```
   POST http://localhost:3000/api/admin/seed-plans
   ```

4. **Expected Response**:
   ```json
   {
     "success": true,
     "message": "Subscription plans created successfully",
     "plans": [
       { "name": "Starter", "billingCycle": "MONTHLY", "price": 0, "trialDays": 30 },
       { "name": "Basic Monthly", "billingCycle": "MONTHLY", "price": 499, "trialDays": 14 },
       ...
     ],
     "summary": {
       "starter": "Free with 30-day trial",
       "basicMonthly": "₹499/month",
       ...
     }
   }
   ```

---

## Plans Created

### Starter (Free)
- **Price**: ₹0/month
- **Trial**: 30 days
- **Limits**: 50 seats, 100 students, 2 staff, 1 branch
- **Features**: Basic analytics, email support

### Basic
- **Monthly**: ₹499/month (14-day trial)
- **Yearly**: ₹4,790/year (Save 20%)
- **Limits**: 100 seats, 300 students, 5 staff, 1 branch
- **Features**: Advanced analytics, priority support, custom branding

### Professional
- **Monthly**: ₹999/month (7-day trial)
- **Yearly**: ₹9,590/year (Save 20%)
- **Limits**: 300 seats, 1000 students, 15 staff, 3 branches
- **Features**: Premium analytics, phone support, API access, custom integrations

### Enterprise
- **Monthly**: ₹2,499/month
- **Yearly**: ₹22,490/year (Save 25%)
- **Limits**: Unlimited everything
- **Features**: White-label, dedicated account manager, 24/7 support, custom development, SLA

---

## After Setup

Once plans are seeded, library owners will see:

1. **Current Subscription** (at top):
   ```
   Free                                    TRIAL
   Free plan
   Trial ends: 10 Sep 2026
   Renews: 10 Sep 2026
   ✓ Up to 100 seats
   ✓ Up to 500 students
   ✓ Seat layout editor
   ✓ Booking management
   ✓ Basic analytics
   ```

2. **SWITCH PLAN** (below):
   - **Starter** section (if applicable)
     - Monthly: Free
     - [Activate Free button]
   
   - **Basic** section
     - Monthly: ₹499/mo with 14-day trial
     - Yearly: ₹4,790/yr (Save 20%)
   
   - **Professional** section
     - Monthly: ₹999/mo with 7-day trial
     - Yearly: ₹9,590/yr (Save 20%)
   
   - **Enterprise** section
     - Monthly: ₹2,499/mo
     - Yearly: ₹22,490/yr (Save 25%)

3. Each plan shows:
   - Price
   - Billing cycle
   - Trial days (if available)
   - Savings (for yearly plans)
   - Purchase/Activate button
   - Features list

---

## Troubleshooting

### Plans still not showing after seeding?

1. **Check browser console** for errors (F12 → Console tab)

2. **Verify plans were created**:
   - Visit: `http://localhost:3000/api/admin/seed-plans` in browser
   - You should see JSON response with created plans

3. **Check the API endpoint**:
   ```javascript
   // In browser console:
   fetch('http://localhost:3000/api/owner/subscription')
     .then(r => r.json())
     .then(data => console.log(data))
   ```
   - Should return: `{ subscription: {...}, plans: [...], ... }`
   - `plans` array should have 7 items

4. **Clear browser cache and reload**:
   - Press Ctrl+Shift+R (hard reload)

5. **Check authentication**:
   - Make sure you're logged in as a library owner
   - Check network tab (F12) for 401/403 errors

6. **Restart dev server**:
   ```bash
   npm run dev
   ```

### Seed API returns "already exist"?

This is fine! It means plans were created previously. The existing plans will be returned in the response and should display in the UI.

### Database error when seeding?

Check:
- Database connection in `.env` → `DATABASE_URL`
- Prisma schema is up to date: `npx prisma generate`
- Database is running and accessible

---

## Database Check (Advanced)

If you want to manually verify plans in database:

### Using Prisma Studio:
```bash
npx prisma studio
```
- Navigate to `SubscriptionPlan` model
- You should see 7 records

### Using SQL:
```sql
SELECT id, name, price, "billingCycle", "trialDays", "isActive" 
FROM "subscription_plans" 
ORDER BY price ASC, "billingCycle" ASC;
```

Expected result: 7 rows

---

## Related Files

- Seed API: `/src/app/api/admin/seed-plans/route.ts`
- Admin Settings: `/src/app/admin/settings/page.tsx`
- Owner Settings: `/src/app/owner/settings/page.tsx`
- Subscription API: `/src/app/api/owner/subscription/route.ts`
- Database Schema: `/prisma/schema.prisma` → `SubscriptionPlan` model

---

## Summary

**Before Setup**: "SWITCH PLAN" shows but no plans visible

**After Setup**: All 7 subscription plans (Starter, Basic Monthly/Yearly, Professional Monthly/Yearly, Enterprise Monthly/Yearly) display with prices, features, and purchase buttons

**Quick Fix**: 
1. Login as admin → `/admin/settings`
2. Click "Create Default Plans" button
3. Done! Plans now visible to all library owners
