import { describe, it, expect } from 'vitest'
import {
  calculateSessionMinutes,
  calculateDailyStudyTotals,
  calculateCurrentStreak,
  calculateLongestStreak,
  calculateWeeklyStudyMinutes,
  calculateMonthlyStudyMinutes,
  formatStudyDuration,
  STREAK_MIN_STUDY_MINUTES,
  type AttendanceRecord,
} from '@/lib/study-stats'

// ── Helpers ───────────────────────────────────────────────────────────────────

function d(dateStr: string, time: string): Date {
  return new Date(`${dateStr}T${time}:00.000Z`)
}

function rec(
  dateStr: string,
  inTime: string,
  outTime: string | null
): AttendanceRecord {
  return {
    date: dateStr,
    checkInAt: d(dateStr, inTime),
    checkOutAt: outTime ? d(dateStr, outTime) : null,
  }
}

// ── calculateSessionMinutes ───────────────────────────────────────────────────

describe('calculateSessionMinutes', () => {
  // Test 1: normal session 09:05 → 11:00 = 115 min
  it('calculates 115 minutes for 09:05 → 11:00', () => {
    const result = calculateSessionMinutes(
      d('2026-01-01', '09:05'),
      d('2026-01-01', '11:00')
    )
    expect(result).toBe(115)
  })

  // Test 2: null checkOut = 0
  it('returns 0 when checkOutAt is null', () => {
    const result = calculateSessionMinutes(d('2026-01-01', '09:00'), null)
    expect(result).toBe(0)
  })

  // Test 3: negative duration (checkOut before checkIn) = 0
  it('returns 0 when checkOutAt is before checkInAt (negative duration)', () => {
    const result = calculateSessionMinutes(
      d('2026-01-01', '11:00'),
      d('2026-01-01', '09:00')
    )
    expect(result).toBe(0)
  })

  // Test 16: session > 16 hours = 0
  it('returns 0 when duration exceeds 16 hours', () => {
    const checkIn = new Date('2026-01-01T00:00:00.000Z')
    const checkOut = new Date('2026-01-01T17:00:00.000Z') // 17 hours
    expect(calculateSessionMinutes(checkIn, checkOut)).toBe(0)
  })
})

// ── calculateDailyStudyTotals ─────────────────────────────────────────────────

describe('calculateDailyStudyTotals', () => {
  // Test 4: two sessions on same day sum correctly
  it('sums two sessions on the same day', () => {
    const records: AttendanceRecord[] = [
      rec('2026-01-05', '08:00', '09:00'), // 60 min
      rec('2026-01-05', '14:00', '15:30'), // 90 min
    ]
    const totals = calculateDailyStudyTotals(records)
    expect(totals.get('2026-01-05')).toBe(150)
  })

  // Test 12: same-day aggregation (alias of test 4 with different values)
  it('aggregates multiple sessions on the same date into one total', () => {
    const records: AttendanceRecord[] = [
      rec('2026-03-10', '09:00', '09:30'), // 30 min
      rec('2026-03-10', '10:00', '10:45'), // 45 min
      rec('2026-03-10', '12:00', '13:00'), // 60 min
    ]
    const totals = calculateDailyStudyTotals(records)
    expect(totals.get('2026-03-10')).toBe(135)
  })
})

// ── calculateCurrentStreak ────────────────────────────────────────────────────

describe('calculateCurrentStreak', () => {
  // Test 5: 29-minute day does not qualify
  it('does not count a day with only 29 minutes (below threshold)', () => {
    const totals = new Map([['2026-01-01', 29]])
    expect(calculateCurrentStreak(totals, '2026-01-01')).toBe(0)
  })

  // Test 6: exactly 30 minutes qualifies
  it('counts a day with exactly 30 minutes (at threshold)', () => {
    const totals = new Map([['2026-01-01', STREAK_MIN_STUDY_MINUTES]])
    expect(calculateCurrentStreak(totals, '2026-01-01')).toBe(1)
  })

  // Test 7: 3 consecutive qualifying days → streak 3
  it('returns streak of 3 for 3 consecutive qualifying days ending today', () => {
    const totals = new Map([
      ['2026-01-01', 60],
      ['2026-01-02', 90],
      ['2026-01-03', 45],
    ])
    expect(calculateCurrentStreak(totals, '2026-01-03')).toBe(3)
  })

  // Test 8: gap day breaks streak
  it('breaks streak at a gap day', () => {
    const totals = new Map([
      ['2026-01-01', 60],
      // 2026-01-02 missing (gap)
      ['2026-01-03', 90],
      ['2026-01-04', 45],
    ])
    expect(calculateCurrentStreak(totals, '2026-01-04')).toBe(2)
  })

  // Test 13: counts today if qualifying
  it('includes today in streak if today qualifies', () => {
    const totals = new Map([
      ['2026-05-10', 60],
      ['2026-05-11', 60],
    ])
    expect(calculateCurrentStreak(totals, '2026-05-11')).toBe(2)
  })

  // Test 14: counts from yesterday if today not yet qualifying
  it('counts from yesterday if today has no study yet', () => {
    const totals = new Map([
      ['2026-05-09', 60],
      ['2026-05-10', 60],
      // 2026-05-11: today, nothing yet
    ])
    expect(calculateCurrentStreak(totals, '2026-05-11')).toBe(2)
  })
})

// ── calculateLongestStreak ────────────────────────────────────────────────────

describe('calculateLongestStreak', () => {
  // Test 9: longest streak remains correct after current streak resets
  it('finds the longest streak even when current streak is shorter', () => {
    const totals = new Map([
      ['2026-01-01', 60],
      ['2026-01-02', 60],
      ['2026-01-03', 60],
      // gap
      ['2026-01-05', 60],
      ['2026-01-06', 60],
    ])
    expect(calculateLongestStreak(totals)).toBe(3)
  })

  // Test 15: empty map → 0
  it('returns 0 for empty map', () => {
    expect(calculateLongestStreak(new Map())).toBe(0)
  })
})

// ── calculateWeeklyStudyMinutes ───────────────────────────────────────────────

describe('calculateWeeklyStudyMinutes', () => {
  // Test 10: sums only last 7 days
  it('sums only the last 7 days relative to todayDate', () => {
    const totals = new Map([
      ['2026-01-01', 60], // outside 7-day window when today = 2026-01-08
      ['2026-01-02', 45], // also outside
      ['2026-01-03', 30], // 7th day back from 2026-01-09
      ['2026-01-04', 30],
      ['2026-01-05', 60],
      ['2026-01-06', 60],
      ['2026-01-07', 90],
      ['2026-01-08', 120],
      ['2026-01-09', 45],
    ])
    // Today = 2026-01-09, window = 2026-01-03 to 2026-01-09
    const result = calculateWeeklyStudyMinutes(totals, '2026-01-09')
    expect(result).toBe(30 + 30 + 60 + 60 + 90 + 120 + 45)
  })
})

// ── calculateMonthlyStudyMinutes ──────────────────────────────────────────────

describe('calculateMonthlyStudyMinutes', () => {
  // Test 11: sums only current calendar month
  it('sums only days in the same calendar month as todayDate', () => {
    const totals = new Map([
      ['2026-01-28', 60],
      ['2026-01-29', 60],
      ['2026-01-30', 60],
      ['2026-02-01', 90], // different month
      ['2026-02-02', 120], // different month
    ])
    const result = calculateMonthlyStudyMinutes(totals, '2026-01-30')
    expect(result).toBe(180)
  })
})

// ── formatStudyDuration ───────────────────────────────────────────────────────

describe('formatStudyDuration', () => {
  // Test 17
  it('formats 125 minutes as "2h 05m"', () => {
    expect(formatStudyDuration(125)).toBe('2h 05m')
  })

  // Test 18
  it('formats 45 minutes as "45m"', () => {
    expect(formatStudyDuration(45)).toBe('45m')
  })

  // Test 19
  it('formats 0 minutes as "0m"', () => {
    expect(formatStudyDuration(0)).toBe('0m')
  })

  // Test 20
  it('formats 60 minutes as "1h 00m"', () => {
    expect(formatStudyDuration(60)).toBe('1h 00m')
  })
})
