import { describe, it, expect } from 'vitest'
import { calcPlanEndDate } from '@/lib/validations'

// ── calcPlanEndDate ────────────────────────────────────────────────────────────

describe('calcPlanEndDate – DAY', () => {
  it('adds exact days', () => {
    const result = calcPlanEndDate(new Date('2026-01-01'), 7, 'DAY')
    expect(result.toISOString().slice(0, 10)).toBe('2026-01-08')
  })
})

describe('calcPlanEndDate – WEEK', () => {
  it('adds exact weeks', () => {
    const result = calcPlanEndDate(new Date('2026-01-01'), 2, 'WEEK')
    expect(result.toISOString().slice(0, 10)).toBe('2026-01-15')
  })
})

describe('calcPlanEndDate – MONTH (normal)', () => {
  it('Mar 15 + 1 month = Apr 15', () => {
    const result = calcPlanEndDate(new Date('2026-03-15'), 1, 'MONTH')
    expect(result.toISOString().slice(0, 10)).toBe('2026-04-15')
  })

  it('Jan 15 + 3 months = Apr 15', () => {
    const result = calcPlanEndDate(new Date('2026-01-15'), 3, 'MONTH')
    expect(result.toISOString().slice(0, 10)).toBe('2026-04-15')
  })
})

describe('calcPlanEndDate – MONTH end-of-month clamping', () => {
  it('Jan 31 + 1 month = Feb 28 (not Mar 3)', () => {
    const result = calcPlanEndDate(new Date('2026-01-31'), 1, 'MONTH')
    expect(result.toISOString().slice(0, 10)).toBe('2026-02-28')
  })

  it('Jan 31 + 1 month = Feb 29 on a leap year', () => {
    const result = calcPlanEndDate(new Date('2024-01-31'), 1, 'MONTH')
    expect(result.toISOString().slice(0, 10)).toBe('2024-02-29')
  })

  it('Mar 31 + 1 month = Apr 30 (not May 1)', () => {
    const result = calcPlanEndDate(new Date('2026-03-31'), 1, 'MONTH')
    expect(result.toISOString().slice(0, 10)).toBe('2026-04-30')
  })

  it('May 31 + 1 month = Jun 30 (not Jul 1)', () => {
    const result = calcPlanEndDate(new Date('2026-05-31'), 1, 'MONTH')
    expect(result.toISOString().slice(0, 10)).toBe('2026-06-30')
  })

  it('Aug 31 + 3 months = Nov 30', () => {
    const result = calcPlanEndDate(new Date('2026-08-31'), 3, 'MONTH')
    expect(result.toISOString().slice(0, 10)).toBe('2026-11-30')
  })

  it('Oct 31 + 4 months = Feb 28', () => {
    const result = calcPlanEndDate(new Date('2026-10-31'), 4, 'MONTH')
    expect(result.toISOString().slice(0, 10)).toBe('2027-02-28')
  })

  it('Feb 28 + 1 month = Mar 28 (no clamp needed)', () => {
    const result = calcPlanEndDate(new Date('2026-02-28'), 1, 'MONTH')
    expect(result.toISOString().slice(0, 10)).toBe('2026-03-28')
  })
})

describe('calcPlanEndDate – YEAR', () => {
  it('adds exact years', () => {
    const result = calcPlanEndDate(new Date('2026-06-15'), 1, 'YEAR')
    expect(result.toISOString().slice(0, 10)).toBe('2027-06-15')
  })
})
