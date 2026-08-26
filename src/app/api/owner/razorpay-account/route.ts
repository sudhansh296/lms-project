import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import prisma from '@/lib/prisma'

// GET — fetch current linked account status
export async function GET() {
  try {
    const session = await requireAuth(['LIBRARY_OWNER'])
    const owner = await prisma.libraryOwner.findUnique({
      where: { userId: session.userId },
      select: { razorpayAccountId: true, razorpayAccountStatus: true },
    })
    return Response.json({ owner })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : ''
    if (msg === 'UNAUTHORIZED') return Response.json({ error: 'Unauthorized' }, { status: 401 })
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST — DISABLED: Owner must never manually enter account IDs
// The secure Route onboarding flow creates accounts via the platform:
// 1. POST /api/owner/settlement/onboard (creates stakeholder)
// 2. POST /api/owner/settlement/bank (creates product/account)
// 3. GET /api/owner/settlement/sync (fetches status)
//
// This ensures proper KYC, platform ownership, and compliance.
export async function POST(request: NextRequest) {
  try {
    await requireAuth(['LIBRARY_OWNER'])
    
    return Response.json({
      error: 'This endpoint is disabled for security.',
      details: 'Use the settlement onboarding flow: /api/owner/settlement/onboard and /api/owner/settlement/bank',
    }, { status: 410 }) // 410 Gone
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : ''
    if (msg === 'UNAUTHORIZED') return Response.json({ error: 'Unauthorized' }, { status: 401 })
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
