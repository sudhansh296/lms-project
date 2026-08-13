import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import prisma from './prisma'

const OTP_EXPIRY_MINUTES = parseInt(process.env.OTP_EXPIRY_MINUTES ?? '5')
const OTP_MAX_ATTEMPTS = parseInt(process.env.OTP_MAX_ATTEMPTS ?? '5')
const OTP_RESEND_COOLDOWN_SECONDS = parseInt(process.env.OTP_RESEND_COOLDOWN_SECONDS ?? '60')

export type OtpPurpose = 'REGISTRATION' | 'FORGOT_PASSWORD'
export type OtpUserType = 'STUDENT' | 'LIBRARY_OWNER'

/** Generate a cryptographically secure 6-digit OTP */
export function generateOtp(): string {
  const buffer = crypto.randomBytes(3)
  const num = (buffer.readUIntBE(0, 3) % 900000) + 100000
  return num.toString()
}

/** Hash OTP using bcrypt (cost 10 is fine for short-lived tokens) */
export async function hashOtp(otp: string): Promise<string> {
  return bcrypt.hash(otp, 10)
}

/** Compare plaintext OTP against stored hash */
export async function verifyOtpHash(otp: string, hash: string): Promise<boolean> {
  return bcrypt.compare(otp, hash)
}

/**
 * Create or replace an OTP record.
 * Enforces resend cooldown. Returns { success, cooldownSeconds }.
 */
export async function createOtpRecord(
  mobile: string,
  purpose: OtpPurpose,
  userType: OtpUserType
): Promise<{ success: boolean; cooldownSeconds?: number; otp?: string }> {
  // Check for existing non-expired OTP and enforce cooldown
  const existing = await prisma.otpVerification.findFirst({
    where: {
      mobile,
      purpose,
      userType,
      verified: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  })

  if (existing) {
    const secondsSinceCreation = (Date.now() - new Date(existing.createdAt).getTime()) / 1000
    if (secondsSinceCreation < OTP_RESEND_COOLDOWN_SECONDS) {
      return {
        success: false,
        cooldownSeconds: Math.ceil(OTP_RESEND_COOLDOWN_SECONDS - secondsSinceCreation),
      }
    }
    // Invalidate old OTP
    await prisma.otpVerification.updateMany({
      where: { mobile, purpose, userType, verified: false },
      data: { expiresAt: new Date() }, // expire immediately
    })
  }

  const otp = generateOtp()
  const otpHash = await hashOtp(otp)
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000)

  await prisma.otpVerification.create({
    data: { mobile, otpHash, purpose, userType, expiresAt },
  })

  return { success: true, otp }
}

/**
 * Verify OTP. Returns { valid, error }.
 * Increments attempt counter. Invalidates on success.
 */
export async function verifyOtpRecord(
  mobile: string,
  otp: string,
  purpose: OtpPurpose,
  userType: OtpUserType
): Promise<{ valid: boolean; error?: string }> {
  const record = await prisma.otpVerification.findFirst({
    where: {
      mobile,
      purpose,
      userType,
      verified: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  })

  if (!record) {
    return { valid: false, error: 'OTP expired or not found. Please request a new OTP.' }
  }

  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    return { valid: false, error: 'Too many incorrect attempts. Please request a new OTP.' }
  }

  const isValid = await verifyOtpHash(otp, record.otpHash)

  if (!isValid) {
    await prisma.otpVerification.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    })
    const remaining = OTP_MAX_ATTEMPTS - record.attempts - 1
    return {
      valid: false,
      error: remaining > 0
        ? `Incorrect OTP. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
        : 'Too many incorrect attempts. Please request a new OTP.',
    }
  }

  // Mark as verified and expire immediately
  await prisma.otpVerification.update({
    where: { id: record.id },
    data: { verified: true, expiresAt: new Date() },
  })

  return { valid: true }
}

/**
 * Send OTP via configured provider.
 * CONSOLE provider prints to server logs (safe for development).
 */
export async function sendOtp(mobile: string, otp: string): Promise<{ sent: boolean; error?: string }> {
  const provider = process.env.OTP_PROVIDER ?? 'CONSOLE'

  if (provider === 'CONSOLE') {
    // Development mode — log to server console, never to client
    console.log(`[OTP DEV] Mobile: ${mobile} | OTP: ${otp} | Expires in: ${OTP_EXPIRY_MINUTES} minutes`)
    return { sent: true }
  }

  if (provider === 'FAST2SMS') {
    return sendFast2Sms(mobile, otp)
  }

  if (provider === 'MSG91') {
    return sendMsg91(mobile, otp)
  }

  return { sent: false, error: 'Unknown OTP provider configured' }
}

async function sendFast2Sms(mobile: string, otp: string): Promise<{ sent: boolean; error?: string }> {
  try {
    const res = await fetch('https://www.fast2sms.com/dev/bulkV2', {
      method: 'POST',
      headers: {
        authorization: process.env.OTP_API_KEY ?? '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        route: 'otp',
        variables_values: otp,
        numbers: mobile,
      }),
    })
    const data = await res.json()
    if (!data.return) return { sent: false, error: data.message ?? 'SMS failed' }
    return { sent: true }
  } catch (e) {
    return { sent: false, error: 'Failed to send SMS' }
  }
}

async function sendMsg91(mobile: string, otp: string): Promise<{ sent: boolean; error?: string }> {
  try {
    const res = await fetch('https://api.msg91.com/api/v5/otp', {
      method: 'POST',
      headers: {
        authkey: process.env.OTP_API_KEY ?? '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mobile: `91${mobile}`,
        otp,
        sender: process.env.OTP_SENDER_ID ?? 'STUDYLIB',
        otp_length: 6,
        otp_expiry: OTP_EXPIRY_MINUTES,
      }),
    })
    const data = await res.json()
    if (data.type !== 'success') return { sent: false, error: data.message ?? 'SMS failed' }
    return { sent: true }
  } catch {
    return { sent: false, error: 'Failed to send SMS' }
  }
}
