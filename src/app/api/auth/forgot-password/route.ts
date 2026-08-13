import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { verifyOtpRecord, type OtpUserType } from '@/lib/otp'
import { hashPassword } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { mobile, otp, newPassword, userType } = body as {
      mobile: string
      otp: string
      newPassword: string
      userType: OtpUserType
    }

    if (!mobile || !otp || !newPassword || !userType) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (newPassword.length < 6) {
      return Response.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }

    // Verify OTP — purpose must be FORGOT_PASSWORD
    const otpResult = await verifyOtpRecord(mobile, otp, 'FORGOT_PASSWORD', userType)
    if (!otpResult.valid) {
      return Response.json({ error: otpResult.error }, { status: 400 })
    }

    const expectedRole = userType === 'STUDENT' ? 'STUDENT' : 'LIBRARY_OWNER'
    const user = await prisma.user.findUnique({ where: { mobile } })

    if (!user || user.role !== expectedRole) {
      // Generic message
      return Response.json({ error: 'Account not found' }, { status: 404 })
    }

    const passwordHash = await hashPassword(newPassword)
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    })

    return Response.json({ success: true, message: 'Password updated successfully' })
  } catch (error) {
    console.error('Forgot password error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
