/**
 * Utilities for generating and validating recurring booking occurrences.
 */

export interface OccurrenceSlot {
  date:      Date   // midnight UTC of the occurrence day
  startTime: Date   // full datetime of slot start
  endTime:   Date   // full datetime of slot end
}

/**
 * Parse "HH:MM" string and return hours + minutes.
 */
export function parseHHMM(t: string): { h: number; m: number } {
  const [h, m] = t.split(':').map(Number)
  return { h, m }
}

/**
 * Set the time of a date object to HH:MM (local time kept as-is, stored as UTC).
 * We treat all times as "wall clock" — no tz conversion.
 */
function withTime(base: Date, hhmm: string): Date {
  const { h, m } = parseHHMM(hhmm)
  const d = new Date(base)
  d.setUTCHours(h, m, 0, 0)
  return d
}

/**
 * Generate all occurrence slots for a recurring plan booking.
 *
 * @param startDate       First day of the plan (date only, time ignored)
 * @param endDate         Last day of the plan (inclusive)
 * @param dailyStartHHMM  "09:00"
 * @param dailyMinutes    Duration per slot in minutes
 * @param allowedDays     Array of weekday numbers (0=Sun…6=Sat). Empty = all days.
 */
export function generateOccurrences(
  startDate:       Date,
  endDate:         Date,
  dailyStartHHMM:  string,
  dailyMinutes:    number,
  allowedDays:     number[]
): OccurrenceSlot[] {
  const slots: OccurrenceSlot[] = []
  const allowed = allowedDays.length > 0 ? new Set(allowedDays) : new Set([0,1,2,3,4,5,6])

  // Iterate day by day
  const cur = new Date(startDate)
  cur.setUTCHours(0, 0, 0, 0)
  const last = new Date(endDate)
  last.setUTCHours(0, 0, 0, 0)

  while (cur <= last) {
    const dow = cur.getUTCDay() // 0=Sun
    if (allowed.has(dow)) {
      const start = withTime(cur, dailyStartHHMM)
      const end   = new Date(start.getTime() + dailyMinutes * 60 * 1000)
      slots.push({
        date:      new Date(cur),
        startTime: start,
        endTime:   end,
      })
    }
    cur.setUTCDate(cur.getUTCDate() + 1)
  }

  return slots
}

/**
 * Derive the daily end time string from start + minutes.
 */
export function calcEndTimeHHMM(startHHMM: string, dailyMinutes: number): string {
  const { h, m } = parseHHMM(startHHMM)
  const total = h * 60 + m + dailyMinutes
  const eh = Math.floor(total / 60) % 24
  const em = total % 60
  return `${String(eh).padStart(2,'0')}:${String(em).padStart(2,'0')}`
}

/**
 * Check if a given HH:MM time slot fits within library opening hours for a given day.
 */
export function fitsLibraryHours(
  slotStartHHMM: string,
  slotEndHHMM:   string,
  hours: Array<{ dayOfWeek: number; isOpen: boolean; openTime?: string | null; closeTime?: string | null }>,
  is24Hours: boolean,
  dayOfWeek: number
): boolean {
  if (is24Hours) return true
  const h = hours.find(x => x.dayOfWeek === dayOfWeek)
  if (!h || !h.isOpen || !h.openTime || !h.closeTime) return false

  const toMins = (t: string) => { const [hh, mm] = t.split(':').map(Number); return hh * 60 + mm }
  return toMins(slotStartHHMM) >= toMins(h.openTime) && toMins(slotEndHHMM) <= toMins(h.closeTime)
}
