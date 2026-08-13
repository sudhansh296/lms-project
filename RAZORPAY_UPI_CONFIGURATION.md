# Razorpay UPI & Payment Methods Configuration

## Issue
Razorpay checkout was not showing UPI option during payment - only showing cards and other methods.

## Solution
Added explicit payment method configuration to all Razorpay checkout instances to enable **UPI, Cards, Net Banking, and Wallets**.

---

## Updated Files

### 1. Student Seat Booking Payment
**File**: `/src/app/student/library/[id]/book/page.tsx`

### 2. Owner Subscription Payment (Dedicated Page)
**File**: `/src/app/owner/subscription/page.tsx`

### 3. Owner Subscription Payment (Settings Page)
**File**: `/src/app/owner/settings/page.tsx`

---

## Configuration Added

```javascript
const rzp = new window.Razorpay({
  key: orderData.key,
  amount: orderData.amount,
  currency: orderData.currency,
  name: 'StudyLib Platform',
  description: 'Payment description',
  order_id: orderData.orderId,
  
  // ✅ NEW: Explicit payment methods configuration
  config: {
    display: {
      blocks: {
        banks: {
          name: 'All payment methods',
          instruments: [
            {
              method: 'upi',           // ✅ UPI (Google Pay, PhonePe, Paytm, etc.)
            },
            {
              method: 'card',          // ✅ Credit/Debit Cards
            },
            {
              method: 'netbanking',    // ✅ Net Banking
            },
            {
              method: 'wallet',        // ✅ Wallets (Paytm, Mobikwik, etc.)
            },
          ],
        },
      },
      sequence: ['block.banks'],
      preferences: {
        show_default_blocks: true,
      },
    },
  },
  
  handler: async (response) => {
    // Payment success handler
  },
  modal: {
    ondismiss: () => {
      // Payment cancelled handler
    }
  },
  theme: { color: '#7c3aed' },
  prefill: { name: user?.name, contact: user?.mobile },
})
```

---

## Payment Methods Now Available

### 1. **UPI** ✅
- Google Pay
- PhonePe
- Paytm
- BHIM
- Other UPI apps
- UPI ID direct entry

### 2. **Cards** ✅
- Credit Cards (Visa, Mastercard, Amex, RuPay)
- Debit Cards (Visa, Mastercard, RuPay, Maestro)
- International Cards (if enabled in Razorpay settings)

### 3. **Net Banking** ✅
- All major banks (SBI, HDFC, ICICI, Axis, etc.)
- Regional banks
- Co-operative banks

### 4. **Wallets** ✅
- Paytm
- Mobikwik
- Freecharge
- Airtel Money
- Amazon Pay
- JioMoney

---

## How It Works

### Before Configuration:
```
Razorpay Checkout opens
  ↓
Shows: Cards, Net Banking, Wallets
  ↓
❌ UPI option missing or hidden
```

### After Configuration:
```
Razorpay Checkout opens
  ↓
Shows prominent sections:
  ├─ UPI (first/most visible) ✅
  ├─ Cards
  ├─ Net Banking
  └─ Wallets
```

---

## Testing

### Test UPI Payment:

1. **Go to any payment flow**:
   - Student: Book a seat → Proceed to payment
   - Owner: Choose subscription plan → Get Monthly/Yearly

2. **Razorpay checkout opens**

3. **Verify payment methods**:
   - ✅ UPI section should be visible at top
   - ✅ Cards section below
   - ✅ Net Banking section
   - ✅ Wallets section

4. **Test UPI payment** (Test Mode):
   - Select UPI
   - Use test UPI ID: `success@razorpay`
   - Or scan test QR code with Razorpay test app

### Razorpay Test Mode UPI IDs:

| UPI ID | Result |
|--------|--------|
| `success@razorpay` | Payment succeeds |
| `failure@razorpay` | Payment fails |
| `create_pending@razorpay` | Payment pending |

---

## Important Notes

### 1. **Test Mode vs Live Mode**

**Test Mode** (current):
- Uses test Razorpay keys (`rzp_test_...`)
- Test UPI IDs work
- No real money transactions
- All payment methods available for testing

**Live Mode** (production):
- Requires KYC verification with Razorpay
- Real UPI, cards, net banking work
- Actual money transactions
- Payment methods depend on merchant category

### 2. **UPI Availability**

UPI will show if:
- ✅ Razorpay account activated
- ✅ Payment methods enabled in Razorpay dashboard
- ✅ `config.display` properly configured (done!)
- ✅ Order amount ≥ ₹1 (Razorpay minimum)

### 3. **Razorpay Dashboard Settings**

To ensure UPI is enabled:
1. Login to Razorpay Dashboard
2. Go to **Settings → Payment Methods**
3. Ensure **UPI** is enabled
4. Save changes

---

## Customization Options

### Show Only UPI (Hide Other Methods):
```javascript
config: {
  display: {
    blocks: {
      banks: {
        name: 'Pay with UPI',
        instruments: [
          { method: 'upi' },
        ],
      },
    },
    sequence: ['block.banks'],
  },
}
```

### Change Order (UPI Last):
```javascript
instruments: [
  { method: 'card' },
  { method: 'netbanking' },
  { method: 'wallet' },
  { method: 'upi' },  // Shows last
]
```

### Hide Specific Methods:
```javascript
// Show only UPI and Cards
instruments: [
  { method: 'upi' },
  { method: 'card' },
  // netbanking and wallet removed
]
```

---

## Troubleshooting

### UPI Still Not Showing?

**Check 1: Razorpay Dashboard**
- Login to dashboard.razorpay.com
- Settings → Payment Methods
- Ensure UPI toggle is ON

**Check 2: Test Amount**
- Razorpay requires minimum ₹1
- UPI won't show for ₹0 orders

**Check 3: Browser Console**
- Open DevTools (F12)
- Check for Razorpay errors
- Look for payment method warnings

**Check 4: Razorpay Script**
- Verify `https://checkout.razorpay.com/v1/checkout.js` loads
- Check network tab for 404 errors

**Check 5: Test Keys**
- Ensure `.env` has correct test keys:
  - `RAZORPAY_KEY_ID=rzp_test_...`
  - `NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_...`

### UPI Payment Fails?

**In Test Mode**:
- Use `success@razorpay` for successful test
- Use `failure@razorpay` for failed test
- Don't use real UPI IDs in test mode

**In Live Mode**:
- Ensure account has sufficient balance
- Check UPI app is active
- Verify bank servers are up
- Try different UPI app

---

## Related Documentation

- [Razorpay Checkout Customization](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/checkout-customisation/)
- [Payment Methods Configuration](https://razorpay.com/docs/payments/payment-methods/)
- [Test UPI Payments](https://razorpay.com/docs/payments/payments/test-card-details/#upi)

---

## Summary

**What Changed**:
- Added `config.display` object to all Razorpay checkout instances
- Explicitly enabled UPI, Cards, Net Banking, and Wallets
- Set display order with UPI first

**Result**:
- ✅ UPI now prominently displayed in payment gateway
- ✅ All payment methods clearly visible
- ✅ Better user experience for Indian customers
- ✅ Higher conversion (UPI is most popular in India)

**Files Updated**: 3
1. Student booking payment
2. Owner subscription (dedicated page)
3. Owner subscription (settings page)
