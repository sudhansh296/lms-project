# Library Owner Subscription Payment Guide

## Where to Pay for Library Registration

Library owners purchase their **platform subscription** (to register and operate their library) in the **Settings** tab.

---

## Navigation

```
Owner Dashboard → Settings → Platform Subscription section
```

**Direct URL**: `/owner/settings`

---

## What's in the Platform Subscription Section

### 1. Current Subscription (if already subscribed)
- **Plan name**: Starter, Basic, Professional, or Enterprise
- **Status badge**: TRIAL | ACTIVE | EXPIRED | CANCELLED
- **Billing**: Shows price and billing cycle (monthly/yearly)
- **Trial end date**: If in trial period
- **Renewal date**: When the subscription renews
- **Features included**: List of plan benefits

### 2. Available Plans to Purchase/Switch

Plans are organized by **tier**, with each tier offering:
- **Monthly subscription** option
- **Yearly subscription** option (with savings percentage)

#### Plan Tiers (example):
- **Starter**: Entry-level plan for small libraries
- **Basic**: Standard features for growing libraries
- **Professional**: Advanced features for established libraries
- **Enterprise**: Full features for large multi-branch operations

Each plan card shows:
- Price (₹ amount)
- Billing cycle
- Monthly equivalent (for yearly plans)
- Savings amount (yearly vs monthly)
- Trial days available
- Feature list
- Action button

---

## Payment Flow

### For Free Plans:
1. Click **"Activate Free"** button
2. Plan activates immediately
3. No Razorpay checkout required

### For Paid Plans:
1. Click **"Get Monthly"** or **"Get Yearly"** button
2. Backend creates Razorpay order (payment goes to **platform account**)
3. Razorpay checkout modal opens
4. Complete payment using:
   - UPI
   - Credit/Debit Card
   - Net Banking
   - Wallet
5. After successful payment:
   - Subscription activates immediately
   - Page reloads showing active subscription
   - Trial period starts (if applicable)

### Payment Destination:
- **Owner subscription payments** → Platform's Razorpay account (StudyLib)
- **Student booking payments** → Library owner's Razorpay account (via Route/Transfer)

---

## Other Sections in Settings Page

The Settings page is a comprehensive management hub containing:

### 1. Account Section
- Name
- Mobile number
- Email (optional)
- Role (Library Owner)

### 2. Library Section
- Library name
- City
- Status (PENDING_VERIFICATION | ACTIVE | SUSPENDED | REJECTED | CLOSED)

### 3. Razorpay Payout Account Section
**Important**: This is where owners link their Razorpay account to **receive** student payments.

- Shows current linked account (if any)
- Input field to enter Razorpay linked account ID (format: `acc_XXXXXXXXXX`)
- "Link Account" button
- Instructions link to Razorpay Route dashboard
- Warning if account not linked (payments held in platform account)

**How to get Razorpay account ID**:
1. Create Razorpay account at https://razorpay.com
2. Go to Razorpay Dashboard → Route → Linked Accounts
3. Copy your linked account ID (starts with `acc_`)
4. Paste in Settings → Razorpay Payout Account section

### 4. Change Password Section
- Current password
- New password
- Confirm new password
- Update button

---

## Key Differences: Owner vs Student Payments

| Aspect | Owner Subscription Payment | Student Booking Payment |
|--------|---------------------------|------------------------|
| **Who pays** | Library Owner | Student |
| **Payment for** | Platform subscription (monthly/yearly) | Seat booking (creates membership) |
| **Goes to** | Platform (StudyLib) Razorpay account | Library Owner's Razorpay account |
| **Where to pay** | `/owner/settings` → Platform Subscription | `/student/library/{id}/book` → Razorpay checkout |
| **Purpose** | Activate library, access platform features | Book seat + activate membership at library |

---

## Subscription Status Meanings

- **TRIAL**: Free trial period is active (e.g., 14-day trial)
- **ACTIVE**: Subscription is paid and active
- **EXPIRED**: Subscription period ended, needs renewal
- **CANCELLED**: Subscription was cancelled by owner or admin
- **NONE**: No subscription yet (first-time owners)

---

## Common Actions

### Activate First Subscription:
1. Login as Library Owner
2. Navigate to **Settings** tab
3. Scroll to **Platform Subscription** section
4. Choose a plan (Starter recommended for new libraries)
5. Click **"Get Monthly"** or **"Get Yearly"**
6. Complete Razorpay payment
7. Library becomes active (after admin approval if PENDING_VERIFICATION)

### Upgrade/Downgrade Plan:
1. Go to **Settings** → **Platform Subscription**
2. View current plan at top
3. Scroll to available plans
4. Click button on desired plan
5. Complete payment
6. New plan activates immediately

### Switch from Monthly to Yearly (or vice versa):
Same process as upgrade/downgrade - select the desired billing cycle and complete payment.

---

## Troubleshooting

### "Payment successful but subscription not activated"
- Check webhook is configured correctly
- Check `/api/owner/subscription` POST endpoint
- Verify Razorpay keys in `.env` are correct
- Check server logs for errors

### "Cannot see subscription plans"
- Check `/api/owner/subscription` GET endpoint
- Verify `SubscriptionPlan` records exist in database
- Check plans have `isActive: true`

### "Payment goes to wrong account"
- Owner subscription → Should go to platform account (configured in `.env` RAZORPAY_KEY_ID/SECRET)
- Student booking → Should go to owner account (set in Razorpay Payout Account section)

---

## Technical Implementation

### API Endpoints:
- **GET** `/api/owner/subscription` - Fetch current subscription + available plans
- **POST** `/api/owner/subscription` - Activate/confirm subscription after payment
- **POST** `/api/payments/create-order` - Create Razorpay order for subscription

### Payment Flow (Technical):
1. Frontend: Click "Get Monthly/Yearly"
2. Backend: Create Razorpay order with `type: 'SUBSCRIPTION'` in notes
3. Frontend: Open Razorpay checkout
4. User: Complete payment
5. Razorpay: Returns `razorpay_order_id`, `razorpay_payment_id`, `razorpay_signature`
6. Frontend: POST to `/api/owner/subscription` with payment details
7. Backend: Verify signature → Create/Update `OwnerSubscription` → Create `OwnerPayment`
8. Frontend: Reload page showing active subscription

### Database Models:
```prisma
model OwnerSubscription {
  id         String             @id
  ownerId    String             @unique
  planId     String
  status     SubscriptionStatus // TRIAL | ACTIVE | EXPIRED | CANCELLED
  startDate  DateTime
  endDate    DateTime?
  trialEnd   DateTime?
}

model OwnerPayment {
  id                  String        @id
  ownerId             String
  amount              Float
  status              PaymentStatus // PENDING | PAID | FAILED | REFUNDED
  paymentMethod       String?
  gatewayOrderId      String?
  gatewayPaymentId    String?
  gatewaySignature    String?
  subscriptionId      String?
  description         String?
}
```

---

## Contact & Support

For issues with subscription payments:
1. Check Settings → Platform Subscription section
2. Verify Razorpay test/live mode matches environment
3. Check browser console for errors
4. Review server logs for API errors
5. Contact platform admin if payment succeeded but subscription not activated
