import type { MessageStatus } from '@/types/message.types'

const rank: Record<MessageStatus, number> = {
  queued: 0,
  failed: 0,
  sending: 0,
  sent: 1,
  delivered: 2,
  read: 3,
}

/** Status events can arrive out of order; never move a message backwards. */
export const isStatusUpgrade = (from: MessageStatus, to: MessageStatus) => rank[to] > rank[from]
