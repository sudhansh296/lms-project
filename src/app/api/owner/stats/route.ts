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
      todaysBookings,
      activeStudents,
      activeMemberships,
      todayRevenue,
      monthlyRevenue,
      expiringMemberships,
    ] = await Promise.all([
      prisma.seat.count({ where: { libraryId: libId } }),
      prisma.seat.count({ where: { libraryId: libId, status: 'AVAILABLE' } }),
      prisma.seat.count({ where: { libraryId: libId, status: 'OCCUPIED' } }),
      prisma.seat.count({ where: { libraryId: libId, status: 'MAINTENANCE' } }),
      prisma.booking.count({
        where: { libraryId: libId, bookingDate: { gte: today } },
      }),
      prisma.studentMembership.count({
        where: { libraryId: libId, status: 'ACTIVE' },
      }),
      prisma.studentMembership.count({
        where: { libraryId: libId, status: 'ACTIVE' },
      }),
      prisma.payment.aggregate({
        where: {
          status: 'PAID',
          createdAt: { gte: today },
          OR: [
            { booking: { libraryId: libId } },
            { membership: { libraryId: libId } },
          ],
        },
        _sum: { ownerAmount: true },
      }),
      prisma.payment.aggregate({
        where: {
          status: 'PAID',
          createdAt: { gte: monthStart },
          OR: [
            { booking: { libraryId: libId } },
            { membership: { libraryId: libId } },
          ],
        },
        _sum: { ownerAmount: true },
      }),
      prisma.studentMembership.count({
        where: {
          libraryId: libId,
          status: 'ACTIVE',
          endDate: { gte: new Date(), lt: in5Days }, // FIX 9: endDate is exclusive, use lt
        },
      }),
    ])

    return Response.json({
      seats: {
        total: totalSeats,
        available: availableSeats,
        occupied: occupiedSeats,
        reserved: 0, // calculated from active bookings if needed
        maintenance: maintenanceSeats,
      },
      bookings: { today: todaysBookings },
      students: { active: activeStudents },
      memberships: { active: activeMemberships, expiringSoon: expiringMemberships },
      revenue: {
        today: todayRevenue._sum.ownerAmount ?? 0,
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
