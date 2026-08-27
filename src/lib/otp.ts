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
 * Verify OTP. Returns { valid, error, verificationToken }.
 * Increments attempt counter. Invalidates on success.
 * P0-4 FIX: Returns a short-lived verification token on successful OTP verification
 */
export async function verifyOtpRecord(
  mobile: string,
  otp: string,
  purpose: OtpPurpose,
  userType: OtpUserType
): Promise<{ valid: boolean; error?: string; verificationToken?: string }> {
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

  // P0-1: Generate verification token with OTP record ID for single-use enforcement
  const verificationToken = generateVerificationToken(mobile, purpose, userType, record.id)

  return { valid: true, verificationToken }
}

/**
 * P0-4: Generate a short-lived verification token
 * Format: base64(mobile:purpose:userType:otpRecordId:timestamp:signature)
 * Valid for 5 minutes
 * P0-1: Include otpRecordId for single-use enforcement
 */
function generateVerificationToken(
  mobile: string,
  purpose: OtpPurpose,
  userType: OtpUserType,
  otpRecordId: string
): string {
  const timestamp = Date.now()
  const secret = process.env.NEXTAUTH_SECRET
  
  // P0-5: Throw if secret is missing (should never happen as lib/auth already validates)
  if (!secret || secret === 'fallback-secret-please-set-env') {
    throw new Error('NEXTAUTH_SECRET must be configured for OTP verification')
  }
  
  const payload = `${mobile}:${purpose}:${userType}:${otpRecordId}:${timestamp}`
  
  // Create HMAC signature
  const hmac = crypto.createHmac('sha256', secret)
  hmac.update(payload)
  const signature = hmac.digest('hex')
  
  // Encode token
  const token = Buffer.from(`${payload}:${signature}`).toString('base64')
  return token
}

/**
 * P0-1: Verify and consume verification token
 * Returns { valid, mobile, purpose, userType, otpRecordId } or { valid: false, error }
 */
export function verifyVerificationToken(
  token: string
): { valid: boolean; mobile?: string; purpose?: OtpPurpose; userType?: OtpUserType; otpRecordId?: string; error?: string } {
  try {
    // Decode token
    const decoded = Buffer.from(token, 'base64').toString('utf-8')
    const parts = decoded.split(':')
    
    if (parts.length !== 6) {
      return { valid: false, error: 'Invalid verification token format' }
    }
    
    const [mobile, purpose, userType, otpRecordId, timestampStr, signature] = parts
    const timestamp = parseInt(timestampStr, 10)
    
    // Check expiry (5 minutes)
    const now = Date.now()
    const age = now - timestamp
    const FIVE_MINUTES = 5 * 60 * 1000
    
    if (age > FIVE_MINUTES) {
      return { valid: false, error: 'Verification token expired. Please verify OTP again.' }
    }
    
    // Verify signature
    // P0-5: No fallback
    const secret = process.env.NEXTAUTH_SECRET
    if (!secret || secret === 'fallback-secret-please-set-env') {
      return { valid: false, error: 'Server configuration error' }
    }
    
    const payload = `${mobile}:${purpose}:${userType}:${otpRecordId}:${timestamp}`
    const hmac = crypto.createHmac('sha256', secret)
    hmac.update(payload)
    const expectedSignature = hmac.digest('hex')
    
    if (signature !== expectedSignature) {
      return { valid: false, error: 'Invalid verification token signature' }
    }
    
    // Validate purpose and userType
    if (!['REGISTRATION', 'FORGOT_PASSWORD'].includes(purpose)) {
      return { valid: false, error: 'Invalid token purpose' }
    }
    if (!['STUDENT', 'LIBRARY_OWNER'].includes(userType)) {
      return { valid: false, error: 'Invalid token user type' }
    }
    
    return {
      valid: true,
      mobile,
      purpose: purpose as OtpPurpose,
      userType: userType as OtpUserType,
      otpRecordId,
    }
  } catch {
    return { valid: false, error: 'Failed to verify token' }
  }
}

/**
 * P0-1, P0-3: Mark OTP verification as consumed (single-use enforcement)
 * Uses updateMany with count check for true atomicity
 * Must be called within a transaction with user creation to ensure rollback on failure
 */
export async function consumeOtpVerification(
  otpRecordId: string,
  tx?: any // Prisma transaction client
): Promise<{ consumed: boolean; error?: string }> {
  try {
    const client = tx ?? prisma
    
    // P0-3: Use updateMany to atomically check and update
    // Only updates if consumedAt is NULL (not yet consumed)
    const result = await client.otpVerification.updateMany({
      where: {
        id: otpRecordId,
        verified: true,
        consumedAt: null, // Critical: only update if not yet consumed
      },
      data: {
        consumedAt: new Date(),
      },
    })

    // If count is 0, the OTP was either not found, not verified, or already consumed
    if (result.count === 0) {
      // Determine the specific error
      const record = await client.otpVerification.findUnique({
        where: { id: otpRecordId },
        select: { consumedAt: true, verified: true },
      })

      if (!record) {
        return { consumed: false, error: 'OTP verification record not found' }
      }

      if (!record.verified) {
        return { consumed: false, error: 'OTP was not verified' }
      }

      if (record.consumedAt) {
        return { consumed: false, error: 'Verification token has already been used' }
      }

      // Shouldn't reach here, but safety fallback
      return { consumed: false, error: 'Failed to consume verification token' }
    }

    return { consumed: true }
  } catch (error) {
    console.error('consumeOtpVerification error:', error)
    return { consumed: false, error: 'Failed to consume verification token' }
  }
}

/**
 * Send OTP via configured provider.
 * CONSOLE provider prints to server logs (development only).
 * In production (NODE_ENV=production), CONSOLE is rejected — set OTP_PROVIDER=FAST2SMS or MSG91.
 */
export async function sendOtp(mobile: string, otp: string): Promise<{ sent: boolean; error?: string }> {
  const provider = process.env.OTP_PROVIDER ?? 'CONSOLE'

  if (provider === 'CONSOLE') {
    if (process.env.NODE_ENV === 'production') {
      // Hard-fail in production — never silently drop OTPs
      throw new Error(
        'OTP_PROVIDER is CONSOLE in production. Set OTP_PROVIDER=FAST2SMS or OTP_PROVIDER=MSG91 and provide OTP_API_KEY.'
      )
    }
    // Development mode — log to server console, never to client
    console.log(`[OTP DEV] Mobile: ${mobile} | OTP: ${otp} | Expires in: ${OTP_EXPIRY_MINUTES} minutes`)
    return { sent: true }
  }

  if (provider === 'FAST2SMS') {
    if (!process.env.OTP_API_KEY) {
      throw new Error('OTP_API_KEY must be set when OTP_PROVIDER=FAST2SMS')
    }
    return sendFast2Sms(mobile, otp)
  }

  if (provider === 'MSG91') {
    if (!process.env.OTP_API_KEY) {
      throw new Error('OTP_API_KEY must be set when OTP_PROVIDER=MSG91')
    }
    return sendMsg91(mobile, otp)
  }

  throw new Error(`Unknown OTP_PROVIDER: "${provider}". Valid values: FAST2SMS, MSG91, CONSOLE (dev only).`)
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
