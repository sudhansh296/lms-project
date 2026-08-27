import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { addDays, startOfDay, isSameDay, parseISO } from 'date-fns'

/**
 * P1-1: Generate exact occurrences for recurring booking and check each individually
 * 
 * This endpoint receives:
 * - startDate: First day of booking period
 * - endDate: Last day of booking period
 * - dailyStartTime: Time each day starts (e.g., "09:00")
 * - dailyEndTime: Time each day ends (e.g., "17:00")
 * - daysOfWeek: Array of day numbers [0=Sun, 1=Mon, ..., 6=Sat]
 * 
 * Returns: List of seats with per-occurrence availability
 */

interface OccurrenceConflict {
  date: string // YYYY-MM-DD
  conflictingSeatIds: string[]
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: libraryId } = await params
    const body = await request.json()
    
    const {
      startDate,
      endDate,
      dailyStartTime,
      dailyEndTime,
      daysOfWeek, // [1,2,3,4,5] for Mon-Fri
    } = body

    if (!startDate || !endDate || !dailyStartTime || !dailyEndTime || !daysOfWeek) {
      return Response.json({ 
        error: 'Missing required fields: startDate, endDate, dailyStartTime, dailyEndTime, daysOfWeek' 
      }, { status: 400 })
    }

    const library = await prisma.library.findUnique({ 
      where: { id: libraryId, status: 'ACTIVE' } 
    })
    
    if (!library) {
      return Response.json({ error: 'Library not found' }, { status: 404 })
    }

    // Generate exact occurrences
    const occurrences: Date[] = []
    const start = parseISO(startDate)
    const end = parseISO(endDate)
    
    let current = startOfDay(start)
    const endDay = startOfDay(end)
    
    while (current <= endDay) {
      const dayOfWeek = current.getDay()
      
      if (daysOfWeek.includes(dayOfWeek)) {
        occurrences.push(new Date(current))
      }
      
      current = addDays(current, 1)
    }

    // For each occurrence, build start/end timestamps
    const occurrenceWindows = occurrences.map(date => {
      const [startHour, startMin] = dailyStartTime.split(':').map(Number)
      const [endHour, endMin] = dailyEndTime.split(':').map(Number)
      
      const startTime = new Date(date)
      startTime.setHours(startHour, startMin, 0, 0)
      
      const endTime = new Date(date)
      endTime.setHours(endHour, endMin, 0, 0)
      
      return {
        date: date.toISOString().split('T')[0], // YYYY-MM-DD
        startTime,
        endTime,
      }
    })

    // Check conflicts for ALL occurrences in a single query
    const allStartTimes = occurrenceWindows.map(o => o.startTime)
    const allEndTimes = occurrenceWindows.map(o => o.endTime)
    
    const earliestStart = new Date(Math.min(...allStartTimes.map(d => d.getTime())))
    const latestEnd = new Date(Math.max(...allEndTimes.map(d => d.getTime())))
    
    const now = new Date()

    // Get all conflicting occurrences in the entire range
    const [allConflictingOccurrences, allLegacyConflicts] = await Promise.all([
      prisma.bookingOccurrence.findMany({
        where: {
          seatId: { not: '' }, // filter out placeholder; actual seatId is always non-empty
          status: { in: ['HELD', 'CONFIRMED'] },
          startTime: { lt: latestEnd },
          endTime: { gt: earliestStart },
        },
        select: {
          seatId: true,
          startTime: true,
          endTime: true,
          bookingId: true,
        },
      }),
      prisma.booking.findMany({
        where: {
          libraryId,
          planId: null, // legacy bookings
          status: { in: ['CONFIRMED', 'ACTIVE', 'PENDING'] },
          startTime: { lt: latestEnd },
          endTime: { gt: earliestStart },
        },
        select: {
          seatId: true,
          startTime: true,
          endTime: true,
          status: true,
          holdExpiresAt: true,
        },
      }),
    ])

    // Filter out expired PENDING holds — not needed here since we only query HELD/CONFIRMED
    const validConflicts = allConflictingOccurrences

    const validLegacyConflicts = allLegacyConflicts.filter(b => {
      if (b.status === 'PENDING' && (!b.holdExpiresAt || b.holdExpiresAt <= now)) {
        return false
      }
      return true
    })

    // For EACH occurrence, determine which seats are conflicting
    const occurrenceConflicts: OccurrenceConflict[] = occurrenceWindows.map(occ => {
      const conflictingSeatIds = new Set<string>()

      // Check occurrence-level conflicts
      for (const conflict of validConflicts) {
        // Check if this conflict overlaps with THIS specific occurrence
        if (conflict.startTime < occ.endTime && conflict.endTime > occ.startTime) {
          if (conflict.seatId) {
            conflictingSeatIds.add(conflict.seatId)
          }
        }
      }

      // Check legacy booking conflicts
      for (const conflict of validLegacyConflicts) {
        if (conflict.startTime < occ.endTime && conflict.endTime > occ.startTime) {
          conflictingSeatIds.add(conflict.seatId)
        }
      }

      return {
        date: occ.date,
        conflictingSeatIds: Array.from(conflictingSeatIds),
      }
    })

    // Get all seats
    const seats = await prisma.seat.findMany({
      where: { libraryId },
      select: {
        id: true,
        label: true,
        seatType: true,
        status: true,
        extraPrice: true,
      },
      orderBy: { label: 'asc' },
    })

    // For each seat, determine which occurrences it's available for
    const seatsWithAvailability = seats.map(seat => {
      // Seat must not be in maintenance or disabled
      const basicallyAvailable = 
        seat.status !== 'MAINTENANCE' && 
        seat.status !== 'DISABLED'

      // Check each occurrence
      const unavailableDates: string[] = []
      const availableDates: string[] = []

      for (const occ of occurrenceConflicts) {
        if (occ.conflictingSeatIds.includes(seat.id)) {
          unavailableDates.push(occ.date)
        } else {
          availableDates.push(occ.date)
        }
      }

      // Seat is fully available if ALL occurrences are available
      const isFullyAvailable = basicallyAvailable && unavailableDates.length === 0

      // Calculate availability percentage
      const totalOccurrences = occurrenceConflicts.length
      const availableCount = availableDates.length
      const availabilityPercentage = totalOccurrences > 0 
        ? Math.round((availableCount / totalOccurrences) * 100) 
        : 0

      return {
        ...seat,
        isFullyAvailable,
        availabilityPercentage,
        totalOccurrences,
        availableOccurrences: basicallyAvailable ? availableCount : 0,
        unavailableDates: basicallyAvailable ? unavailableDates : occurrenceConflicts.map(o => o.date),
      }
    })

    // Sort: fully available first, then by availability percentage
    seatsWithAvailability.sort((a, b) => {
      if (a.isFullyAvailable && !b.isFullyAvailable) return -1
      if (!a.isFullyAvailable && b.isFullyAvailable) return 1
      return b.availabilityPercentage - a.availabilityPercentage
    })

    return Response.json({
      seats: seatsWithAvailability,
      summary: {
        totalSeats: seats.length,
        fullyAvailableSeats: seatsWithAvailability.filter(s => s.isFullyAvailable).length,
        totalOccurrences: occurrenceConflicts.length,
      },
    })
  } catch (error) {
    console.error('Availability check error:', error)
    return Response.json({ 
      error: 'Failed to check availability',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
