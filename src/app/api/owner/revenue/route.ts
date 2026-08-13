import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, format } from 'date-fns'

async function getOwnerLibrary(userId: string) {
  return prisma.library.findFirst({ where: { owner: { userId } } })
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(['LIBRARY_OWNER', 'LIBRARY_MANAGER'])
    const library = await getOwnerLibrary(session.userId)
    if (!library) return Response.json({ error: 'Library not found' }, { status: 404 })

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') ?? 'month' // today | yesterday | week | month | custom
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    const now = new Date()
    let dateRange: { gte: Date; lte: Date }

    if (period === 'today') {
      dateRange = { gte: startOfDay(now), lte: endOfDay(now) }
    } else if (period === 'yesterday') {
      const yesterday = new Date(now.getTime() - 86400000)
      dateRange = { gte: startOfDay(yesterday), lte: endOfDay(yesterday) }
    } else if (period === 'week') {
      dateRange = { gte: startOfWeek(now, { weekStartsOn: 1 }), lte: endOfWeek(now, { weekStartsOn: 1 }) }
    } else if (period === 'month') {
      dateRange = { gte: startOfMonth(now), lte: endOfMonth(now) }
    } else if (period === 'custom' && from && to) {
      dateRange = { gte: new Date(from), lte: new Date(to) }
    } else {
      dateRange = { gte: startOfMonth(now), lte: endOfMonth(now) }
    }

    const paymentFilter = {
      status: 'PAID' as const,
      createdAt: dateRange,
      OR: [
        { booking: { libraryId: library.id } },
        { membership: { libraryId: library.id } },
      ],
    }

    const [total, membershipRev, bookingRev, refunds] = await Promise.all([
      prisma.payment.aggregate({ where: paymentFilter, _sum: { amount: true } }),
      prisma.payment.aggregate({
        where: { ...paymentFilter, membershipId: { not: null } },
        _sum: { amount: true },
      }),
      prisma.payment.aggregate({
        where: { ...paymentFilter, bookingId: { not: null } },
        _sum: { amount: true },
      }),
      prisma.payment.aggregate({
        where: {
          status: { in: ['REFUNDED', 'PARTIALLY_REFUNDED'] },
          createdAt: dateRange,
          OR: [
            { booking: { libraryId: library.id } },
            { membership: { libraryId: library.id } },
          ],
        },
        _sum: { refundAmount: true },
      }),
    ])

    // Monthly breakdown last 6 months
    const last6 = Array.from({ length: 6 }, (_, i) => subMonths(now, 5 - i))
    const monthly = await Promise.all(
      last6.map(async (d) => {
        const res = await prisma.payment.aggregate({
          where: {
            status: 'PAID',
            createdAt: { gte: startOfMonth(d), lte: endOfMonth(d) },
            OR: [
              { booking: { libraryId: library.id } },
              { membership: { libraryId: library.id } },
            ],
          },
          _sum: { amount: true },
        })
        return { label: format(d, 'MMM yy'), amount: res._sum.amount ?? 0 }
      })
    )

    return Response.json({
      total: total._sum.amount ?? 0,
      membershipRevenue: membershipRev._sum.amount ?? 0,
      bookingRevenue: bookingRev._sum.amount ?? 0,
      refunds: refunds._sum.refundAmount ?? 0,
      net: (total._sum.amount ?? 0) - (refunds._sum.refundAmount ?? 0),
      monthly,
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : ''
    if (msg === 'UNAUTHORIZED') return Response.json({ error: 'Unauthorized' }, { status: 401 })
    if (msg === 'FORBIDDEN') return Response.json({ error: 'Forbidden' }, { status: 403 })
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
