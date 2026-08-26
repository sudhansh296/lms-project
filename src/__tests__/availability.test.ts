import { describe, it, expect } from 'vitest'
import { addDays, startOfDay, parseISO } from 'date-fns'

// ── Occurrence generation logic (mirrors availability/route.ts) ────────────────

function generateOccurrences(
  startDate: string,
  endDate: string,
  dailyStartTime: string,
  dailyEndTime: string,
  daysOfWeek: number[]
) {
  const occurrences: Array<{ date: string; startTime: Date; endTime: Date }> = []
  let current = startOfDay(parseISO(startDate))
  const endDay = startOfDay(parseISO(endDate))

  while (current <= endDay) {
    const dayOfWeek = current.getDay()
    if (daysOfWeek.includes(dayOfWeek)) {
      const [sh, sm] = dailyStartTime.split(':').map(Number)
      const [eh, em] = dailyEndTime.split(':').map(Number)
      const startTime = new Date(current)
      startTime.setHours(sh, sm, 0, 0)
      const endTime = new Date(current)
      endTime.setHours(eh, em, 0, 0)
      occurrences.push({ date: current.toISOString().slice(0, 10), startTime, endTime })
    }
    current = addDays(current, 1)
  }
  return occurrences
}

// ── occurrence generation ──────────────────────────────────────────────────────

describe('generateOccurrences – daily', () => {
  it('7 days all-days = 7 occurrences', () => {
    const result = generateOccurrences(
      '2026-09-01', '2026-09-07',
      '09:00', '17:00',
      [0, 1, 2, 3, 4, 5, 6]
    )
    expect(result).toHaveLength(7)
  })

  it('Mon-Fri over 1 week = 5 occurrences', () => {
    // Sep 7 2026 is a Monday
    const result = generateOccurrences(
      '2026-09-07', '2026-09-13',
      '09:00', '17:00',
      [1, 2, 3, 4, 5]
    )
    expect(result).toHaveLength(5)
  })

  it('Sat-Sun only over 1 week = 2 occurrences', () => {
    const result = generateOccurrences(
      '2026-09-07', '2026-09-13',
      '10:00', '18:00',
      [0, 6]
    )
    expect(result).toHaveLength(2)
  })

  it('single day included = 1 occurrence', () => {
    const result = generateOccurrences(
      '2026-09-07', '2026-09-07', // Monday
      '09:00', '17:00',
      [1] // Monday
    )
    expect(result).toHaveLength(1)
  })

  it('single day excluded = 0 occurrences', () => {
    const result = generateOccurrences(
      '2026-09-07', '2026-09-07', // Monday
      '09:00', '17:00',
      [6] // Saturday only
    )
    expect(result).toHaveLength(0)
  })
})

describe('generateOccurrences – 3-month Mon-Fri', () => {
  it('Sep–Nov Mon-Fri ≈ 65 occurrences', () => {
    const result = generateOccurrences(
      '2026-09-01', '2026-11-30',
      '09:00', '17:00',
      [1, 2, 3, 4, 5]
    )
    // 13 full weeks = 65 weekdays ± a few depending on start/end day
    expect(result.length).toBeGreaterThanOrEqual(60)
    expect(result.length).toBeLessThanOrEqual(70)
  })
})

describe('generateOccurrences – timestamps', () => {
  it('startTime hour matches dailyStartTime', () => {
    const result = generateOccurrences(
      '2026-09-07', '2026-09-07',
      '14:30', '18:00',
      [1]
    )
    expect(result[0].startTime.getHours()).toBe(14)
    expect(result[0].startTime.getMinutes()).toBe(30)
  })

  it('endTime hour matches dailyEndTime', () => {
    const result = generateOccurrences(
      '2026-09-07', '2026-09-07',
      '09:00', '17:45',
      [1]
    )
    expect(result[0].endTime.getHours()).toBe(17)
    expect(result[0].endTime.getMinutes()).toBe(45)
  })
})

// ── overlap detection ──────────────────────────────────────────────────────────

describe('occurrence overlap detection', () => {
  function overlaps(
    occStart: Date, occEnd: Date,
    conflictStart: Date, conflictEnd: Date
  ): boolean {
    return conflictStart < occEnd && conflictEnd > occStart
  }

  it('no overlap when conflict is before occurrence', () => {
    const occ     = { s: new Date('2026-09-07T09:00'), e: new Date('2026-09-07T17:00') }
    const conflict = { s: new Date('2026-09-07T07:00'), e: new Date('2026-09-07T08:59') }
    expect(overlaps(occ.s, occ.e, conflict.s, conflict.e)).toBe(false)
  })

  it('no overlap when conflict is after occurrence', () => {
    const occ     = { s: new Date('2026-09-07T09:00'), e: new Date('2026-09-07T17:00') }
    const conflict = { s: new Date('2026-09-07T17:01'), e: new Date('2026-09-07T20:00') }
    expect(overlaps(occ.s, occ.e, conflict.s, conflict.e)).toBe(false)
  })

  it('overlap when conflict is entirely inside occurrence', () => {
    const occ     = { s: new Date('2026-09-07T09:00'), e: new Date('2026-09-07T17:00') }
    const conflict = { s: new Date('2026-09-07T10:00'), e: new Date('2026-09-07T12:00') }
    expect(overlaps(occ.s, occ.e, conflict.s, conflict.e)).toBe(true)
  })

  it('overlap when conflict straddles occurrence start', () => {
    const occ     = { s: new Date('2026-09-07T09:00'), e: new Date('2026-09-07T17:00') }
    const conflict = { s: new Date('2026-09-07T08:00'), e: new Date('2026-09-07T10:00') }
    expect(overlaps(occ.s, occ.e, conflict.s, conflict.e)).toBe(true)
  })

  it('overlap when conflict straddles occurrence end', () => {
    const occ     = { s: new Date('2026-09-07T09:00'), e: new Date('2026-09-07T17:00') }
    const conflict = { s: new Date('2026-09-07T16:00'), e: new Date('2026-09-07T18:00') }
    expect(overlaps(occ.s, occ.e, conflict.s, conflict.e)).toBe(true)
  })

  it('boundary: conflict ends exactly at occurrence start = no overlap', () => {
    const occ     = { s: new Date('2026-09-07T09:00'), e: new Date('2026-09-07T17:00') }
    const conflict = { s: new Date('2026-09-07T07:00'), e: new Date('2026-09-07T09:00') }
    expect(overlaps(occ.s, occ.e, conflict.s, conflict.e)).toBe(false)
  })

  it('boundary: conflict starts exactly at occurrence end = no overlap', () => {
    const occ     = { s: new Date('2026-09-07T09:00'), e: new Date('2026-09-07T17:00') }
    const conflict = { s: new Date('2026-09-07T17:00'), e: new Date('2026-09-07T19:00') }
    expect(overlaps(occ.s, occ.e, conflict.s, conflict.e)).toBe(false)
  })
})
