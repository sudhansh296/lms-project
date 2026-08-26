import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import prisma from '@/lib/prisma'
import { hashPassword, createToken, createAuditLog } from '@/lib/auth'
import { studentRegisterSchema, normalizeEmail } from '@/lib/validations'
import { verifyVerificationToken, consumeOtpVerification } from '@/lib/otp'

// FIX 6: Role-aware student registration
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = studentRegisterSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { mobile, name, email, password, verificationToken } = parsed.data

    // FIX 10: Verify OTP registration proof
    const tokenResult = verifyVerificationToken(verificationToken)
    if (!tokenResult.valid) {
      return Response.json({ error: tokenResult.error }, { status: 401 })
    }

    // Verify token matches request data
    if (tokenResult.mobile !== mobile) {
      return Response.json({ 
        error: 'Mobile number mismatch. Please verify OTP again.' 
      }, { status: 401 })
    }

    if (tokenResult.purpose !== 'REGISTRATION') {
      return Response.json({ 
        error: 'Invalid verification token purpose' 
      }, { status: 401 })
    }

    if (tokenResult.userType !== 'STUDENT') {
      return Response.json({ 
        error: 'Invalid verification token user type' 
      }, { status: 401 })
    }

    // P0-1: Check if token was already used (single-use enforcement)
    const consumeResult = await consumeOtpVerification(tokenResult.otpRecordId!)
    if (!consumeResult.consumed) {
      return Response.json({ error: consumeResult.error }, { status: 401 })
    }

    // FIX 6: Check only for existing STUDENT account with this mobile
    const existingStudent = await prisma.user.findFirst({ 
      where: { mobile, role: 'STUDENT' } 
    })
    if (existingStudent) {
      return Response.json({ 
        error: 'Student account already exists with this mobile number' 
      }, { status: 409 })
    }

    // FIX 2: Normalize email and check role-scoped uniqueness
    const normalizedEmailValue = normalizeEmail(email)
    if (normalizedEmailValue) {
      const emailExists = await prisma.user.findFirst({ 
        where: { email: normalizedEmailValue, role: 'STUDENT' } 
      })
      if (emailExists) {
        return Response.json({ 
          error: 'Student account already exists with this email' 
        }, { status: 409 })
      }
    }

    const passwordHash = await hashPassword(password)

    // FIX 18: Create user and student atomically
    const user = await prisma.user.create({
      data: {
        mobile,
        name,
        email: normalizedEmailValue,
        passwordHash,
        role: 'STUDENT',
        student: {
          create: {},
        },
      },
      include: { student: true },
    })

    // FIX 20-21: Create session for new STUDENT account
    const sessionUser = {
      id: user.student!.id,
      userId: user.id,
      name: user.name,
      mobile: user.mobile,
      email: user.email,
      role: user.role,
      profilePhoto: user.profilePhoto,
    }

    const token = await createToken(sessionUser)
    const cookieStore = await cookies()
    cookieStore.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })

    await createAuditLog({
      userId: user.id,
      role: 'STUDENT',
      action: 'STUDENT_REGISTERED',
      entityType: 'Student',
      entityId: user.student!.id,
    })

    return Response.json({ user: sessionUser }, { status: 201 })
  } catch (error) {
    console.error('Student register error:', error)
    // FIX 19: Handle Prisma unique constraint errors
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return Response.json({ 
        error: 'Account with this mobile or email already exists' 
      }, { status: 409 })
    }
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
