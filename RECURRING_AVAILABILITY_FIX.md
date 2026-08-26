# Recurring Availability Check - Proper Implementation

## Problem

The old `/api/libraries/[id]/seats` endpoint checked if a seat was available for the **ENTIRE period** (first day → last day) instead of checking **EACH DAY individually**.

### Example Bug

**3-month Mon-Fri booking (9am-5pm)**:
- ❌ **Old behavior**: Checks if seat is free continuously for 3 months
  - Seat blocked if ANYONE has it booked for even 1 hour in 3 months
- ✅ **New behavior**: Checks if seat is free Mon-Fri 9am-5pm for each of ~90 days
  - Seat available if free for specific hours on specific days

---

## Solution: New Availability Endpoint

### API Endpoint

**POST** `/api/libraries/[libraryId]/availability`

### Request Body

```typescript
{
  startDate: "2026-09-01",      // First day of period
  endDate: "2026-11-30",        // Last day of period
  dailyStartTime: "09:00",      // Time each day starts
  dailyEndTime: "17:00",        // Time each day ends
  daysOfWeek: [1, 2, 3, 4, 5]  // 0=Sun, 1=Mon, ..., 6=Sat
}
```

### Response

```typescript
{
  seats: [
    {
      id: "seat_123",
      label: "A1",
      seatType: "STANDARD",
      status: "AVAILABLE",
      priceModifier: 0,
      
      // NEW: Detailed availability
      isFullyAvailable: true,         // Available for ALL occurrences
      availabilityPercentage: 100,    // Percentage of available occurrences
      totalOccurrences: 90,            // Total days in period
      availableOccurrences: 90,        // Days when seat is free
      unavailableDates: []             // YYYY-MM-DD dates when blocked
    },
    {
      id: "seat_456",
      label: "B2",
      seatType: "PREMIUM",
      status: "AVAILABLE",
      
      isFullyAvailable: false,
      availabilityPercentage: 87,      // 78 out of 90 days available
      totalOccurrences: 90,
      availableOccurrences: 78,
      unavailableDates: [              // 12 days blocked
        "2026-09-15",
        "2026-09-16",
        // ... 10 more dates
      ]
    }
  ],
  summary: {
    totalSeats: 50,
    fullyAvailableSeats: 23,
    totalOccurrences: 90
  }
}
```

---

## How It Works

### 1. Generate Exact Occurrences

```typescript
// For Mon-Fri 9am-5pm from Sep 1 to Nov 30
const occurrences = []
let current = Sep 1

while (current <= Nov 30) {
  if (current.dayOfWeek in [1,2,3,4,5]) {
    occurrences.push({
      date: "2026-09-01",
      startTime: "2026-09-01T09:00:00",
      endTime: "2026-09-01T17:00:00"
    })
  }
  current = current + 1 day
}

// Result: ~90 occurrence windows
```

### 2. Query All Conflicts

```sql
SELECT seatId, startTime, endTime
FROM booking_occurrences
WHERE status IN ('HELD', 'CONFIRMED')
  AND startTime < '2026-11-30T17:00:00'
  AND endTime > '2026-09-01T09:00:00'
```

### 3. Check EACH Occurrence

```typescript
for (const occurrence of occurrences) {
  for (const conflict of conflicts) {
    // Check if THIS specific day/time overlaps
    if (conflict.startTime < occurrence.endTime && 
        conflict.endTime > occurrence.startTime) {
      unavailableDates.push(occurrence.date)
    }
  }
}
```

### 4. Calculate Availability

```typescript
availabilityPercentage = (availableOccurrences / totalOccurrences) * 100
isFullyAvailable = availabilityPercentage === 100
```

---

## Frontend Integration

### Before (Wrong)

```typescript
// ❌ Check entire 3-month range as one block
const response = await fetch(
  `/api/libraries/${id}/seats?startTime=${firstDay}&endTime=${lastDay}`
)

// Returns: seat available for entire 3 months YES/NO
// Problem: Too restrictive, seat blocked if ANY conflict exists
```

### After (Correct)

```typescript
// ✅ Generate occurrences and check each
const response = await fetch(`/api/libraries/${id}/availability`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    startDate: '2026-09-01',
    endDate: '2026-11-30',
    dailyStartTime: '09:00',
    dailyEndTime: '17:00',
    daysOfWeek: [1, 2, 3, 4, 5] // Mon-Fri
  })
})

const { seats } = await response.json()

// Show seats with availability details
seats.forEach(seat => {
  if (seat.isFullyAvailable) {
    // Seat available for ALL 90 days
  } else if (seat.availabilityPercentage >= 80) {
    // Seat available for 72+ out of 90 days
    // Show which specific dates are blocked
  } else {
    // Seat mostly booked
  }
})
```

---

## UI Recommendations

### Seat Card Display

```
┌─────────────────────────────┐
│ Seat A1 - STANDARD         │
│ ✅ Fully Available         │
│ 90/90 days free (100%)     │
└─────────────────────────────┘

┌─────────────────────────────┐
│ Seat B2 - PREMIUM          │
│ ⚠️  Partially Available    │
│ 78/90 days free (87%)      │
│                             │
│ Unavailable dates:          │
│ • Sep 15, 16                │
│ • Oct 3-8                   │
│ • Nov 12, 15                │
└─────────────────────────────┘

┌─────────────────────────────┐
│ Seat C3 - WINDOW           │
│ ❌ Mostly Booked           │
│ 23/90 days free (26%)      │
└─────────────────────────────┘
```

### Filtering Options

```typescript
// Allow students to filter by availability
const filters = {
  fullyAvailableOnly: true,     // Hide partial seats
  minAvailability: 90,          // Only show 90%+ available
  showUnavailableDates: true    // Display conflict dates
}
```

---

## Performance

### Optimizations Applied

1. **Single Database Query**: Fetches ALL conflicts in one query, not per-occurrence
2. **In-Memory Filtering**: Checks each occurrence against conflicts in JavaScript
3. **Early Termination**: Stops checking occurrence if already marked unavailable
4. **Indexed Queries**: Uses existing indexes on `startTime`, `endTime`, `status`, `seatId`

### Performance Estimates

| Scenario | Occurrences | Query Time | Processing Time | Total |
|----------|-------------|------------|-----------------|-------|
| 1 week daily | 7 | 50ms | 5ms | 55ms |
| 1 month daily | 30 | 60ms | 10ms | 70ms |
| 3 months Mon-Fri | 90 | 80ms | 20ms | 100ms |
| 6 months daily | 180 | 100ms | 30ms | 130ms |
| 1 year Mon-Fri | 260 | 120ms | 40ms | 160ms |

**Acceptable** for user-facing availability checks.

---

## Migration Path

### Phase 1: Add New Endpoint (Current)
- ✅ New `/availability` endpoint created
- ✅ Old `/seats` endpoint unchanged (backward compatible)

### Phase 2: Update Frontend (Next)
- Update booking flow to use new endpoint
- Show per-occurrence availability details
- Add "partially available" seat handling

### Phase 3: Deprecate Old Endpoint
- Remove old global availability check
- Keep `/seats` for simple seat listing only

---

## Testing Checklist

### Backend Tests

- [ ] Generate occurrences for Mon-Fri (should exclude weekends)
- [ ] Generate occurrences for daily (should include all days)
- [ ] Generate occurrences for custom days [Tue, Thu] (only those days)
- [ ] Handle conflicts that overlap multiple occurrences
- [ ] Handle conflicts that overlap partial occurrence (e.g., 2pm-6pm when occurrence is 9am-5pm)
- [ ] Exclude expired PENDING holds
- [ ] Calculate correct availability percentage
- [ ] Sort seats by availability (fully available first)

### Frontend Tests

- [ ] Display fully available seats correctly
- [ ] Display partially available seats with details
- [ ] Show unavailable dates clearly
- [ ] Filter by minimum availability percentage
- [ ] Handle loading state during availability check
- [ ] Show error if availability check fails

---

## Known Limitations

1. **Time Precision**: Currently checks to the minute, not second
2. **Timezone**: Uses library's local time (assumes backend handles timezone)
3. **Max Occurrences**: Recommend limiting to 365 days (1 year) for performance
4. **Cache**: No caching yet (every request recalculates)

### Future Enhancements

- Add Redis caching for common date ranges
- Pre-calculate availability for next 30 days nightly
- Add webhook to invalidate cache on new bookings
- Support recurring patterns (every Mon/Wed/Fri for 1 year)

---

## API Contract

### Status Codes

- `200`: Success with availability data
- `400`: Invalid request (missing fields, invalid dates)
- `404`: Library not found or not active
- `500`: Server error (database issue, processing failure)

### Error Response

```typescript
{
  error: "Failed to check availability",
  details: "Invalid date range: endDate must be after startDate"
}
```

---

**Created**: 2026-08-26  
**Status**: Ready for frontend integration  
**Breaking Changes**: None (new endpoint, old endpoint unchanged)
