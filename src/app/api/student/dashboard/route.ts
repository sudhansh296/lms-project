import { requireAuth } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const session = await requireAuth(['STUDENT'])

    const now = new Date()

    const [activeMemberships, upcomingBookings, activeBooking, recentPayments] =
      await Promise.all([
        prisma.studentMembership.findMany({
          where: { studentId: session.id, status: 'ACTIVE', endDate: { gte: now } },
          include: {
            library: {
              select: {
                id: true, name: true, city: true,
                photos: { where: { isCover: true }, take: 1 },
                phone: true,
              },
            },
            plan: true,
          },
          orderBy: { endDate: 'asc' },
        }),
        prisma.booking.findMany({
          where: {
            studentId: session.id,
            status: 'CONFIRMED',
            startTime: { gte: now },
          },
          include: {
            library: { select: { name: true, city: true } },
            seat: true,
          },
          orderBy: { startTime: 'asc' },
          take: 3,
        }),
        prisma.booking.findFirst({
          where: { studentId: session.id, status: 'ACTIVE' },
          include: {
            library: { select: { name: true } },
            seat: true,
          },
        }),
        prisma.payment.findMany({
          where: { studentId: session.id, status: 'PAID' },
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: {
            booking: { include: { library: { select: { name: true } } } },
            membership: { include: { library: { select: { name: true } }, plan: true } },
          },
        }),
      ])

    return Response.json({
      activeMemberships,
      upcomingBookings,
      activeBooking,
      recentPayments,
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : ''
    if (msg === 'UNAUTHORIZED') return Response.json({ error: 'Unauthorized' }, { status: 401 })
    if (msg === 'FORBIDDEN') return Response.json({ error: 'Forbidden' }, { status: 403 })
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
