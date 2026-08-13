import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import prisma from '@/lib/prisma'

async function getOwnerLibrary(userId: string) {
  return prisma.library.findFirst({ where: { owner: { userId } } })
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(['LIBRARY_OWNER', 'LIBRARY_MANAGER', 'LIBRARY_STAFF'])
    const library = await getOwnerLibrary(session.userId)
    if (!library) return Response.json({ error: 'Library not found' }, { status: 404 })

    const body = await request.json()
    const { bookingId, action } = body // action: 'CHECK_IN' | 'CHECK_OUT'

    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, libraryId: library.id },
    })
    if (!booking) return Response.json({ error: 'Booking not found' }, { status: 404 })

    const now = new Date()

    if (action === 'CHECK_IN') {
      const attendance = await prisma.attendance.upsert({
        where: { bookingId },
        update: { checkInAt: now },
        create: {
          bookingId,
          studentId: booking.studentId,
          checkInAt: now,
        },
      })
      await prisma.booking.update({ where: { id: bookingId }, data: { status: 'ACTIVE' } })
      await prisma.seat.update({ where: { id: booking.seatId }, data: { status: 'OCCUPIED' } })
      return Response.json({ attendance })
    }

    if (action === 'CHECK_OUT') {
      const attendance = await prisma.attendance.upsert({
        where: { bookingId },
        update: { checkOutAt: now },
        create: {
          bookingId,
          studentId: booking.studentId,
          checkOutAt: now,
        },
      })
      await prisma.booking.update({ where: { id: bookingId }, data: { status: 'COMPLETED' } })
      await prisma.seat.update({ where: { id: booking.seatId }, data: { status: 'AVAILABLE' } })
      return Response.json({ attendance })
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : ''
    if (msg === 'UNAUTHORIZED') return Response.json({ error: 'Unauthorized' }, { status: 401 })
    if (msg === 'FORBIDDEN') return Response.json({ error: 'Forbidden' }, { status: 403 })
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
