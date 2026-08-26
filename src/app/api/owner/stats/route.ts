import { requireAuth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { startOfDay, startOfMonth, addDays } from 'date-fns'

export async function GET() {
  try {
    const session = await requireAuth(['LIBRARY_OWNER', 'LIBRARY_MANAGER', 'LIBRARY_STAFF'])

    const library = await prisma.library.findFirst({
      where: { owner: { userId: session.userId } },
    })

    if (!library) {
      return Response.json({ error: 'Library not found' }, { status: 404 })
    }

    const libId = library.id
    const today = startOfDay(new Date())
    const monthStart = startOfMonth(new Date())
    const in5Days = addDays(new Date(), 5)

    const [
      totalSeats,
      availableSeats,
      occupiedSeats,
      maintenanceSeats,
      todaysOccurrences,
      activeStudents,
      expiringBookings,
      todayRevenue,
      monthlyRevenue,
    ] = await Promise.all([
      prisma.seat.count({ where: { libraryId: libId } }),
      prisma.seat.count({ where: { libraryId: libId, status: 'AVAILABLE' } }),
      prisma.seat.count({ where: { libraryId: libId, status: 'OCCUPIED' } }),
      prisma.seat.count({ where: { libraryId: libId, status: 'MAINTENANCE' } }),

      // Today's check-ins: count CONFIRMED BookingOccurrences for today
      // (not parent Bookings, which span weeks/months)
      prisma.bookingOccurrence.count({
        where: {
          booking: { libraryId: libId },
          date: { gte: today, lt: addDays(today, 1) },
          status: { in: ['CONFIRMED', 'COMPLETED'] },
        },
      }),

      // Active students: distinct students with a CONFIRMED booking active today
      // (seat entitlement is a Booking, not a StudentMembership)
      prisma.booking.findMany({
        where: {
          libraryId: libId,
          status: { in: ['CONFIRMED', 'ACTIVE'] },
          endDate: { gte: today },
        },
        select: { studentId: true },
        distinct: ['studentId'],
      }).then(rows => rows.length),

      // Bookings expiring in next 5 days (entitlement expiry warning)
      prisma.booking.count({
        where: {
          libraryId: libId,
          status: { in: ['CONFIRMED', 'ACTIVE'] },
          endDate: { gte: new Date(), lt: in5Days },
        },
      }),

      prisma.payment.aggregate({
        where: {
          status: 'PAID',
          createdAt: { gte: today },
          booking: { libraryId: libId },
        },
        _sum: { ownerAmount: true },
      }),
      prisma.payment.aggregate({
        where: {
          status: 'PAID',
          createdAt: { gte: monthStart },
          booking: { libraryId: libId },
        },
        _sum: { ownerAmount: true },
      }),
    ])

    return Response.json({
      seats: {
        total: totalSeats,
        available: availableSeats,
        occupied: occupiedSeats,
        reserved: 0,
        maintenance: maintenanceSeats,
      },
      bookings: { today: todaysOccurrences },
      students: { active: activeStudents },
      memberships: { active: activeStudents, expiringSoon: expiringBookings },
      revenue: {
        today:   todayRevenue._sum.ownerAmount   ?? 0,
        monthly: monthlyRevenue._sum.ownerAmount ?? 0,
      },
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown'
    if (msg === 'UNAUTHORIZED') return Response.json({ error: 'Unauthorized' }, { status: 401 })
    if (msg === 'FORBIDDEN') return Response.json({ error: 'Forbidden' }, { status: 403 })
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
