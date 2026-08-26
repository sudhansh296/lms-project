import { NextRequest } from 'next/server'
import { requireAuth, createAuditLog } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { addDays } from 'date-fns'

export async function GET() {
  try {
    const session = await requireAuth(['STUDENT'])

    const memberships = await prisma.studentMembership.findMany({
      where: { studentId: session.id },
      include: {
        library: {
          select: {
            id: true, name: true, city: true, area: true,
            photos: { where: { isCover: true }, take: 1 },
            phone: true,
          },
        },
        plan: true,
        payment: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return Response.json({ memberships })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : ''
    if (msg === 'UNAUTHORIZED') return Response.json({ error: 'Unauthorized' }, { status: 401 })
    if (msg === 'FORBIDDEN') return Response.json({ error: 'Forbidden' }, { status: 403 })
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  // DISABLED: This route bypasses the secure seat-order booking flow.
  // Students must book through: POST /api/payments/seat-order
  // which calculates all pricing server-side and uses the secure payment-service finalizer.
  return Response.json({ 
    error: 'This endpoint is deprecated. Please use the booking flow to purchase library access.',
    details: 'POST /api/payments/seat-order for new bookings'
  }, { status: 410 }) // 410 Gone
}
