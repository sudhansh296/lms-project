import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import prisma from '@/lib/prisma'
import { hashPassword, createToken, createAuditLog } from '@/lib/auth'
import { studentRegisterSchema } from '@/lib/validations'

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

    const { mobile, name, email, password } = parsed.data

    const existing = await prisma.user.findUnique({ where: { mobile } })
    if (existing) {
      return Response.json({ error: 'Mobile number already registered' }, { status: 409 })
    }

    if (email) {
      const emailExists = await prisma.user.findUnique({ where: { email } })
      if (emailExists) {
        return Response.json({ error: 'Email already registered' }, { status: 409 })
      }
    }

    const passwordHash = await hashPassword(password)

    const user = await prisma.user.create({
      data: {
        mobile,
        name,
        email: email || null,
        passwordHash,
        role: 'STUDENT',
        student: {
          create: {},
        },
      },
      include: { student: true },
    })

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
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
