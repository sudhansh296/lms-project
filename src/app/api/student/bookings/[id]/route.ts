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

    if (!['CONFIRMED', 'PENDING'].includes(booking.status)) {
      return Response.json({ error: 'Cannot cancel this booking' }, { status: 400 })
    }

    await prisma.booking.update({ where: { id }, data: { status: 'CANCELLED' } })

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
