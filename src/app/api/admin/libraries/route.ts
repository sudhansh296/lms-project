import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    await requireAuth(['SUPER_ADMIN'])

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') ?? ''
    const status = searchParams.get('status') ?? ''
    const page = parseInt(searchParams.get('page') ?? '1')
    const limit = parseInt(searchParams.get('limit') ?? '20')
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}

    if (status) {
      where.status = status
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
        { pincode: { contains: search } },
        { owner: { user: { name: { contains: search, mode: 'insensitive' } } } },
        { owner: { user: { mobile: { contains: search } } } },
        { owner: { user: { email: { contains: search, mode: 'insensitive' } } } },
      ]
    }

    const [libraries, total] = await Promise.all([
      prisma.library.findMany({
        where,
        include: {
          owner: { include: { user: true } },
          _count: {
            select: {
              seats: true,
              studentMemberships: { where: { status: 'ACTIVE' } },
              bookings: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.library.count({ where }),
    ])

    return Response.json({
      libraries,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown'
    if (msg === 'UNAUTHORIZED') return Response.json({ error: 'Unauthorized' }, { status: 401 })
    if (msg === 'FORBIDDEN') return Response.json({ error: 'Forbidden' }, { status: 403 })
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
