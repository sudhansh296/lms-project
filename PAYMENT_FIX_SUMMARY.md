# Payment System Fix - August 12, 2026

## Issue Identified

Bookings were remaining in `PENDING` status with `Payment: N/A` even after successful Razorpay payment completion. This prevented:
- Students from seeing their confirmed bookings
- Library owners from checking in students (check-in button only appears for `CONFIRMED` bookings with `PAID` payments)
- Student memberships from being activated

## Root Cause

The transaction logic in three API routes had incorrect Prisma relationship handling:

1. **Payment-to-StudentMembership Relation Issue**: The code was trying to use `payment: { connect: { bookingId: ... } }` when creating a StudentMembership, but this is incorrect because:
   - The `Payment` model has `membershipId` field that links to `StudentMembership`
   - The `StudentMembership` model only has a back-relation `payment Payment?` with no foreign key field
   - To link them, we must update the `Payment` record with the `membershipId`, not connect from StudentMembership side

2. **Nested Creation Race Condition**: Attempting to create a Payment and connect a StudentMembership to it in a single nested update was failing with the PrismaPg adapter

## Files Fixed

### 1. `/api/student/bookings/[id]/pay/route.ts`
**Location**: `c:\library\src\app\api\student\bookings\[id]\pay\route.ts`

**Changes**:
- Restructured transaction to create Payment first as a separate operation
- Updated Booking status after Payment exists
- Created StudentMembership separately
- Linked Payment to StudentMembership by updating Payment with `membershipId`

**Before**:
```typescript
const confirmed = await tx.booking.update({
  where: { id: bookingId },
  data: {
    status: 'CONFIRMED',
    payment: {
      create: { /* payment data */ }
    }
  }
})
// ... then tried to create membership with payment: { connect: { bookingId } }
```

**After**:
```typescript
// Step 1: Create payment first
const payment = await tx.payment.create({ /* payment data */ })

// Step 2: Confirm booking
const confirmed = await tx.booking.update({ status: 'CONFIRMED' })

// Step 3: Create membership
const membership = await tx.studentMembership.create({ /* membership data */ })

// Step 4: Link payment to membership
await tx.payment.update({
  where: { id: payment.id },
  data: { membershipId: membership.id }
})
```

### 2. `/api/payments/seat-order/route.ts`
**Location**: `c:\library\src\app\api\payments\seat-order\route.ts`

**Changes**:
- Fixed free booking path (totalAmount = 0) to follow same pattern
- Payment created first, then Booking updated, then Membership created and linked

### 3. `/api/payments/webhook/route.ts`
**Location**: `c:\library\src\app\api\payments\webhook\route.ts`

**Changes**:
- Updated webhook fallback processing to follow same pattern
- Ensures consistency across all payment confirmation paths

## Transaction Flow (Corrected)

### Paid Booking Flow:
1. Frontend calls `/api/payments/seat-order` with seat/time details
2. Backend creates `PENDING` booking + Razorpay order
3. Frontend opens Razorpay checkout
4. User completes payment
5. Frontend calls `/api/student/bookings/{id}/pay` with payment details
6. Backend transaction:
   - ✅ Verify Razorpay signature
   - ✅ Create `Payment` record (status: PAID, bookingId: set)
   - ✅ Update `Booking` (status: CONFIRMED)
   - ✅ Create `StudentMembership` (dates = booking dates)
   - ✅ Update `Payment` (membershipId: set)
7. Result: Booking CONFIRMED, Payment PAID, Membership ACTIVE

### Free Booking Flow:
1. Frontend calls `/api/payments/seat-order` with seat/time details
2. Backend detects totalAmount = 0
3. Backend transaction (same as step 6 above but with amount: 0, method: FREE)
4. Result: Booking CONFIRMED, Payment PAID (free), Membership ACTIVE

## Database Relations (Reference)

```prisma
model Payment {
  bookingId     String?  @unique
  booking       Booking? @relation(fields: [bookingId], references: [id])
  membershipId  String?  @unique
  membership    StudentMembership? @relation(fields: [membershipId], references: [id])
}

model StudentMembership {
  payment       Payment?  // back-relation only, no FK field
}

model Booking {
  payment       Payment?  // back-relation only, no FK field
}
```

## Verification Steps

After these fixes, test the complete flow:

1. **Test Paid Booking**:
   - Login as student
   - Select library → Select seat → Choose time slot
   - Click "Proceed to Payment"
   - Complete Razorpay test payment
   - Verify booking shows as CONFIRMED with payment status PAID
   - Verify student membership created with dates matching booking dates

2. **Test Free Booking**:
   - Create a library with membership plan price = 0
   - Book a seat
   - Should confirm immediately without Razorpay
   - Verify booking CONFIRMED, payment PAID (free), membership ACTIVE

3. **Test Owner Check-In**:
   - Login as library owner
   - Go to `/owner/bookings`
   - Verify "Check In" button appears for CONFIRMED bookings with PAID payment
   - Click "Check In" → verify status changes to ACTIVE

4. **Test Student Dashboard**:
   - Go to `/student/bookings` → verify booking appears
   - Go to `/student/expiry` → verify active booking details with expiry date
   - Dates should match booking period exactly

## Notes

- OTP functionality was NOT modified (as per requirements)
- Razorpay Test Mode keys are properly configured in `.env`
- All three payment paths (direct, free, webhook) now follow consistent pattern
- Transaction integrity maintained with proper sequencing
- Idempotency checks remain in place to prevent double-processing

## Next Steps

1. Restart the Next.js development server to apply changes
2. Test end-to-end booking flow with Razorpay test payment
3. Verify existing PENDING bookings remain PENDING (these were created with old flow and need manual cleanup or re-booking)
4. Consider disabling the old `/api/student/bookings` POST endpoint if it exists (forces use of new flow)
