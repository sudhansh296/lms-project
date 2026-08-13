# Subscription Plans Setup

## Overview
The system now supports both **MONTHLY** and **YEARLY** subscription plans for library owners, with yearly plans offering discounts.

## Seeding Subscription Plans

To create the default subscription plans in your database, you have two options:

### Option 1: Using API Endpoint (Recommended)

1. **Start your development server:**
   ```bash
   npm run dev
   ```

2. **Call the seed endpoint:**
   ```bash
   # Using curl (Git Bash or WSL)
   curl -X POST http://localhost:3000/api/admin/seed-plans

   # Or using PowerShell
   Invoke-WebRequest -Method POST -Uri "http://localhost:3000/api/admin/seed-plans" | Select-Object -ExpandProperty Content
   ```

3. **View existing plans:**
   ```bash
   curl http://localhost:3000/api/admin/seed-plans
   ```

### Option 2: Manual Database Insert

Use Prisma Studio to manually create plans:
```bash
npx prisma studio
```

Then add records to the `subscription_plans` table.

## Available Plans

### 1. **Starter** (FREE)
- **Price:** ₹0
- **Billing:** Monthly
- **Trial:** 30 days
- **Limits:** 50 seats, 100 students, 2 staff, 1 branch
- **Best for:** Single library owners getting started

### 2. **Basic Monthly**
- **Price:** ₹499/month
- **Billing:** Monthly
- **Trial:** 14 days
- **Limits:** 100 seats, 300 students, 5 staff, 1 branch
- **Features:** Advanced analytics, priority support, custom branding

### 3. **Basic Yearly** ⭐ Save 20%
- **Price:** ₹4,790/year (₹399/month effective)
- **Billing:** Yearly
- **Trial:** 14 days
- **Limits:** Same as Basic Monthly
- **Savings:** ₹1,198/year vs monthly plan

### 4. **Professional Monthly**
- **Price:** ₹999/month
- **Billing:** Monthly
- **Trial:** 7 days
- **Limits:** 300 seats, 1000 students, 15 staff, 3 branches
- **Features:** Premium analytics, phone support, API access, custom integrations

### 5. **Professional Yearly** ⭐ Save 20%
- **Price:** ₹9,590/year (₹799/month effective)
- **Billing:** Yearly
- **Trial:** 7 days
- **Limits:** Same as Professional Monthly
- **Savings:** ₹2,398/year vs monthly plan

### 6. **Enterprise Monthly**
- **Price:** ₹2,499/month
- **Billing:** Monthly
- **Trial:** None
- **Limits:** Unlimited everything
- **Features:** White-label, dedicated account manager, 24/7 support, custom development, SLA

### 7. **Enterprise Yearly** ⭐ Save 25%
- **Price:** ₹22,490/year (₹1,874/month effective)
- **Billing:** Yearly
- **Trial:** None
- **Limits:** Unlimited everything
- **Savings:** ₹7,498/year vs monthly plan

## Database Schema

The `subscription_plans` table includes:
- `name` - Plan name (e.g., "Basic Monthly", "Basic Yearly")
- `billingCycle` - "MONTHLY" or "YEARLY"
- `price` - Price in rupees (₹)
- `trialDays` - Free trial period
- `maxSeats`, `maxStudents`, `maxStaff`, `maxBranches` - Usage limits (null = unlimited)
- `features` - Array of feature descriptions
- `isActive` - Whether plan is available for purchase

## Owner Settings Page

Library owners can:
1. **View current subscription** - Active plan details with expiry
2. **Link Razorpay account** - For receiving student booking payments
3. **Purchase/upgrade plans** - See all available plans with monthly/yearly options
4. **Auto-payment** - Razorpay checkout handles payment collection

## Payment Flow

### For Subscription Payments (Owner → Platform):
1. Owner clicks "Pay ₹X" on desired plan
2. Razorpay order created via `/api/payments/create-order`
3. Razorpay checkout modal opens
4. Payment processed (goes to platform's Razorpay account)
5. Subscription activated via `/api/owner/subscription`
6. Plan status updated to ACTIVE with end date

### For Student Booking Payments (Student → Owner):
1. Student books seat and pays
2. Payment captured by platform's Razorpay account
3. 100% transferred to owner's linked Razorpay account (via Razorpay Route)
4. If owner hasn't linked account, payment held in platform (manual transfer required)

## Discount Strategy

- **Basic & Professional Plans:** 20% discount on yearly
- **Enterprise Plans:** 25% discount on yearly
- **Calculation:** `yearlyPrice = monthlyPrice * 12 * (1 - discount)`

## Testing

1. **Create plans:** POST `/api/admin/seed-plans`
2. **View plans:** GET `/api/admin/seed-plans`
3. **View as owner:** GET `/api/owner/subscription` (requires owner authentication)
4. **Purchase plan:** Owner settings page → Click "Pay & Activate" button
5. **Test with Razorpay test mode** - Use test card: 4111 1111 1111 1111

## Notes

- Free plan (Starter) can be activated without payment
- Trial periods start automatically upon activation
- Yearly plans show "💰 Save X%" badge in UI
- Plans are ordered by price (ascending) in the UI
- Owners can switch between plans anytime
- Old subscription is replaced (not additive)
