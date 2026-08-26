import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { startOfMonth, startOfYear, subMonths, format } from 'date-fns'

export async function GET(request: NextRequest) {
  try {
    await requireAuth(['SUPER_ADMIN'])

    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    const dateFilter: Record<string, unknown> = {}
    if (from) dateFilter.gte = new Date(from)
    if (to) dateFilter.lte = new Date(to)

    const paymentWhere: Record<string, unknown> = { status: 'PAID' }
    if (from || to) paymentWhere.createdAt = dateFilter

    const [totalRevenue, monthlyRevenue, yearlyRevenue, refunds] =
      await Promise.all([
        prisma.payment.aggregate({
          where: paymentWhere,
          _sum: { amount: true, platformFee: true, ownerAmount: true },
        }),
        prisma.payment.aggregate({
          where: { status: 'PAID', createdAt: { gte: startOfMonth(new Date()) } },
          _sum: { amount: true, platformFee: true },
        }),
        prisma.payment.aggregate({
          where: { status: 'PAID', createdAt: { gte: startOfYear(new Date()) } },
          _sum: { amount: true },
        }),
        prisma.payment.aggregate({
          where: { status: { in: ['REFUNDED', 'PARTIALLY_REFUNDED'] } },
          _sum: { refundAmount: true },
        }),
      ])

    // Monthly breakdown for chart - last 12 months
    const last12Months = Array.from({ length: 12 }, (_, i) => {
      const d = subMonths(new Date(), 11 - i)
      return { year: d.getFullYear(), month: d.getMonth() + 1, label: format(d, 'MMM yy') }
    })

    const monthlyBreakdown = await Promise.all(
      last12Months.map(async ({ year, month, label }) => {
        const start = new Date(year, month - 1, 1)
        const end = new Date(year, month, 0, 23, 59, 59)
        const result = await prisma.payment.aggregate({
          where: { status: 'PAID', createdAt: { gte: start, lte: end } },
          _sum: { amount: true },
        })
        return { label, amount: result._sum.amount ?? 0 }
      })
    )

    const membershipRevenue = await prisma.payment.aggregate({
      where: { status: 'PAID', membershipId: { not: null }, ...(from || to ? { createdAt: dateFilter } : {}) },
      _sum: { amount: true },
    })

    const bookingRevenue = await prisma.payment.aggregate({
      where: { status: 'PAID', bookingId: { not: null }, ...(from || to ? { createdAt: dateFilter } : {}) },
      _sum: { amount: true },
    })

    // Settlement breakdown
    const [settledCount, pendingSettlementCount, retryCount] = await Promise.all([
      prisma.payment.count({ where: { ...paymentWhere, settlementStatus: 'PROCESSED' } }),
      prisma.payment.count({ where: { ...paymentWhere, settlementStatus: 'PENDING' } }),
      prisma.payment.count({ where: { ...paymentWhere, settlementStatus: 'RETRY_REQUIRED' } }),
    ])

    return Response.json({
      total: totalRevenue._sum.amount ?? 0,
      monthly: monthlyRevenue._sum.amount ?? 0,
      yearly: yearlyRevenue._sum.amount ?? 0,
      refunds: refunds._sum.refundAmount ?? 0,
      membershipRevenue: membershipRevenue._sum.amount ?? 0,
      bookingRevenue: bookingRevenue._sum.amount ?? 0,
      monthlyBreakdown,
      // Platform commission breakdown
      totalPlatformFee: totalRevenue._sum.platformFee ?? 0,
      totalOwnerSettled: totalRevenue._sum.ownerAmount ?? 0,
      monthlyPlatformFee: monthlyRevenue._sum.platformFee ?? 0,
      // Settlement health
      settlement: {
        settled: settledCount,
        pending: pendingSettlementCount,
        retryRequired: retryCount,
      },
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown'
    if (msg === 'UNAUTHORIZED') return Response.json({ error: 'Unauthorized' }, { status: 401 })
    if (msg === 'FORBIDDEN') return Response.json({ error: 'Forbidden' }, { status: 403 })
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
