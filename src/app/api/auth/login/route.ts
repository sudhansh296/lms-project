import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import prisma from '@/lib/prisma'
import { verifyPassword, createToken, createAuditLog } from '@/lib/auth'
import { loginSchema } from '@/lib/validations'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = loginSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { mobile, password } = parsed.data

    const user = await prisma.user.findUnique({
      where: { mobile },
      include: { libraryOwner: true, student: true },
    })

    if (!user || !user.passwordHash) {
      return Response.json({ error: 'Invalid mobile or password' }, { status: 401 })
    }

    if (!user.isActive) {
      return Response.json({ error: 'Account is deactivated' }, { status: 403 })
    }

    const valid = await verifyPassword(password, user.passwordHash)
    if (!valid) {
      return Response.json({ error: 'Invalid mobile or password' }, { status: 401 })
    }

    const sessionUser = {
      id: user.student?.id ?? user.libraryOwner?.id ?? user.id,
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
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    })

    await createAuditLog({
      userId: user.id,
      role: user.role,
      action: 'LOGIN',
      ip: request.headers.get('x-forwarded-for') ?? undefined,
    })

    return Response.json({ user: sessionUser })
  } catch (error) {
    console.error('Login error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
