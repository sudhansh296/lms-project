import { describe, it, expect } from 'vitest'
import {
  getMembershipLevel,
  getNextLevelInfo,
  generateReferralCode,
  REFERRAL_THRESHOLDS,
  LEVEL_BENEFITS,
} from '@/lib/referral'

// ── getMembershipLevel ─────────────────────────────────────────────────────────

describe('getMembershipLevel', () => {
  it('0 qualified = STANDARD', () => {
    expect(getMembershipLevel(0)).toBe('STANDARD')
  })

  it('19 qualified = STANDARD (below LEVEL_1 threshold)', () => {
    expect(getMembershipLevel(19)).toBe('STANDARD')
  })

  it('20 qualified = LEVEL_1', () => {
    expect(getMembershipLevel(20)).toBe('LEVEL_1')
  })

  it('49 qualified = LEVEL_1 (below LEVEL_2 threshold)', () => {
    expect(getMembershipLevel(49)).toBe('LEVEL_1')
  })

  it('50 qualified = LEVEL_2', () => {
    expect(getMembershipLevel(50)).toBe('LEVEL_2')
  })

  it('9999 qualified = LEVEL_2 (LEVEL_3 removed, LEVEL_2 is max)', () => {
    expect(getMembershipLevel(9999)).toBe('LEVEL_2')
  })
})

// ── getNextLevelInfo ───────────────────────────────────────────────────────────

describe('getNextLevelInfo', () => {
  it('STANDARD: next is LEVEL_1, needed = 20', () => {
    const info = getNextLevelInfo(0)
    expect(info.nextLevel).toBe('LEVEL_1')
    expect(info.needed).toBe(20)
    expect(info.threshold).toBe(REFERRAL_THRESHOLDS.LEVEL_1)
  })

  it('at 10: needs 10 more for LEVEL_1', () => {
    const info = getNextLevelInfo(10)
    expect(info.nextLevel).toBe('LEVEL_1')
    expect(info.needed).toBe(10)
  })

  it('LEVEL_1: next is LEVEL_2, needed = 30', () => {
    const info = getNextLevelInfo(20)
    expect(info.nextLevel).toBe('LEVEL_2')
    expect(info.needed).toBe(30)
    expect(info.threshold).toBe(REFERRAL_THRESHOLDS.LEVEL_2)
  })

  it('LEVEL_2 (50): no next level', () => {
    const info = getNextLevelInfo(50)
    expect(info.nextLevel).toBeNull()
    expect(info.needed).toBe(0)
  })

  it('LEVEL_2 (100): still no next level — LEVEL_3 is gone', () => {
    const info = getNextLevelInfo(100)
    expect(info.nextLevel).toBeNull()
  })
})

// ── LEVEL_BENEFITS ─────────────────────────────────────────────────────────────

describe('LEVEL_BENEFITS', () => {
  it('LEVEL_3 key does not exist', () => {
    expect('LEVEL_3' in LEVEL_BENEFITS).toBe(false)
  })

  it('STANDARD maxSeats = 250', () => {
    expect(LEVEL_BENEFITS.STANDARD.maxSeats).toBe(250)
  })

  it('LEVEL_2 maxBranches = 5', () => {
    expect(LEVEL_BENEFITS.LEVEL_2.maxBranches).toBe(5)
  })
})

// ── generateReferralCode ───────────────────────────────────────────────────────

describe('generateReferralCode', () => {
  it('starts with STUDYLIB-', () => {
    const code = generateReferralCode()
    expect(code.startsWith('STUDYLIB-')).toBe(true)
  })

  it('total length is 14 (STUDYLIB- = 9 + 5 suffix)', () => {
    const code = generateReferralCode()
    expect(code.length).toBe(14)
  })

  it('suffix contains only unambiguous characters', () => {
    const code = generateReferralCode()
    const suffix = code.slice(9)
    expect(suffix).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/)
  })

  it('generates different codes on repeated calls', () => {
    const codes = new Set(Array.from({ length: 50 }, generateReferralCode))
    expect(codes.size).toBeGreaterThan(45) // near-zero collision probability
  })
})
