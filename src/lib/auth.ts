import { cookies } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'
import bcrypt from 'bcryptjs'
import type { Role } from '@/generated/prisma/client'

// FIX 20: No fallback - fail loudly if JWT_SECRET is missing
const JWT_SECRET_ENV = process.env.NEXTAUTH_SECRET
if (!JWT_SECRET_ENV || JWT_SECRET_ENV === 'fallback-secret-please-set-env') {
  throw new Error('NEXTAUTH_SECRET environment variable must be set to a strong secret value')
}
const JWT_SECRET = new TextEncoder().encode(JWT_SECRET_ENV)

export interface SessionUser {
  id: string
  userId: string
  name: string
  mobile: string
  email?: string | null
  role: Role
  profilePhoto?: string | null
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export async function createToken(payload: SessionUser): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET)
}

export async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as unknown as SessionUser
  } catch {
    return null
  }
}

export async function getSession(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value
    if (!token) return null
    return verifyToken(token)
  } catch {
    return null
  }
}

export async function requireAuth(allowedRoles?: Role[]): Promise<SessionUser> {
  const session = await getSession()
  if (!session) throw new Error('UNAUTHORIZED')
  if (allowedRoles && !allowedRoles.includes(session.role)) throw new Error('FORBIDDEN')
  return session
}

export async function createAuditLog(params: {
  userId?: string
  role?: Role
  libraryId?: string
  action: string
  entityType?: string
  entityId?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>
  ip?: string
}) {
  try {
    const { default: prisma } = await import('./prisma')
    // Build typed create input — use unchecked form to avoid XOR issues
    const data: Record<string, unknown> = {
      action: params.action,
    }
    if (params.userId) data.userId = params.userId
    if (params.role) data.role = params.role
    if (params.libraryId) data.libraryId = params.libraryId
    if (params.entityType) data.entityType = params.entityType
    if (params.entityId) data.entityId = params.entityId
    if (params.metadata) data.metadata = params.metadata
    if (params.ip) data.ip = params.ip

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma.auditLog.create as any)({ data })
  } catch {
    // Audit log failures should not break main flow
  }
}
