import { requireAuth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { startOfMonth, startOfDay } from 'date-fns'

export async function GET() {
  try {
    await requireAuth(['SUPER_ADMIN'])

    const today = startOfDay(new Date())
    const monthStart = startOfMonth(new Date())

    const [
      totalLibraries,
      activeLibraries,
      pendingLibraries,
      suspendedLibraries,
      totalStudents,
      activeStudents,
      newStudentsThisMonth,
      totalBookings,
      todaysBookings,
      upcomingBookings,
      totalRevenue,
      monthlyRevenue,
      activeSubscriptions,
      trialSubscriptions,
      expiredSubscriptions,
    ] = await Promise.all([
      prisma.library.count(),
      prisma.library.count({ where: { status: 'ACTIVE' } }),
      prisma.library.count({ where: { status: 'PENDING_VERIFICATION' } }),
      prisma.library.count({ where: { status: 'SUSPENDED' } }),
      prisma.student.count(),
      prisma.user.count({ where: { role: 'STUDENT', isActive: true } }),
      prisma.user.count({
        where: { role: 'STUDENT', createdAt: { gte: monthStart } },
      }),
      prisma.booking.count(),
      prisma.booking.count({
        where: { bookingDate: { gte: today } },
      }),
      prisma.booking.count({
        where: { startTime: { gte: new Date() }, status: 'CONFIRMED' },
      }),
      prisma.payment.aggregate({
        where: { status: 'PAID' },
        _sum: { amount: true },
      }),
      prisma.payment.aggregate({
        where: { status: 'PAID', createdAt: { gte: monthStart } },
        _sum: { amount: true },
      }),
      prisma.ownerSubscription.count({ where: { status: 'ACTIVE' } }),
      prisma.ownerSubscription.count({ where: { status: 'TRIAL' } }),
      prisma.ownerSubscription.count({ where: { status: 'EXPIRED' } }),
    ])

    return Response.json({
      libraries: {
        total: totalLibraries,
        active: activeLibraries,
        pending: pendingLibraries,
        suspended: suspendedLibraries,
      },
      students: {
        total: totalStudents,
        active: activeStudents,
        newThisMonth: newStudentsThisMonth,
      },
      bookings: {
        total: totalBookings,
        today: todaysBookings,
        upcoming: upcomingBookings,
      },
      revenue: {
        total: totalRevenue._sum.amount ?? 0,
        monthly: monthlyRevenue._sum.amount ?? 0,
      },
      subscriptions: {
        active: activeSubscriptions,
        trial: trialSubscriptions,
        expired: expiredSubscriptions,
      },
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown'
    if (msg === 'UNAUTHORIZED') return Response.json({ error: 'Unauthorized' }, { status: 401 })
    if (msg === 'FORBIDDEN') return Response.json({ error: 'Forbidden' }, { status: 403 })
    console.error('Admin stats error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
