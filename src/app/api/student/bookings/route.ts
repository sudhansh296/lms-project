import { NextRequest } from 'next/server'
import { requireAuth, createAuditLog } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { serialize } from '@/lib/serialize'

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(['STUDENT'])
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') ?? ''
    const page = parseInt(searchParams.get('page') ?? '1')
    const limit = parseInt(searchParams.get('limit') ?? '10')
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = { studentId: session.id }
    if (status) where.status = status

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          library: {
            select: {
              id: true, name: true, city: true, area: true,
              phone: true, emailContact: true,
              photos: { where: { isCover: true }, take: 1 },
            },
          },
          seat: true,
          plan: { select: { name: true, price: true } },
          payment: true,
          attendances: true, // P0-1: Changed to one-to-many
        },
        orderBy: { startTime: 'desc' },
        skip,
        take: limit,
      }),
      prisma.booking.count({ where }),
    ])

    return Response.json(serialize({
      bookings,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    }))
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : ''
    if (msg === 'UNAUTHORIZED') return Response.json({ error: 'Unauthorized' }, { status: 401 })
    if (msg === 'FORBIDDEN') return Response.json({ error: 'Forbidden' }, { status: 403 })
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST endpoint is DISABLED for security reasons.
 * Frontend must never control authoritative booking amount.
 * 
 * Use the secure seat booking checkout flow:
 * POST /api/payments/seat-order
 */
export async function POST(_request: NextRequest) {
  return Response.json({
    error: 'Direct booking creation is no longer supported.',
    message: 'Use the secure seat booking checkout flow: POST /api/payments/seat-order',
  }, { status: 410 })
}
