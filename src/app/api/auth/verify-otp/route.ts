import { NextRequest } from 'next/server'
import { verifyOtpRecord, type OtpPurpose, type OtpUserType } from '@/lib/otp'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { mobile, otp, purpose, userType } = body as {
      mobile: string
      otp: string
      purpose: OtpPurpose
      userType: OtpUserType
    }

    if (!mobile || !otp || !purpose || !userType) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!/^\d{6}$/.test(otp)) {
      return Response.json({ error: 'OTP must be 6 digits' }, { status: 400 })
    }

    const result = await verifyOtpRecord(mobile, otp, purpose, userType)

    if (!result.valid) {
      return Response.json({ error: result.error }, { status: 400 })
    }

    return Response.json({ success: true, verified: true })
  } catch (error) {
    console.error('Verify OTP error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
