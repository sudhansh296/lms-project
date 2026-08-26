import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { isLibraryOpen } from '@/lib/utils'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const library = await prisma.library.findUnique({
      where: { id, status: 'ACTIVE' },
      include: {
        photos: { orderBy: { order: 'asc' } },
        facilities: true,
        hours: { orderBy: { dayOfWeek: 'asc' } },
        rules: { orderBy: { order: 'asc' } },
        membershipPlans: {
          where: { isActive: true },
          orderBy: { price: 'asc' },
          select: {
            id: true, name: true, description: true,
            dailyMinutes: true, durationValue: true, durationUnit: true,
            price: true, timeSelectionMode: true,
            fixedStartTime: true, fixedEndTime: true,
            allowedDays: true, benefits: true,
          },
        },
        reviews: {
          include: { student: { include: { user: { select: { name: true } } } } },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        _count: { select: { reviews: true } },
      },
    })

    if (!library) {
      return Response.json({ error: 'Library not found' }, { status: 404 })
    }

    const avgRating =
      library.reviews.length > 0
        ? library.reviews.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) / library.reviews.length
        : 0

    const isOpen = isLibraryOpen(library.hours, library.is24Hours)
    const availableSeats = await prisma.seat.count({ where: { libraryId: id, status: 'AVAILABLE' } })
    const totalSeats = await prisma.seat.count({ where: { libraryId: id } })

    return Response.json({
      library: {
        ...library,
        avgRating: Math.round(avgRating * 10) / 10,
        isOpen,
        availableSeats,
        totalSeats,
      },
    })
  } catch (error) {
    console.error('Library detail error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
