import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { getDistanceKm, isLibraryOpen } from '@/lib/utils'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') ?? ''
    const city = searchParams.get('city') ?? ''
    const lat = parseFloat(searchParams.get('lat') ?? '0')
    const lng = parseFloat(searchParams.get('lng') ?? '0')
    const sortBy = searchParams.get('sortBy') ?? 'createdAt'
    const page = parseInt(searchParams.get('page') ?? '1')
    const limit = parseInt(searchParams.get('limit') ?? '20')
    const skip = (page - 1) * limit

    // Build where clause
    type WhereClause = {
      status: 'ACTIVE'
      city?: { contains: string; mode: 'insensitive' }
      OR?: Array<{
        name?: { contains: string; mode: 'insensitive' }
        city?: { contains: string; mode: 'insensitive' }
        area?: { contains: string; mode: 'insensitive' }
        pincode?: { contains: string }
      }>
    }

    const where: WhereClause = { status: 'ACTIVE' }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
        { area: { contains: search, mode: 'insensitive' } },
        { pincode: { contains: search } },
      ]
    }

    if (city) {
      where.city = { contains: city, mode: 'insensitive' }
    }

    const [libraries, total] = await Promise.all([
      prisma.library.findMany({
        where,
        include: {
          photos: { where: { isCover: true }, take: 1 },
          facilities: true,
          hours: true,
          membershipPlans: {
            where: { isActive: true, pricingModel: 'MONTHLY_RATE' },
            orderBy: { monthlyPrice: 'asc' },
            take: 1,
          },
          _count: { select: { seats: true, reviews: true } },
          reviews: { select: { rating: true } },
          seats: { where: { status: 'AVAILABLE' }, select: { id: true } },
        },
        skip,
        take: limit,
      }),
      prisma.library.count({ where }),
    ])

    // Define enriched item type
    type EnrichedLib = {
      id: string; name: string; city: string; area: string | null; pincode: string
      formattedAddress: string | null; latitude: number | null; longitude: number | null
      coverPhoto: string | null; facilities: string[]; totalSeats: number
      availableSeats: number; avgRating: number; reviewCount: number
      isOpen: boolean; lowestPrice: number | null; distance: number | null; is24Hours: boolean
    }

    const enriched: EnrichedLib[] = libraries.map((lib: (typeof libraries)[0]) => {
      const avgRating =
        lib.reviews.length > 0
          ? lib.reviews.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) / lib.reviews.length
          : 0

      const distance =
        lat && lng && lib.latitude && lib.longitude
          ? getDistanceKm(lat, lng, lib.latitude, lib.longitude)
          : null

      const isOpen = isLibraryOpen(lib.hours, lib.is24Hours)
      const lowestPrice = lib.membershipPlans[0]?.monthlyPrice ?? null
      const coverPhoto = lib.photos[0]?.url ?? null

      return {
        id: lib.id,
        name: lib.name,
        city: lib.city,
        area: lib.area,
        pincode: lib.pincode,
        formattedAddress: lib.formattedAddress,
        latitude: lib.latitude,
        longitude: lib.longitude,
        coverPhoto,
        facilities: lib.facilities.map((f: { name: string }) => f.name),
        totalSeats: lib._count.seats,
        availableSeats: lib.seats.length,
        avgRating: Math.round(avgRating * 10) / 10,
        reviewCount: lib._count.reviews,
        isOpen,
        lowestPrice,
        distance,
        is24Hours: lib.is24Hours,
      }
    })

    if (sortBy === 'distance' && lat && lng) {
      enriched.sort((a: EnrichedLib, b: EnrichedLib) => (a.distance ?? Infinity) - (b.distance ?? Infinity))
    } else if (sortBy === 'rating') {
      enriched.sort((a: EnrichedLib, b: EnrichedLib) => b.avgRating - a.avgRating)
    } else if (sortBy === 'price') {
      enriched.sort((a: EnrichedLib, b: EnrichedLib) => (a.lowestPrice ?? Infinity) - (b.lowestPrice ?? Infinity))
    } else if (sortBy === 'seats') {
      enriched.sort((a: EnrichedLib, b: EnrichedLib) => b.availableSeats - a.availableSeats)
    }

    return Response.json({
      libraries: enriched,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('Library search error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
