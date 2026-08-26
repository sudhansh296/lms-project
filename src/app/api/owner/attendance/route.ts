import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import prisma from '@/lib/prisma'

async function getOwnerLibrary(userId: string) {
  return prisma.library.findFirst({ where: { owner: { userId } } })
}

// P0-1 FIX: Work with BookingOccurrence for daily check-in/out
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

    // P0-4 FIX: Find today's CONFIRMED occurrence for this booking
    // HELD occurrences are rejected - only CONFIRMED bookings can check in
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const todayOccurrence = await prisma.bookingOccurrence.findFirst({
      where: {
        bookingId,
        date: {
          gte: today,
          lt: tomorrow,
        },
        status: 'CONFIRMED', // P0-4: Only CONFIRMED occurrences, not HELD
      },
    })

    if (!todayOccurrence) {
      return Response.json({ 
        error: 'No confirmed booking occurrence found for today. Payment confirmation required.' 
      }, { status: 404 })
    }

    const now = new Date()

    if (action === 'CHECK_IN') {
      // Create or update attendance for today's occurrence
      const attendance = await prisma.attendance.upsert({
        where: { bookingOccurrenceId: todayOccurrence.id },
        update: { checkInAt: now },
        create: {
          bookingId,
          bookingOccurrenceId: todayOccurrence.id,
          studentId: booking.studentId,
          checkInAt: now,
        },
      })

      // Mark occurrence as CONFIRMED and seat as OCCUPIED
      await prisma.bookingOccurrence.update({
        where: { id: todayOccurrence.id },
        data: { status: 'CONFIRMED' },
      })
      await prisma.seat.update({ 
        where: { id: booking.seatId }, 
        data: { status: 'OCCUPIED' } 
      })

      return Response.json({ attendance, occurrence: todayOccurrence })
    }

    if (action === 'CHECK_OUT') {
      // Mark attendance checkout for today's occurrence
      const attendance = await prisma.attendance.upsert({
        where: { bookingOccurrenceId: todayOccurrence.id },
        update: { checkOutAt: now },
        create: {
          bookingId,
          bookingOccurrenceId: todayOccurrence.id,
          studentId: booking.studentId,
          checkOutAt: now,
        },
      })

      // Mark THIS occurrence as COMPLETED (not the entire booking)
      await prisma.bookingOccurrence.update({
        where: { id: todayOccurrence.id },
        data: { status: 'COMPLETED' },
      })

      // P0-5 FIX: Set seat AVAILABLE immediately after checkout
      // Physical seat is freed NOW, future occurrences are tracked via BookingOccurrence
      await prisma.seat.update({ 
        where: { id: booking.seatId }, 
        data: { status: 'AVAILABLE' } 
      })

      // P0-6 FIX: Complete parent Booking only when final occurrence completes
      const futureOccurrences = await prisma.bookingOccurrence.findMany({
        where: {
          bookingId,
          date: { gte: tomorrow },
          status: { in: ['HELD', 'CONFIRMED'] },
        },
      })

      // If no more future confirmed/held occurrences, mark parent Booking as COMPLETED
      if (futureOccurrences.length === 0) {
        await prisma.booking.update({
          where: { id: bookingId },
          data: { status: 'COMPLETED' },
        })
      }

      return Response.json({ attendance, occurrence: todayOccurrence })
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : ''
    if (msg === 'UNAUTHORIZED') return Response.json({ error: 'Unauthorized' }, { status: 401 })
    if (msg === 'FORBIDDEN') return Response.json({ error: 'Forbidden' }, { status: 403 })
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
