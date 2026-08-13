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
    const endTime = searchParams.get('endTime')

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
      const end = new Date(endTime)

      const bookedSeatIds = new Set<string>()
      const conflicts = await prisma.booking.findMany({
        where: {
          libraryId: id,
          status: { in: ['CONFIRMED', 'ACTIVE'] },
          AND: [{ startTime: { lt: end } }, { endTime: { gt: start } }],
        },
        select: { seatId: true },
      })
      conflicts.forEach((b: { seatId: string }) => bookedSeatIds.add(b.seatId))

      const seatsWithAvailability = seats.map((seat: typeof seats[0]) => ({
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
