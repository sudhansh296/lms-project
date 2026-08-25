import { requireAuth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { subDays, startOfDay, format } from 'date-fns'
import { checkAnalyticsAccess } from '@/lib/level-limits'
import type { OwnerMembershipLevel } from '@/lib/referral'

async function getOwnerLibrary(userId: string) {
  return prisma.library.findFirst({ where: { owner: { userId } } })
}

export async function GET() {
  try {
    const session = await requireAuth(['LIBRARY_OWNER', 'LIBRARY_MANAGER'])
    const library = await getOwnerLibrary(session.userId)
    if (!library) return Response.json({ error: 'Library not found' }, { status: 404 })

    // ── Analytics access check ───────────────────────────────────────────────
    const owner = await prisma.libraryOwner.findUnique({
      where: { userId: session.userId },
      select: { ownerMembershipLevel: true },
    })
    const accessCheck = checkAnalyticsAccess(
      (owner?.ownerMembershipLevel ?? 'STANDARD') as OwnerMembershipLevel,
      'basic'
    )
    if (!accessCheck.allowed) {
      return Response.json({ error: accessCheck.reason, upgradeRequired: true }, { status: 403 })
    }

    const libId = library.id
    const now = new Date()

    // Daily bookings last 30 days
    const dailyBookings = await Promise.all(
      Array.from({ length: 30 }, (_, i) => subDays(now, 29 - i)).map(async (d) => {
        const start = startOfDay(d)
        const end = new Date(start.getTime() + 86400000)
        const count = await prisma.booking.count({
          where: { libraryId: libId, bookingDate: { gte: start, lt: end } },
        })
        return { label: format(d, 'dd MMM'), count }
      })
    )

    const totalSeats = await prisma.seat.count({ where: { libraryId: libId } })
    const occupiedSeats = await prisma.seat.count({ where: { libraryId: libId, status: 'OCCUPIED' } })
    const occupancyRate = totalSeats > 0 ? Math.round((occupiedSeats / totalSeats) * 100) : 0

    // Popular seats
    const popularSeats = await prisma.booking.groupBy({
      by: ['seatId'],
      where: { libraryId: libId, bookingDate: { gte: subDays(now, 30) } },
      _count: { seatId: true },
      orderBy: { _count: { seatId: 'desc' } },
      take: 5,
    })

    const seatIds = popularSeats.map((s: { seatId: string; _count: { seatId: number } }) => s.seatId)
    const seatDetails = await prisma.seat.findMany({ where: { id: { in: seatIds } } })
    const seatMap = Object.fromEntries(seatDetails.map((s: { id: string; label: string }) => [s.id, s.label]))

    const popularSeatsEnriched = popularSeats.map((s: { seatId: string; _count: { seatId: number } }) => ({
      seatId: s.seatId,
      label: seatMap[s.seatId] ?? s.seatId,
      bookings: s._count.seatId,
    }))

    // Peak hours
    const bookingsWithTime = await prisma.booking.findMany({
      where: { libraryId: libId, bookingDate: { gte: subDays(now, 30) } },
      select: { startTime: true },
    })

    const hourCounts: Record<number, number> = {}
    bookingsWithTime.forEach((b: { startTime: Date }) => {
      const h = new Date(b.startTime).getHours()
      hourCounts[h] = (hourCounts[h] ?? 0) + 1
    })

    const peakHours = Array.from({ length: 24 }, (_, h) => ({
      hour: `${h.toString().padStart(2, '0')}:00`,
      bookings: hourCounts[h] ?? 0,
    }))

    // Membership growth last 6 months
    const membershipGrowth = await Promise.all(
      Array.from({ length: 6 }, (_, i) => {
        const d = subDays(now, (5 - i) * 30)
        const start = startOfDay(subDays(d, 30))
        return prisma.studentMembership
          .count({ where: { libraryId: libId, createdAt: { gte: start, lte: d } } })
          .then((count: number) => ({ label: format(d, 'MMM yy'), count }))
      })
    )

    return Response.json({
      occupancyRate,
      totalSeats,
      occupiedSeats,
      dailyBookings,
      popularSeats: popularSeatsEnriched,
      peakHours,
      membershipGrowth,
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : ''
    if (msg === 'UNAUTHORIZED') return Response.json({ error: 'Unauthorized' }, { status: 401 })
    if (msg === 'FORBIDDEN') return Response.json({ error: 'Forbidden' }, { status: 403 })
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
