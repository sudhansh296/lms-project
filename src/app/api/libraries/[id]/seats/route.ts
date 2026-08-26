import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const startTime = searchParams.get('startTime')
    const endTime   = searchParams.get('endTime')

    const library = await prisma.library.findUnique({ where: { id, status: 'ACTIVE' } })
    if (!library) return Response.json({ error: 'Library not found' }, { status: 404 })

    const seats = await prisma.seat.findMany({
      where: { libraryId: id },
      orderBy: { label: 'asc' },
    })

    const layout = await prisma.seatLayout.findUnique({
      where: { libraryId: id },
      include: { objects: true },
    })

    if (startTime && endTime) {
      const start = new Date(startTime)
      const end   = new Date(endTime)
      const now   = new Date()

      // Check conflicts via BookingOccurrences (new recurring system)
      // AND legacy single-booking conflicts for backward compat
      const [conflictingOccurrences, legacyConflicts] = await Promise.all([
        prisma.bookingOccurrence.findMany({
          where: {
            status: { in: ['HELD', 'CONFIRMED'] },
            startTime: { lt: end },
            endTime:   { gt: start },
          },
          include: {
            booking: {
              select: {
                status: true,
                holdExpiresAt: true,
              },
            },
          },
          select: {
            seatId: true,
            booking: { select: { status: true, holdExpiresAt: true } },
          },
        }),
        prisma.booking.findMany({
          where: {
            libraryId: id,
            planId: null,  // legacy bookings without a plan
            status: { in: ['CONFIRMED', 'ACTIVE', 'PENDING'] },
            startTime: { lt: end },
            endTime:   { gt: start },
          },
          select: { seatId: true, status: true, holdExpiresAt: true },
        }),
      ])

      const bookedSeatIds = new Set<string>()

      // From occurrences — skip if parent PENDING hold has expired
      for (const occ of conflictingOccurrences) {
        const b = occ.booking as { status: string; holdExpiresAt: Date | null } | null
        if (!b) continue
        if (b.status === 'PENDING') {
          if (!b.holdExpiresAt || b.holdExpiresAt <= now) continue
        }
        bookedSeatIds.add(occ.seatId)
      }

      // From legacy bookings
      for (const b of legacyConflicts) {
        if (b.status === 'PENDING') {
          if (!b.holdExpiresAt || b.holdExpiresAt <= now) continue
        }
        bookedSeatIds.add(b.seatId)
      }

      const seatsWithAvailability = seats.map(seat => ({
        ...seat,
        isAvailableForSlot:
          seat.status !== 'MAINTENANCE' &&
          seat.status !== 'DISABLED' &&
          !bookedSeatIds.has(seat.id),
      }))

      return Response.json({ seats: seatsWithAvailability, layout })
    }

    return Response.json({ seats, layout })
  } catch (error) {
    console.error('Seats error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
