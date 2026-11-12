import { differenceInCalendarDays, format, isToday, isYesterday } from 'date-fns'
import type { ISODateString } from '@/types/common.types'

/**
 * Sidebar timestamp: "14:05" today, "Yesterday", weekday within a week,
 * otherwise a short date.
 */
export function formatConversationTime(iso: ISODateString, now: Date = new Date()): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  if (isToday(date)) return format(date, 'HH:mm')
  if (isYesterday(date)) return 'Yesterday'
  if (differenceInCalendarDays(now, date) < 7) return format(date, 'EEE')
  return format(date, 'dd/MM/yy')
}

/** Message bubble time: always "HH:mm". */
export const formatMessageTime = (iso: ISODateString) => format(new Date(iso), 'HH:mm')

/** "last seen today at 14:05", "last seen yesterday at 09:12", "last seen 03/11/26". */
export function formatLastSeen(iso: ISODateString | undefined): string {
  if (!iso) return 'offline'
  const date = new Date(iso)
  if (isToday(date)) return `last seen today at ${format(date, 'HH:mm')}`
  if (isYesterday(date)) return `last seen yesterday at ${format(date, 'HH:mm')}`
  return `last seen ${format(date, 'dd/MM/yy')}`
}
