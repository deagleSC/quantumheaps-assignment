import type { UserId } from '@/types/common.types'
import type { Message } from '@/types/message.types'
import { dayKey, formatDateSeparator } from './date-label'

/** Consecutive messages from one sender within this window form one cluster. */
export const CLUSTER_WINDOW_MS = 5 * 60_000

export type MessageRow =
  | { type: 'date'; key: string; label: string }
  | { type: 'unread'; key: string; count: number }
  | {
      type: 'message'
      key: string
      message: Message
      /** First in a cluster: show the sender name (groups) and top spacing. */
      isFirstInCluster: boolean
      /** Last in a cluster: show the avatar (groups) and the bubble tail. */
      isLastInCluster: boolean
    }

export interface BuildRowsOptions {
  currentUserId: UserId | null
  /** Show an "Unread messages" divider above the last `unreadCount` incoming messages. */
  unreadCount?: number
  now?: Date
}

const clusters = (a: Message, b: Message) =>
  a.kind === 'text' &&
  b.kind === 'text' &&
  a.senderId === b.senderId &&
  dayKey(new Date(a.createdAt)) === dayKey(new Date(b.createdAt)) &&
  new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() <= CLUSTER_WINDOW_MS

/** Index of the first unread message: the oldest of the last `count` incoming ones. */
function firstUnreadIndex(messages: Message[], count: number, currentUserId: UserId | null) {
  if (count <= 0) return -1
  let seen = 0
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]!
    if (m.senderId !== currentUserId && m.kind === 'text') {
      seen += 1
      if (seen === count) return i
    }
  }
  return -1
}

/**
 * Flattens messages into render rows: day separators, the unread divider and
 * clustered messages. A flat row model lets the list be virtualised later.
 */
export function buildRows(messages: Message[], options: BuildRowsOptions): MessageRow[] {
  const { currentUserId, unreadCount = 0, now = new Date() } = options
  const rows: MessageRow[] = []
  const unreadAt = firstUnreadIndex(messages, unreadCount, currentUserId)
  let lastDay = ''

  messages.forEach((message, i) => {
    const date = new Date(message.createdAt)
    const day = dayKey(date)
    if (day !== lastDay) {
      rows.push({ type: 'date', key: `date-${day}`, label: formatDateSeparator(date, now) })
      lastDay = day
    }
    if (i === unreadAt) rows.push({ type: 'unread', key: 'unread', count: unreadCount })

    const prev = messages[i - 1]
    const next = messages[i + 1]
    rows.push({
      type: 'message',
      key: message.id,
      message,
      // The unread divider also breaks a cluster.
      isFirstInCluster: !prev || !clusters(prev, message) || i === unreadAt,
      isLastInCluster: !next || !clusters(message, next) || i + 1 === unreadAt,
    })
  })
  return rows
}

export type DateRow = Extract<MessageRow, { type: 'date' }>
export interface DaySection {
  date: DateRow
  rows: Exclude<MessageRow, DateRow>[]
}

/** Groups the flat rows by day (for sticky day labels in the non-virtual list). */
export function groupIntoSections(rows: MessageRow[]): DaySection[] {
  const sections: DaySection[] = []
  for (const row of rows) {
    if (row.type === 'date') sections.push({ date: row, rows: [] })
    else sections.at(-1)?.rows.push(row)
  }
  return sections
}
