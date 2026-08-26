import { NextRequest } from 'next/server'
import { createOtpRecord, sendOtp, type OtpPurpose, type OtpUserType } from '@/lib/otp'
import prisma from '@/lib/prisma'

// FIX 8-9: Role-aware OTP send
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { mobile, purpose, userType } = body as {
      mobile: string
      purpose: OtpPurpose
      userType: OtpUserType
    }

    // Validate
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      return Response.json({ error: 'Invalid mobile number' }, { status: 400 })
    }
    if (!['REGISTRATION', 'FORGOT_PASSWORD'].includes(purpose)) {
      return Response.json({ error: 'Invalid purpose' }, { status: 400 })
    }
    if (!['STUDENT', 'LIBRARY_OWNER'].includes(userType)) {
      return Response.json({ error: 'Invalid user type' }, { status: 400 })
    }

    const expectedRole = userType === 'STUDENT' ? 'STUDENT' : 'LIBRARY_OWNER'

    // FIX 9: For FORGOT_PASSWORD — verify specific role account exists
    if (purpose === 'FORGOT_PASSWORD') {
      const user = await prisma.user.findFirst({ 
        where: { mobile, role: expectedRole } 
      })
      // Generic message to prevent account enumeration
      if (!user) {
        return Response.json({
          success: true,
          message: 'If a matching account exists, an OTP has been sent.',
        })
      }
    }

    // FIX 8: For REGISTRATION — check only for same role account
    if (purpose === 'REGISTRATION') {
      const existing = await prisma.user.findFirst({ 
        where: { mobile, role: expectedRole } 
      })
      if (existing) {
        const accountType = userType === 'STUDENT' ? 'student' : 'library owner'
        return Response.json({ 
          error: `A ${accountType} account already exists with this mobile number` 
        }, { status: 409 })
      }
    }

    const result = await createOtpRecord(mobile, purpose, userType)

    if (!result.success) {
      return Response.json(
        { error: `Please wait ${result.cooldownSeconds} seconds before requesting another OTP.` },
        { status: 429 }
      )
    }

    const { sent, error: smsError } = await sendOtp(mobile, result.otp!)

    if (!sent) {
      return Response.json(
        { error: smsError ?? 'Failed to send OTP. Please try again.' },
        { status: 500 }
      )
    }

    return Response.json({
      success: true,
      message: `OTP sent to ${mobile.slice(0, 2)}XXXXXX${mobile.slice(-2)}`,
      expiresInMinutes: parseInt(process.env.OTP_EXPIRY_MINUTES ?? '5'),
    })
  } catch (error) {
    console.error('Send OTP error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
