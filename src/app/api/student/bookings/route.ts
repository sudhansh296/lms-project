import { NextRequest } from 'next/server'
import { requireAuth, createAuditLog } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(['STUDENT'])
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') ?? ''
    const page = parseInt(searchParams.get('page') ?? '1')
    const limit = parseInt(searchParams.get('limit') ?? '10')
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = { studentId: session.id }
    if (status) where.status = status

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          library: {
            select: {
              id: true, name: true, city: true, area: true,
              phone: true, emailContact: true,
              photos: { where: { isCover: true }, take: 1 },
            },
          },
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

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(['STUDENT'])
    const body = await request.json()
    const { libraryId, seatId, startTime, endTime, amount } = body

    if (!libraryId || !seatId || !startTime || !endTime) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const start = new Date(startTime)
    const end = new Date(endTime)

    if (end <= start) {
      return Response.json({ error: 'End time must be after start time' }, { status: 400 })
    }

    if (start < new Date()) {
      return Response.json({ error: 'Cannot book in the past' }, { status: 400 })
    }

    // Verify library is active
    const library = await prisma.library.findUnique({ where: { id: libraryId, status: 'ACTIVE' } })
    if (!library) return Response.json({ error: 'Library not found or not active' }, { status: 404 })

    // Validate booking duration
    const durationMins = (end.getTime() - start.getTime()) / 60000
    if (durationMins < library.minBookingMins) {
      return Response.json({ error: `Minimum booking duration is ${library.minBookingMins} minutes` }, { status: 400 })
    }
    if (durationMins > library.maxBookingMins) {
      return Response.json({ error: `Maximum booking duration is ${library.maxBookingMins} minutes` }, { status: 400 })
    }

    // Verify seat belongs to this library
    const seat = await prisma.seat.findFirst({ where: { id: seatId, libraryId } })
    if (!seat) return Response.json({ error: 'Seat not found' }, { status: 404 })

    if (seat.status === 'MAINTENANCE' || seat.status === 'DISABLED') {
      return Response.json({ error: 'Seat is not available for booking' }, { status: 409 })
    }

    // Check seat time overlap
    const overlap = await prisma.booking.findFirst({
      where: {
        seatId,
        status: { in: ['PENDING', 'CONFIRMED', 'ACTIVE'] },
        AND: [{ startTime: { lt: end } }, { endTime: { gt: start } }],
      },
    })
    if (overlap) {
      return Response.json({ error: 'Seat is already booked for this time slot' }, { status: 409 })
    }

    // Check student doesn't have overlapping booking at same library
    const studentOverlap = await prisma.booking.findFirst({
      where: {
        studentId: session.id,
        libraryId,
        status: { in: ['PENDING', 'CONFIRMED', 'ACTIVE'] },
        AND: [{ startTime: { lt: end } }, { endTime: { gt: start } }],
      },
    })
    if (studentOverlap) {
      return Response.json({ error: 'You already have a booking overlapping this time' }, { status: 409 })
    }

    // Use amount passed from frontend (set by library owner's plan price)
    const totalAmount = typeof amount === 'number' ? amount : 0

    // Create booking as PENDING — confirmed after payment
    const booking = await prisma.booking.create({
      data: {
        libraryId,
        studentId: session.id,
        seatId,
        bookingDate: start,
        startTime: start,
        endTime: end,
        status: 'PENDING',
        totalAmount,
      },
      include: {
        library: { select: { name: true, city: true } },
        seat: true,
      },
    })

    await createAuditLog({
      userId: session.userId,
      role: session.role,
      libraryId,
      action: 'BOOKING_CREATED',
      entityType: 'Booking',
      entityId: booking.id,
    })

    return Response.json({ booking }, { status: 201 })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : ''
    if (msg === 'UNAUTHORIZED') return Response.json({ error: 'Unauthorized' }, { status: 401 })
    if (msg === 'FORBIDDEN') return Response.json({ error: 'Forbidden' }, { status: 403 })
    console.error('Booking error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
