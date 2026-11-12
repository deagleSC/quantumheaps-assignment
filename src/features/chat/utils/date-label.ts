import { differenceInCalendarDays, format, isSameYear, isToday, isYesterday } from 'date-fns'

/** Day separator text: "Today", "Yesterday", "Monday", "Tue, 3 Nov", "3 Nov 2025". */
export function formatDateSeparator(date: Date, now: Date = new Date()): string {
  if (isToday(date)) return 'Today'
  if (isYesterday(date)) return 'Yesterday'
  if (differenceInCalendarDays(now, date) < 7) return format(date, 'EEEE')
  if (isSameYear(date, now)) return format(date, 'EEE, d MMM')
  return format(date, 'd MMM yyyy')
}

/** Local calendar-day key, e.g. "2026-11-12". */
export const dayKey = (date: Date) => format(date, 'yyyy-MM-dd')
