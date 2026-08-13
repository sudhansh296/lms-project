import { NextRequest } from 'next/server'
import { requireAuth, createAuditLog } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { seatSchema } from '@/lib/validations'

async function getOwnerLibrary(userId: string) {
  return prisma.library.findFirst({ where: { owner: { userId } } })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(['LIBRARY_OWNER', 'LIBRARY_MANAGER'])
    const { id } = await params
    const library = await getOwnerLibrary(session.userId)
    if (!library) return Response.json({ error: 'Library not found' }, { status: 404 })

    const seat = await prisma.seat.findFirst({ where: { id, libraryId: library.id } })
    if (!seat) return Response.json({ error: 'Seat not found' }, { status: 404 })

    const body = await request.json()
    const partial = seatSchema.partial().safeParse(body)
    if (!partial.success) {
      return Response.json({ error: 'Invalid input', details: partial.error.flatten() }, { status: 400 })
    }

    const updated = await prisma.seat.update({ where: { id }, data: partial.data })

    await createAuditLog({
      userId: session.userId,
      role: session.role,
      libraryId: library.id,
      action: 'SEAT_MODIFIED',
      entityType: 'Seat',
      entityId: id,
    })

    return Response.json({ seat: updated })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : ''
    if (msg === 'UNAUTHORIZED') return Response.json({ error: 'Unauthorized' }, { status: 401 })
    if (msg === 'FORBIDDEN') return Response.json({ error: 'Forbidden' }, { status: 403 })
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(['LIBRARY_OWNER', 'LIBRARY_MANAGER'])
    const { id } = await params
    const library = await getOwnerLibrary(session.userId)
    if (!library) return Response.json({ error: 'Library not found' }, { status: 404 })

    const seat = await prisma.seat.findFirst({ where: { id, libraryId: library.id } })
    if (!seat) return Response.json({ error: 'Seat not found' }, { status: 404 })

    const activeBooking = await prisma.booking.findFirst({
      where: { seatId: id, status: { in: ['CONFIRMED', 'ACTIVE'] } },
    })
    if (activeBooking) {
      return Response.json({ error: 'Cannot delete seat with active bookings' }, { status: 409 })
    }

    await prisma.seat.delete({ where: { id } })

    await createAuditLog({
      userId: session.userId,
      role: session.role,
      libraryId: library.id,
      action: 'SEAT_DELETED',
      entityType: 'Seat',
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
