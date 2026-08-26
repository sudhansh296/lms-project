import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import prisma from '@/lib/prisma'
import { verifyPassword, createToken, createAuditLog } from '@/lib/auth'
import { loginSchema } from '@/lib/validations'
import type { Role } from '@/generated/prisma/client'

// FIX 4-5: Map UI account types to database roles
function mapLoginAsToRoles(loginAs: 'STUDENT' | 'OWNER' | 'ADMIN'): Role[] {
  switch (loginAs) {
    case 'STUDENT':
      return ['STUDENT']
    case 'OWNER':
      // Owner interface serves all owner-side roles
      return ['LIBRARY_OWNER', 'LIBRARY_MANAGER', 'LIBRARY_STAFF']
    case 'ADMIN':
      return ['SUPER_ADMIN']
    default:
      return []
  }
}

// FIX 4: Role-aware login - authenticate specific account type
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

    const { mobile, password, loginAs } = parsed.data
    const allowedRoles = mapLoginAsToRoles(loginAs)

    if (allowedRoles.length === 0) {
      return Response.json({ error: 'Invalid account type' }, { status: 400 })
    }

    // FIX 4: Find user with specific role for selected account type
    const user = await prisma.user.findFirst({
      where: { 
        mobile,
        role: { in: allowedRoles }
      },
      include: { libraryOwner: true, student: true },
    })

    // FIX 4: Role-specific error messages
    if (!user || !user.passwordHash) {
      const accountName = loginAs === 'STUDENT' ? 'student' : 
                         loginAs === 'OWNER' ? 'owner' : 'admin'
      return Response.json({ 
        error: `Invalid ${accountName} mobile or password` 
      }, { status: 401 })
    }

    if (!user.isActive) {
      return Response.json({ error: 'Account is deactivated' }, { status: 403 })
    }

    const valid = await verifyPassword(password, user.passwordHash)
    if (!valid) {
      const accountName = loginAs === 'STUDENT' ? 'student' : 
                         loginAs === 'OWNER' ? 'owner' : 'admin'
      return Response.json({ 
        error: `Invalid ${accountName} mobile or password` 
      }, { status: 401 })
    }

    // FIX 20: Session represents selected role correctly
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

    // FIX 21: Replace any existing session cookie
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
      metadata: { loginAs },
    })

    return Response.json({ user: sessionUser })
  } catch (error) {
    console.error('Login error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
