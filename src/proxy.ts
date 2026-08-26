import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

// P0-5 FIX: No fallback - fail loudly if NEXTAUTH_SECRET is missing
const JWT_SECRET_ENV = process.env.NEXTAUTH_SECRET
if (!JWT_SECRET_ENV || JWT_SECRET_ENV === 'fallback-secret-please-set-env') {
  throw new Error('NEXTAUTH_SECRET environment variable must be set to a strong secret value')
}
const JWT_SECRET = new TextEncoder().encode(JWT_SECRET_ENV)

interface SessionUser {
  id: string
  userId: string
  name: string
  mobile: string
  role: string
}

async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as unknown as SessionUser
  } catch {
    return null
  }
}

// Page route guards: prefix → allowed roles
const PAGE_GUARDS: Array<{ prefix: string; roles: string[] }> = [
  { prefix: '/admin', roles: ['SUPER_ADMIN'] },
  { prefix: '/owner', roles: ['LIBRARY_OWNER', 'LIBRARY_MANAGER', 'LIBRARY_STAFF'] },
  { prefix: '/student', roles: ['STUDENT'] },
]

// API route guards
const API_GUARDS: Array<{ prefix: string; roles: string[] }> = [
  { prefix: '/api/admin', roles: ['SUPER_ADMIN'] },
  { prefix: '/api/owner', roles: ['LIBRARY_OWNER', 'LIBRARY_MANAGER', 'LIBRARY_STAFF'] },
  { prefix: '/api/student', roles: ['STUDENT'] },
]

// Public paths — no auth needed
const PUBLIC_PREFIXES = [
  '/api/auth/',
  '/api/libraries',
  '/api/payments/',
  '/_next/',
  '/favicon',
  '/login',
  '/register',
]

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Always allow public paths
  if (PUBLIC_PREFIXES.some(p => pathname.startsWith(p)) || pathname === '/') {
    return NextResponse.next()
  }

  const token = request.cookies.get('auth-token')?.value

  // ── API routes ────────────────────────────────────────────────
  if (pathname.startsWith('/api/')) {
    if (!token) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const session = await verifyToken(token)
    if (!session) {
      return Response.json({ error: 'Session expired. Please log in again.' }, { status: 401 })
    }

    for (const guard of API_GUARDS) {
      if (pathname.startsWith(guard.prefix) && !guard.roles.includes(session.role)) {
        return Response.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    // Forward user info to route handlers
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-user-id', session.userId)
    requestHeaders.set('x-user-role', session.role)
    return NextResponse.next({ request: { headers: requestHeaders } })
  }

  // ── Page routes ───────────────────────────────────────────────
  for (const guard of PAGE_GUARDS) {
    if (pathname.startsWith(guard.prefix)) {
      if (!token) {
        return NextResponse.redirect(new URL(`/login?redirect=${encodeURIComponent(pathname)}`, request.url))
      }
      const session = await verifyToken(token)
      if (!session) {
        const response = NextResponse.redirect(new URL('/login', request.url))
        response.cookies.delete('auth-token')
        return response
      }
      if (!guard.roles.includes(session.role)) {
        // Redirect to the correct dashboard
        if (session.role === 'SUPER_ADMIN') {
          return NextResponse.redirect(new URL('/admin', request.url))
        } else if (['LIBRARY_OWNER', 'LIBRARY_MANAGER', 'LIBRARY_STAFF'].includes(session.role)) {
          return NextResponse.redirect(new URL('/owner', request.url))
        } else {
          return NextResponse.redirect(new URL('/student', request.url))
        }
      }
      return NextResponse.next()
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all paths except static files and _next internals.
     * This keeps proxy running for all page and API routes.
     */
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.png$|.*\\.svg$|.*\\.jpg$).*)',
  ],
}
