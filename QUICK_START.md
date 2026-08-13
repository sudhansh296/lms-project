# Quick Start Guide - Subscription Plans

## To enable monthly and yearly subscription plans, follow these steps:

### Step 1: Start Development Server
```bash
npm run dev
```

### Step 2: Seed Subscription Plans

Open your browser or use a REST client to call:

**Using Browser:**
```
http://localhost:3000/api/admin/seed-plans
```

**Using cURL (Git Bash / WSL):**
```bash
curl -X POST http://localhost:3000/api/admin/seed-plans
```

**Using PowerShell:**
```powershell
Invoke-WebRequest -Method POST -Uri "http://localhost:3000/api/admin/seed-plans" | Select-Object -ExpandProperty Content
```

**Using Postman / Insomnia:**
```
POST http://localhost:3000/api/admin/seed-plans
```

### Step 3: Verify Plans Created

**Using Browser:**
```
http://localhost:3000/api/admin/seed-plans
```

**Using cURL:**
```bash
curl http://localhost:3000/api/admin/seed-plans
```

You should see a response with 7 plans:
- ✅ Starter (Free)
- ✅ Basic Monthly (₹499)
- ✅ Basic Yearly (₹4,790 - Save 20%)
- ✅ Professional Monthly (₹999)
- ✅ Professional Yearly (₹9,590 - Save 20%)
- ✅ Enterprise Monthly (₹2,499)
- ✅ Enterprise Yearly (₹22,490 - Save 25%)

### Step 4: Test Owner Settings Page

1. Login as library owner
2. Navigate to **Settings** page
3. You should see:
   - **Razorpay Payout Account** section (to link account for receiving student payments)
   - **Platform Subscription** section with grouped monthly/yearly plans
   - Each tier shows monthly and yearly side-by-side
   - Yearly plans display savings percentage

### Step 5: Test Subscription Purchase

1. Click "Get Monthly" or "Get Yearly" on any plan
2. Razorpay checkout modal should open
3. Use test card: **4111 1111 1111 1111**
4. Complete payment
5. Subscription should activate with proper end date

---

## Architecture Summary

### Two Payment Flows:
1. **Student → Owner**: Seat bookings (100% to owner via Razorpay Route)
2. **Owner → Platform**: Subscriptions (monthly/yearly)

### Key Features:
- ✅ Automatic fund transfer to owner's Razorpay account
- ✅ Fallback if owner hasn't linked account (payment held)
- ✅ Monthly and yearly billing with discounts
- ✅ Free trial periods
- ✅ Secure payment verification
- ✅ Webhook support for async confirmation

---

## Environment Variables Required

```env
# Database
DATABASE_URL="postgresql://..."

# Razorpay
RAZORPAY_KEY_ID="rzp_test_..."
RAZORPAY_KEY_SECRET="..."
RAZORPAY_WEBHOOK_SECRET="..."
NEXT_PUBLIC_RAZORPAY_KEY_ID="rzp_test_..."
```

---

## Troubleshooting

### Plans already exist?
The seed endpoint is idempotent - it will show existing plans instead of creating duplicates.

### Server not running?
Make sure `npm run dev` is running on port 3000.

### Database connection error?
Check your `DATABASE_URL` in `.env` file.

### Build errors?
Run `npm run build` to verify - build should pass successfully.

---

## Documentation Files

- 📄 **SUBSCRIPTION_PLANS.md** - Detailed plan information
- 📄 **SPLIT_PAYMENT_IMPLEMENTATION.md** - Complete technical documentation
- 📄 **QUICK_START.md** - This file

---

**Ready to go!** 🚀
