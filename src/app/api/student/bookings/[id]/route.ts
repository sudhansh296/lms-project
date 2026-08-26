import { NextRequest } from 'next/server'
import { requireAuth, createAuditLog } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(['STUDENT'])
    const { id } = await params

    const booking = await prisma.booking.findFirst({ where: { id, studentId: session.id } })
    if (!booking) return Response.json({ error: 'Booking not found' }, { status: 404 })

    // CONFIRMED bookings are FINAL - no cancellation allowed
    if (booking.status === 'CONFIRMED') {
      return Response.json({
        error: 'CONFIRMED_BOOKING_CANNOT_BE_CANCELLED',
        message: 'Completed payments and confirmed bookings are final. No refunds available.',
      }, { status: 409 })
    }

    // ACTIVE bookings are also final
    if (booking.status === 'ACTIVE') {
      return Response.json({
        error: 'ACTIVE_BOOKING_CANNOT_BE_CANCELLED',
        message: 'Active bookings cannot be cancelled.',
      }, { status: 409 })
    }

    // COMPLETED bookings cannot be changed
    if (booking.status === 'COMPLETED') {
      return Response.json({
        error: 'COMPLETED_BOOKING_CANNOT_BE_CANCELLED',
        message: 'Completed bookings cannot be cancelled.',
      }, { status: 409 })
    }

    // Only PENDING bookings may be cancelled
    if (booking.status !== 'PENDING') {
      return Response.json({ 
        error: `Cannot cancel booking with status: ${booking.status}`,
        message: 'Only pending bookings can be cancelled.',
      }, { status: 400 })
    }

    // Cancel PENDING booking and release occurrences
    await prisma.$transaction(async (tx) => {
      await tx.booking.update({ where: { id }, data: { status: 'CANCELLED' } })
      
      // Release all HELD occurrences for this booking
      await tx.bookingOccurrence.updateMany({
        where: { bookingId: id, status: 'HELD' },
        data: { status: 'CANCELLED' },
      })
      
      // Mark associated PENDING payment as FAILED if it exists
      await tx.payment.updateMany({
        where: { bookingId: id, status: 'PENDING' },
        data: { status: 'FAILED', settlementStatus: 'NOT_REQUIRED' },
      })
    })

    await createAuditLog({
      userId: session.userId,
      role: session.role,
      libraryId: booking.libraryId,
      action: 'BOOKING_CANCELLED',
      entityType: 'Booking',
      entityId: id,
    })

    return Response.json({ success: true })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : ''
    if (msg === 'UNAUTHORIZED') return Response.json({ error: 'Unauthorized' }, { status: 401 })
    if (msg === 'FORBIDDEN') return Response.json({ error: 'Forbidden' }, { status: 403 })
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
