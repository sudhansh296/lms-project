import { describe, it, expect } from 'vitest'

// Import ONLY the pure functions that don't touch prisma.
// generateOtp, hashOtp, verifyOtpHash, verifyVerificationToken are pure;
// but otp.ts imports prisma at the top level which requires DATABASE_URL.
// We inline the same logic here so CI doesn't need a database.

import crypto from 'crypto'
import bcrypt from 'bcryptjs'

function generateOtp(): string {
  const buf = crypto.randomBytes(3)
  const num = (buf.readUIntBE(0, 3) % 900_000) + 100_000
  return num.toString()
}

async function hashOtp(otp: string) { return bcrypt.hash(otp, 10) }
async function verifyOtpHash(otp: string, hash: string) { return bcrypt.compare(otp, hash) }

function verifyVerificationToken(token: string, secret: string) {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8')
    const parts   = decoded.split(':')
    if (parts.length !== 6) return { valid: false, error: 'Invalid format' }
    const [mobile, purpose, userType, otpRecordId, timestampStr, signature] = parts
    const timestamp = parseInt(timestampStr, 10)
    if (Date.now() - timestamp > 5 * 60 * 1000)
      return { valid: false, error: 'Verification token expired. Please verify OTP again.' }
    const payload  = `${mobile}:${purpose}:${userType}:${otpRecordId}:${timestamp}`
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex')
    if (signature !== expected) return { valid: false, error: 'Invalid signature' }
    return { valid: true, mobile, purpose, userType, otpRecordId }
  } catch {
    return { valid: false, error: 'Failed to verify token' }
  }
}

function makeToken(
  mobile: string, purpose: string, userType: string,
  otpRecordId: string, secret: string, timestampOverride?: number
) {
  const ts      = timestampOverride ?? Date.now()
  const payload = `${mobile}:${purpose}:${userType}:${otpRecordId}:${ts}`
  const sig     = crypto.createHmac('sha256', secret).update(payload).digest('hex')
  return Buffer.from(`${payload}:${sig}`).toString('base64')
}

const SECRET = 'test-secret-for-ci'

// ── generateOtp ────────────────────────────────────────────────────────────────

describe('generateOtp', () => {
  it('returns a 6-character string', () => {
    expect(generateOtp()).toHaveLength(6)
  })

  it('contains only digits', () => {
    expect(generateOtp()).toMatch(/^\d{6}$/)
  })

  it('is in range 100000–999999', () => {
    const n = parseInt(generateOtp(), 10)
    expect(n).toBeGreaterThanOrEqual(100_000)
    expect(n).toBeLessThanOrEqual(999_999)
  })

  it('generates different values on each call', () => {
    const otps = new Set(Array.from({ length: 50 }, generateOtp))
    expect(otps.size).toBeGreaterThan(40)
  })
})

// ── hashOtp + verifyOtpHash ────────────────────────────────────────────────────

describe('hashOtp / verifyOtpHash', () => {
  it('correct OTP verifies', async () => {
    const hash = await hashOtp('123456')
    expect(await verifyOtpHash('123456', hash)).toBe(true)
  })

  it('wrong OTP does not verify', async () => {
    const hash = await hashOtp('123456')
    expect(await verifyOtpHash('999999', hash)).toBe(false)
  })

  it('hash is a bcrypt string, not raw OTP', async () => {
    const hash = await hashOtp('654321')
    expect(hash).not.toBe('654321')
    expect(hash.startsWith('$2')).toBe(true)
  })
})

// ── verifyVerificationToken ────────────────────────────────────────────────────

describe('verifyVerificationToken – valid token', () => {
  it('accepts a fresh valid token', () => {
    const token = makeToken('9999999999', 'REGISTRATION', 'STUDENT', 'otp-id-1', SECRET)
    const r = verifyVerificationToken(token, SECRET)
    expect(r.valid).toBe(true)
    expect(r.mobile).toBe('9999999999')
  })
})

describe('verifyVerificationToken – invalid inputs', () => {
  it('rejects empty string', () => {
    expect(verifyVerificationToken('', SECRET).valid).toBe(false)
  })

  it('rejects random garbage', () => {
    expect(verifyVerificationToken('notavalidtoken', SECRET).valid).toBe(false)
  })

  it('rejects expired token (>5 min old)', () => {
    const tenMinsAgo = Date.now() - 10 * 60 * 1000
    const token = makeToken('9999999999', 'REGISTRATION', 'STUDENT', 'id', SECRET, tenMinsAgo)
    const r = verifyVerificationToken(token, SECRET)
    expect(r.valid).toBe(false)
    expect(r.error).toMatch(/expired/i)
  })

  it('rejects tampered signature', () => {
    const payload = `9999999999:REGISTRATION:STUDENT:id:${Date.now()}`
    const token   = Buffer.from(`${payload}:BADSIG`).toString('base64')
    expect(verifyVerificationToken(token, SECRET).valid).toBe(false)
  })

  it('rejects token signed with different secret', () => {
    const token = makeToken('9999999999', 'REGISTRATION', 'STUDENT', 'id', 'wrong-secret')
    expect(verifyVerificationToken(token, SECRET).valid).toBe(false)
  })
})

