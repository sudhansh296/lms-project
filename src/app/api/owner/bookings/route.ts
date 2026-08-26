import { NextRequest } from 'next/server'
import { requireAuth, createAuditLog } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { startOfDay, endOfDay } from 'date-fns'

async function getOwnerLibrary(userId: string) {
  return prisma.library.findFirst({ where: { owner: { userId } } })
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(['LIBRARY_OWNER', 'LIBRARY_MANAGER', 'LIBRARY_STAFF'])
    const library = await getOwnerLibrary(session.userId)
    if (!library) return Response.json({ error: 'Library not found' }, { status: 404 })

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') ?? ''
    const date = searchParams.get('date') ?? ''
    const page = parseInt(searchParams.get('page') ?? '1')
    const limit = parseInt(searchParams.get('limit') ?? '20')
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = { libraryId: library.id }
    if (status) where.status = status
    if (date) {
      const d = new Date(date)
      where.bookingDate = { gte: startOfDay(d), lte: endOfDay(d) }
    }

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          student: { include: { user: true } },
          seat: true,
          plan: { select: { name: true, price: true } },
          payment: true,
          attendance: true,
        },
        orderBy: { startTime: 'desc' },
        skip,
        take: limit,
      }),
      prisma.booking.count({ where }),
    ])

    return Response.json({
      bookings,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : ''
    if (msg === 'UNAUTHORIZED') return Response.json({ error: 'Unauthorized' }, { status: 401 })
    if (msg === 'FORBIDDEN') return Response.json({ error: 'Forbidden' }, { status: 403 })
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Owner manual booking creation
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(['LIBRARY_OWNER', 'LIBRARY_MANAGER', 'LIBRARY_STAFF'])
    const library = await getOwnerLibrary(session.userId)
    if (!library) return Response.json({ error: 'Library not found' }, { status: 404 })

    const body = await request.json()
    const { studentId, seatId, startTime, endTime, paymentMethod, amount } = body

    if (!studentId || !seatId || !startTime || !endTime) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const start = new Date(startTime)
    const end = new Date(endTime)
    if (end <= start) {
      return Response.json({ error: 'End time must be after start time' }, { status: 400 })
    }

    // Verify seat belongs to this library
    const seat = await prisma.seat.findFirst({ where: { id: seatId, libraryId: library.id } })
    if (!seat) return Response.json({ error: 'Seat not found' }, { status: 404 })

    if (seat.status === 'MAINTENANCE' || seat.status === 'DISABLED') {
      return Response.json({ error: 'Seat is not available' }, { status: 409 })
    }

    // Check overlap
    const overlap = await prisma.booking.findFirst({
      where: {
        seatId,
        status: { in: ['CONFIRMED', 'ACTIVE'] },
        AND: [
          { startTime: { lt: end } },
          { endTime: { gt: start } },
        ],
      },
    })
    if (overlap) {
      return Response.json({ error: 'Seat is already booked for this time' }, { status: 409 })
    }

    // Verify student has membership at this library
    const membership = await prisma.studentMembership.findFirst({
      where: {
        studentId,
        libraryId: library.id,
        status: 'ACTIVE',
        endDate: { gte: new Date() },
      },
    })

    const booking = await prisma.booking.create({
      data: {
        libraryId: library.id,
        studentId,
        seatId,
        bookingDate: start,
        startTime: start,
        endTime: end,
        status: 'CONFIRMED',
        totalAmount: amount ?? 0,
        payment: paymentMethod
          ? {
              create: {
                studentId,
                amount: amount ?? 0,
                status: 'PAID',
                paymentMethod,
              },
            }
          : undefined,
      },
      include: { student: { include: { user: true } }, seat: true, payment: true },
    })

    await createAuditLog({
      userId: session.userId,
      role: session.role,
      libraryId: library.id,
      action: 'BOOKING_CREATED_MANUAL',
      entityType: 'Booking',
      entityId: booking.id,
    })

    return Response.json({ booking }, { status: 201 })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : ''
    if (msg === 'UNAUTHORIZED') return Response.json({ error: 'Unauthorized' }, { status: 401 })
    if (msg === 'FORBIDDEN') return Response.json({ error: 'Forbidden' }, { status: 403 })
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
