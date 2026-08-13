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

// POST — save Razorpay linked account ID
// Owner gets this from their Razorpay dashboard after creating a linked account
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(['LIBRARY_OWNER'])
    const { razorpayAccountId } = await request.json()

    if (!razorpayAccountId || !razorpayAccountId.startsWith('acc_')) {
      return Response.json({
        error: 'Invalid Razorpay account ID. It should start with "acc_"',
      }, { status: 400 })
    }

    const owner = await prisma.libraryOwner.update({
      where: { userId: session.userId },
      data: {
        razorpayAccountId,
        razorpayAccountStatus: 'ACTIVE',
      },
      select: { razorpayAccountId: true, razorpayAccountStatus: true },
    })

    return Response.json({ success: true, owner })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : ''
    if (msg === 'UNAUTHORIZED') return Response.json({ error: 'Unauthorized' }, { status: 401 })
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
