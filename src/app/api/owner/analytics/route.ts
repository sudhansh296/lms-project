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

    // Daily utilisation last 30 days — count BookingOccurrences, not parent Bookings
    // A parent Booking spans weeks/months; each Occurrence is one actual study-day
    const dailyBookings = await Promise.all(
      Array.from({ length: 30 }, (_, i) => subDays(now, 29 - i)).map(async (d) => {
        const start = startOfDay(d)
        const end   = new Date(start.getTime() + 86_400_000)
        const count = await prisma.bookingOccurrence.count({
          where: {
            booking: { libraryId: libId },
            date:    { gte: start, lt: end },
            status:  { in: ['CONFIRMED', 'COMPLETED'] },
          },
        })
        return { label: format(d, 'dd MMM'), count }
      })
    )

    const totalSeats    = await prisma.seat.count({ where: { libraryId: libId } })
    const occupiedSeats = await prisma.seat.count({ where: { libraryId: libId, status: 'OCCUPIED' } })
    const occupancyRate = totalSeats > 0 ? Math.round((occupiedSeats / totalSeats) * 100) : 0

    // Popular seats — rank by BookingOccurrence count, not parent Booking count
    const popularSeats = await prisma.bookingOccurrence.groupBy({
      by:      ['seatId'],
      where:   {
        booking: { libraryId: libId },
        date:    { gte: subDays(now, 30) },
        status:  { in: ['CONFIRMED', 'COMPLETED'] },
      },
      _count:   { seatId: true },
      orderBy:  { _count: { seatId: 'desc' } },
      take:     5,
    })

    const seatIds     = popularSeats.map(s => s.seatId).filter(Boolean) as string[]
    const seatDetails = await prisma.seat.findMany({ where: { id: { in: seatIds } } })
    const seatMap     = Object.fromEntries(seatDetails.map(s => [s.id, s.label]))

    const popularSeatsEnriched = popularSeats.map(s => ({
      seatId:   s.seatId,
      label:    seatMap[s.seatId ?? ''] ?? s.seatId ?? 'Unknown',
      bookings: s._count.seatId,
    }))

    // Peak hours — from BookingOccurrence.startTime, not Booking.startTime
    const occurrencesWithTime = await prisma.bookingOccurrence.findMany({
      where: {
        booking: { libraryId: libId },
        date:    { gte: subDays(now, 30) },
        status:  { in: ['CONFIRMED', 'COMPLETED'] },
      },
      select: { startTime: true },
    })

    const hourCounts: Record<number, number> = {}
    occurrencesWithTime.forEach(o => {
      const h = new Date(o.startTime).getHours()
      hourCounts[h] = (hourCounts[h] ?? 0) + 1
    })

    const peakHours = Array.from({ length: 24 }, (_, h) => ({
      hour:     `${h.toString().padStart(2, '0')}:00`,
      bookings: hourCounts[h] ?? 0,
    }))

    // Booking growth last 6 months — count new Bookings created each month
    // StudentMembership is the legacy table; Booking is the entitlement source of truth
    const bookingGrowth = await Promise.all(
      Array.from({ length: 6 }, (_, i) => {
        const periodEnd   = subDays(now, (5 - i) * 30)
        const periodStart = startOfDay(subDays(periodEnd, 30))
        return prisma.booking
          .count({
            where: {
              libraryId: libId,
              createdAt: { gte: periodStart, lte: periodEnd },
              status:    { in: ['CONFIRMED', 'ACTIVE', 'COMPLETED'] },
            },
          })
          .then(count => ({ label: format(periodEnd, 'MMM yy'), count }))
      })
    )

    return Response.json({
      occupancyRate,
      totalSeats,
      occupiedSeats,
      dailyBookings,
      popularSeats:   popularSeatsEnriched,
      peakHours,
      membershipGrowth: bookingGrowth, // key kept for frontend compatibility
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : ''
    if (msg === 'UNAUTHORIZED') return Response.json({ error: 'Unauthorized' }, { status: 401 })
    if (msg === 'FORBIDDEN') return Response.json({ error: 'Forbidden' }, { status: 403 })
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
