# Trial Period Plan Display Logic

## Overview

The subscription plans section in `/owner/settings` now has intelligent display logic that **hides upgrade/purchase plans during the trial period** and shows them at the appropriate time.

---

## Display Rules

### 1. No Subscription
**Condition**: Owner has never subscribed  
**Action**: **Show all plans** immediately  
**Reason**: New owners need to see plan options

### 2. Trial Active (More than 3 days remaining)
**Condition**: Subscription status = `TRIAL` and trial ends in > 3 days  
**Action**: **Hide all upgrade plans**  
**Reason**: Let owners explore the platform without pressure during trial

### 3. Trial Ending Soon (3 days or less)
**Condition**: Subscription status = `TRIAL` and trial ends in ≤ 3 days  
**Action**: **Show all plans** with "Switch Plan" header  
**Reason**: Give owners advance notice to upgrade before trial expires

### 4. Trial Expired
**Condition**: Trial period has ended (calculated from `trialEnd` date)  
**Action**: **Show all plans**  
**Reason**: Owner needs to purchase a subscription to continue

### 5. Active Subscription
**Condition**: Subscription status = `ACTIVE`  
**Action**: **Show all plans** with "Switch Plan" header  
**Reason**: Allow upgrading/downgrading anytime

### 6. Expired/Cancelled Subscription
**Condition**: Subscription status = `EXPIRED` or `CANCELLED`  
**Action**: **Show all plans**  
**Reason**: Owner needs to reactivate

---

## Implementation

### Helper Function
```typescript
const shouldShowPlans = (sub: Subscription | null, status: string): boolean => {
  // No subscription yet — always show plans
  if (!sub) return true
  
  // In trial — only show if trial ends within 3 days
  if (status === 'TRIAL' && sub.trialEnd) {
    const trialEndDate = new Date(sub.trialEnd)
    const now = new Date()
    const daysUntilTrialEnd = Math.ceil((trialEndDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
    
    // Hide plans if trial has more than 3 days remaining
    return daysUntilTrialEnd <= 3
  }
  
  // Show plans for expired, cancelled, or active subscriptions
  return true
}
```

### Usage in Component
```typescript
{shouldShowPlans(sub ?? null, subStatus) && plans.length > 0 && (
  <div>
    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
      {sub ? 'Switch Plan' : 'Choose a Plan'}
    </p>
    {/* Plans list... */}
  </div>
)}
```

---

## User Experience Flow

### Scenario 1: New Library Owner (No Subscription)
1. Owner completes registration
2. Goes to `/owner/settings`
3. Sees all subscription plans immediately
4. Can choose and purchase any plan

### Scenario 2: Owner with Trial (14 days)
1. **Day 1-11**: Settings page shows current trial status, **NO upgrade plans visible**
2. **Day 12** (3 days remaining): Plans section appears with "Switch Plan" header
3. **Day 14**: Trial expires, plans remain visible, subscription status changes to `EXPIRED`
4. Owner must purchase to continue using platform

### Scenario 3: Owner with Active Subscription
1. Settingspage shows current subscription
2. Plans section visible below with "Switch Plan" header
3. Owner can upgrade/downgrade anytime

---

## Visual States

### During Trial (4+ days remaining)
```
┌─ Platform Subscription ──────────────────┐
│                                            │
│ ┌─ Current Subscription ────────────────┐ │
│ │ Starter Monthly                  TRIAL │ │
│ │ ₹499 / monthly                         │ │
│ │ Trial ends: August 24, 2026            │ │
│ │ ✓ Up to 50 seats                       │ │
│ │ ✓ Basic booking management             │ │
│ └────────────────────────────────────────┘ │
│                                            │
│ [Plans section hidden]                     │
│                                            │
└────────────────────────────────────────────┘
```

### Trial Ending Soon (≤3 days) or After Trial
```
┌─ Platform Subscription ──────────────────┐
│                                            │
│ ┌─ Current Subscription ────────────────┐ │
│ │ Starter Monthly                  TRIAL │ │
│ │ ₹499 / monthly                         │ │
│ │ Trial ends: August 14, 2026            │ │
│ └────────────────────────────────────────┘ │
│                                            │
│ SWITCH PLAN                                │
│                                            │
│ ┌─ Starter ──────────────────────────────┐ │
│ │  MONTHLY           YEARLY (Save 20%)   │ │
│ │  ₹499/mo           ₹4,788/yr           │ │
│ └────────────────────────────────────────┘ │
│                                            │
│ ┌─ Basic ────────────────────────────────┐ │
│ │  MONTHLY           YEARLY (Save 20%)   │ │
│ │  ₹999/mo           ₹9,588/yr           │ │
│ └────────────────────────────────────────┘ │
│                                            │
└────────────────────────────────────────────┘
```

---

## Configuration Options

### Adjust Trial Display Threshold

To change when plans appear before trial ends, modify the number of days in the helper function:

```typescript
// Current: Show plans 3 days before trial ends
return daysUntilTrialEnd <= 3

// Show 7 days before trial ends
return daysUntilTrialEnd <= 7

// Show only when trial already expired
return daysUntilTrialEnd <= 0
```

### Always Show Plans (Disable Logic)

To always show plans regardless of trial status:

```typescript
const shouldShowPlans = (sub: Subscription | null, status: string): boolean => {
  return true  // Always show
}
```

---

## Database Fields Used

```prisma
model OwnerSubscription {
  status      SubscriptionStatus // TRIAL | ACTIVE | EXPIRED | CANCELLED
  trialEnd    DateTime?          // When trial period ends
  endDate     DateTime?          // When subscription renews/expires
  plan        SubscriptionPlan   // Plan details including trialDays
}
```

### Status Flow
```
NONE (no subscription)
  ↓ [purchase with trial]
TRIAL
  ↓ [trial ends without payment]
EXPIRED
  ↓ [purchase]
ACTIVE
  ↓ [subscription expires]
EXPIRED
  ↓ [cancelled by owner/admin]
CANCELLED
```

---

## Testing Scenarios

### Test 1: New Owner
1. Register as library owner
2. Go to `/owner/settings`
3. **Expected**: See all subscription plans
4. Select and purchase a plan with trial
5. **Expected**: Plans disappear (if trial > 3 days)

### Test 2: Trial Mid-Period
1. Set owner subscription with `trialEnd` = 10 days from now
2. Go to `/owner/settings`
3. **Expected**: See current subscription, NO plans section

### Test 3: Trial Ending Soon
1. Set owner subscription with `trialEnd` = 2 days from now
2. Go to `/owner/settings`
3. **Expected**: See current subscription AND plans section below

### Test 4: Trial Expired
1. Set owner subscription with `trialEnd` = yesterday, `status` = 'EXPIRED'
2. Go to `/owner/settings`
3. **Expected**: See expired subscription AND all plans

### Test 5: Active Subscription
1. Set owner subscription with `status` = 'ACTIVE', `endDate` = future
2. Go to `/owner/settings`
3. **Expected**: See active subscription AND plans for switching

---

## Benefits

### For Library Owners:
- ✅ Clean, distraction-free trial experience
- ✅ Timely reminder to upgrade before trial expires
- ✅ Flexibility to upgrade/downgrade anytime when active

### For Platform:
- ✅ Reduces cognitive load during trial onboarding
- ✅ Strategic upgrade prompting at optimal time
- ✅ Clear conversion funnel from trial → paid

---

## Future Enhancements

### Possible Additions:
1. **Email notifications** when trial is ending (integrate with notification system)
2. **Banner alert** at top of dashboard when plans become visible
3. **Countdown timer** showing days remaining in trial
4. **Recommended plan** badge based on library size/usage
5. **Discount codes** for early upgrades during trial
6. **Usage metrics** showing how much of plan limits are being used

---

## Related Files

- `/src/app/owner/settings/page.tsx` - Settings page with plan display logic
- `/src/app/api/owner/subscription/route.ts` - Subscription API endpoints
- `/prisma/schema.prisma` - Database schema for OwnerSubscription
- `/src/app/owner/layout.tsx` - Owner dashboard navigation
- `/src/app/admin/settings/page.tsx` - Admin panel to manage subscription plans

---

## Support

For issues with trial/plan display:
1. Check subscription status in database (`OwnerSubscription` table)
2. Verify `trialEnd` date is set correctly
3. Check browser console for date calculation errors
4. Review helper function logic in settings page
5. Test with different trial end dates to verify thresholds
