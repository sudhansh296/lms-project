import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { serialize } from '@/lib/serialize'
import {
  calculateSessionMinutes,
  calculateDailyStudyTotals,
  calculateCurrentStreak,
  calculateLongestStreak,
  calculateWeeklyStudyMinutes,
  calculateMonthlyStudyMinutes,
  type AttendanceRecord,
} from '@/lib/study-stats'
import { startOfDay, endOfDay, subDays, format } from 'date-fns'

function getTodaySessionStatus(
  occ: {
    endTime: Date
    attendance: { checkInAt: Date | null; checkOutAt: Date | null } | null
  } | null,
  now: Date
): 'UPCOMING' | 'CHECKED_IN' | 'COMPLETED' | 'MISSED' {
  if (!occ) return 'MISSED'
  const att = occ.attendance
  if (att?.checkInAt && att?.checkOutAt) return 'COMPLETED'
  if (att?.checkInAt && !att?.checkOutAt) return 'CHECKED_IN'
  if (new Date(occ.endTime) < now) return 'MISSED'
  return 'UPCOMING'
}

export async function GET() {
  try {
    const session = await requireAuth(['STUDENT'])

    const ninetyDaysAgo = subDays(new Date(), 90)
    const todayStart = startOfDay(new Date())
    const todayEnd = endOfDay(new Date())

    const [attendanceHistory, todayOccurrence, nextOccurrence] = await Promise.all([
      prisma.attendance.findMany({
        where: {
          studentId: session.id,
          checkInAt: { gte: ninetyDaysAgo },
        },
        include: {
          bookingOccurrence: {
            include: {
              booking: {
                include: {
                  library: { select: { id: true, name: true } },
                  seat: { select: { label: true } },
                },
              },
            },
          },
        },
        orderBy: { checkInAt: 'desc' },
      }),
      prisma.bookingOccurrence.findFirst({
        where: {
          booking: {
            studentId: session.id,
            status: { in: ['CONFIRMED', 'ACTIVE'] },
          },
          date: { gte: todayStart, lte: todayEnd },
          status: { in: ['CONFIRMED', 'HELD', 'COMPLETED'] },
        },
        include: {
          booking: {
            include: {
              library: { select: { id: true, name: true } },
              seat: { select: { label: true } },
            },
          },
          attendance: true,
        },
        orderBy: { startTime: 'asc' },
      }),
      prisma.bookingOccurrence.findFirst({
        where: {
          booking: {
            studentId: session.id,
            status: { in: ['CONFIRMED', 'ACTIVE'] },
          },
          date: { gt: todayEnd },
          status: { in: ['CONFIRMED', 'HELD'] },
        },
        include: {
          booking: {
            include: {
              library: { select: { id: true, name: true } },
              seat: { select: { label: true } },
            },
          },
        },
        orderBy: { date: 'asc' },
      }),
    ])

    const todayStr = format(new Date(), 'yyyy-MM-dd')

    // Build AttendanceRecord list
    const records: AttendanceRecord[] = attendanceHistory.map((a) => ({
      date: format(a.checkInAt!, 'yyyy-MM-dd'),
      checkInAt: a.checkInAt!,
      checkOutAt: a.checkOutAt,
    }))

    // Compute stats
    const dailyTotals = calculateDailyStudyTotals(records)
    const currentStreak = calculateCurrentStreak(dailyTotals, todayStr)
    const longestStreak = calculateLongestStreak(dailyTotals)
    const weeklyStudyMinutes = calculateWeeklyStudyMinutes(dailyTotals, todayStr)
    const monthlyStudyMinutes = calculateMonthlyStudyMinutes(dailyTotals, todayStr)
    const todayStudyMinutes = dailyTotals.get(todayStr) ?? 0

    // Current session (checked in but not out)
    const currentSession =
      attendanceHistory.find((a) => a.checkInAt && !a.checkOutAt) ?? null

    // Weekly chart (last 7 days including today)
    const weeklyChart = Array.from({ length: 7 }, (_, i) => {
      const d = format(subDays(new Date(), 6 - i), 'yyyy-MM-dd')
      return { date: d, minutes: dailyTotals.get(d) ?? 0 }
    })

    // Recent sessions (last 5 completed)
    const recentSessions = attendanceHistory
      .filter((a) => a.checkInAt && a.checkOutAt)
      .slice(0, 5)
      .map((a) => ({
        id: a.id,
        date: format(a.checkInAt!, 'yyyy-MM-dd'),
        checkInAt: a.checkInAt,
        checkOutAt: a.checkOutAt,
        durationMinutes: calculateSessionMinutes(a.checkInAt!, a.checkOutAt!),
        library: a.bookingOccurrence?.booking?.library ?? null,
        seat: a.bookingOccurrence?.booking?.seat ?? null,
      }))

    const now = new Date()

    return NextResponse.json(
      serialize({
        todayStudyMinutes,
        weeklyStudyMinutes,
        monthlyStudyMinutes,
        streak: { current: currentStreak, longest: longestStreak },
        currentSession: currentSession
          ? {
              checkInAt: currentSession.checkInAt,
              library: currentSession.bookingOccurrence?.booking?.library ?? null,
              seat: currentSession.bookingOccurrence?.booking?.seat ?? null,
            }
          : null,
        todaySession: todayOccurrence
          ? {
              occurrenceId: todayOccurrence.id,
              date: format(new Date(todayOccurrence.date), 'yyyy-MM-dd'),
              startTime: todayOccurrence.startTime,
              endTime: todayOccurrence.endTime,
              status: getTodaySessionStatus(todayOccurrence, now),
              library: todayOccurrence.booking?.library ?? null,
              seat: todayOccurrence.booking?.seat ?? null,
              attendance: todayOccurrence.attendance
                ? {
                    checkInAt: todayOccurrence.attendance.checkInAt,
                    checkOutAt: todayOccurrence.attendance.checkOutAt,
                  }
                : null,
            }
          : null,
        nextSession: nextOccurrence
          ? {
              occurrenceId: nextOccurrence.id,
              date: format(new Date(nextOccurrence.date), 'yyyy-MM-dd'),
              startTime: nextOccurrence.startTime,
              endTime: nextOccurrence.endTime,
              library: nextOccurrence.booking?.library ?? null,
              seat: nextOccurrence.booking?.seat ?? null,
            }
          : null,
        weeklyChart,
        recentSessions,
      })
    )
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : ''
    if (msg === 'UNAUTHORIZED')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (msg === 'FORBIDDEN')
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
