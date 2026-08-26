/**
 * POST /api/student/bookings/:id/cancel-pending
 *
 * Called when the student dismisses the Razorpay checkout modal.
 * Releases the seat hold by cancelling the PENDING booking and
 * marking the associated PENDING payment as FAILED.
 *
 * Does NOT touch CONFIRMED / PAID bookings.
 */
import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import prisma from '@/lib/prisma'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(_req: NextRequest, context: RouteContext) {
  try {
    const session = await requireAuth(['STUDENT'])
    const { id: bookingId } = await context.params

    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, studentId: session.id },
      select: { id: true, status: true },
    })

    if (!booking) {
      return Response.json({ error: 'Booking not found' }, { status: 404 })
    }

    // Only cancel PENDING holds — never touch confirmed/paid bookings
    if (booking.status !== 'PENDING') {
      return Response.json({
        success: true,
        skipped: true,
        reason: `Booking is ${booking.status} — not cancellable via this endpoint`,
      })
    }

    await prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: bookingId },
        data: { status: 'CANCELLED' },
      })
      
      // Release all HELD occurrences for this booking
      await tx.bookingOccurrence.updateMany({
        where: { bookingId, status: 'HELD' },
        data: { status: 'CANCELLED' },
      })
      
      // Mark associated PENDING payment as FAILED if it exists
      await tx.payment.updateMany({
        where: { bookingId, status: 'PENDING' },
        data: { status: 'FAILED', settlementStatus: 'NOT_REQUIRED' },
      })
    })

    return Response.json({ success: true })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : ''
    if (msg === 'UNAUTHORIZED') return Response.json({ error: 'Unauthorized' }, { status: 401 })
    if (msg === 'FORBIDDEN')    return Response.json({ error: 'Forbidden' },    { status: 403 })
    console.error('cancel-pending error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
