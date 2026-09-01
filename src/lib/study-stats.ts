export const STREAK_MIN_STUDY_MINUTES = 30

export interface AttendanceRecord {
  checkInAt: Date
  checkOutAt: Date | null
  date: string // YYYY-MM-DD business date of the session
}

/** Returns clamped session minutes. Negative or >16h = 0. null checkOut = 0. */
export function calculateSessionMinutes(
  checkInAt: Date,
  checkOutAt: Date | null
): number {
  if (!checkOutAt) return 0
  const ms = checkOutAt.getTime() - checkInAt.getTime()
  if (ms <= 0) return 0
  const minutes = Math.floor(ms / 60000)
  if (minutes > 16 * 60) return 0
  return minutes
}

/** Sums completed (both in+out) sessions per calendar date. Returns Map<date, minutes>. */
export function calculateDailyStudyTotals(
  records: AttendanceRecord[]
): Map<string, number> {
  const map = new Map<string, number>()
  for (const r of records) {
    if (!r.checkInAt || !r.checkOutAt) continue
    const mins = calculateSessionMinutes(r.checkInAt, r.checkOutAt)
    if (mins <= 0) continue
    map.set(r.date, (map.get(r.date) ?? 0) + mins)
  }
  return map
}

/**
 * Current streak = consecutive qualifying calendar days ending on today or yesterday.
 * A day qualifies if total completed study minutes >= STREAK_MIN_STUDY_MINUTES.
 * Uses todayDate param so it is testable.
 */
export function calculateCurrentStreak(
  dailyTotals: Map<string, number>,
  todayDate: string // YYYY-MM-DD
): number {
  // Parse todayDate into a Date (UTC midnight)
  const [ty, tm, td] = todayDate.split('-').map(Number)
  const today = new Date(Date.UTC(ty, tm - 1, td))

  // Determine starting point: today if qualifying, else yesterday
  const todayMinutes = dailyTotals.get(todayDate) ?? 0
  let streak = 0
  let cursor: Date

  if (todayMinutes >= STREAK_MIN_STUDY_MINUTES) {
    streak = 1
    cursor = new Date(Date.UTC(ty, tm - 1, td - 1))
  } else {
    // Start from yesterday
    cursor = new Date(Date.UTC(ty, tm - 1, td - 1))
    const yesterdayStr = formatDateKey(cursor)
    const yesterdayMinutes = dailyTotals.get(yesterdayStr) ?? 0
    if (yesterdayMinutes < STREAK_MIN_STUDY_MINUTES) return 0
    streak = 1
    cursor = new Date(cursor.getTime() - 86400000)
  }

  // Walk backward
  while (true) {
    const key = formatDateKey(cursor)
    const mins = dailyTotals.get(key) ?? 0
    if (mins >= STREAK_MIN_STUDY_MINUTES) {
      streak++
      cursor = new Date(cursor.getTime() - 86400000)
    } else {
      break
    }
  }

  return streak
}

/** Longest unbroken streak of qualifying days in the entire dailyTotals map. */
export function calculateLongestStreak(
  dailyTotals: Map<string, number>
): number {
  if (dailyTotals.size === 0) return 0

  const sortedDates = Array.from(dailyTotals.keys()).sort()
  let longest = 0
  let current = 0
  let prevDate: Date | null = null

  for (const dateStr of sortedDates) {
    const mins = dailyTotals.get(dateStr) ?? 0
    const [y, m, d] = dateStr.split('-').map(Number)
    const date = new Date(Date.UTC(y, m - 1, d))

    if (mins >= STREAK_MIN_STUDY_MINUTES) {
      if (prevDate === null) {
        current = 1
      } else {
        const diffDays = Math.round((date.getTime() - prevDate.getTime()) / 86400000)
        if (diffDays === 1) {
          current++
        } else {
          current = 1
        }
      }
      if (current > longest) longest = current
      prevDate = date
    } else {
      prevDate = null
      current = 0
    }
  }

  return longest
}

/** Sum of completed study minutes for the 7-day window ending on todayDate (inclusive). */
export function calculateWeeklyStudyMinutes(
  dailyTotals: Map<string, number>,
  todayDate: string
): number {
  const [ty, tm, td] = todayDate.split('-').map(Number)
  let total = 0
  for (let i = 0; i < 7; i++) {
    const d = new Date(Date.UTC(ty, tm - 1, td - i))
    const key = formatDateKey(d)
    total += dailyTotals.get(key) ?? 0
  }
  return total
}

/** Sum of completed study minutes for the calendar month containing todayDate. */
export function calculateMonthlyStudyMinutes(
  dailyTotals: Map<string, number>,
  todayDate: string
): number {
  const prefix = todayDate.slice(0, 7) // "YYYY-MM"
  let total = 0
  for (const [key, mins] of dailyTotals) {
    if (key.startsWith(prefix)) {
      total += mins
    }
  }
  return total
}

/** Returns "2h 05m", "45m", "0m". */
export function formatStudyDuration(minutes: number): string {
  if (minutes <= 0) return '0m'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  return `${h}h ${String(m).padStart(2, '0')}m`
}

// Internal helper: format a UTC Date as YYYY-MM-DD
function formatDateKey(date: Date): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
