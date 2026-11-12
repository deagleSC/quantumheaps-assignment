import type { ConversationId, ISODateString, UserId } from '@/types/common.types'
import type { Message, Reaction } from '@/types/message.types'
import { phrases, reactionEmojis } from './phrases'
import { pick, randomInt, type Rng } from './random'

const DAY_MS = 24 * 60 * 60 * 1000

export interface GenerateMessagesOptions {
  conversationId: ConversationId
  count: number
  currentUserId: UserId
  /** Everyone who can send in this conversation, including the current user. */
  participantIds: UserId[]
  /** Trailing messages forced to come from other people (unread). */
  unread: number
  days: number
  /** Timestamp the history ends at (ms). */
  now: number
  rng: Rng
}

/**
 * Generates a realistic, deterministic history:
 * ascending timestamps spread over `days` in daytime bursts, alternating
 * senders, the odd reply, reaction and edit, and statuses that match reads.
 */
export function generateMessages(opts: GenerateMessagesOptions): Message[] {
  const { conversationId, count, currentUserId, participantIds, unread, days, now, rng } = opts
  if (count <= 0) return []
  const others = participantIds.filter((id) => id !== currentUserId)
  if (others.length === 0)
    throw new Error(`Conversation ${conversationId} has no other participants`)

  const start = now - days * DAY_MS
  const span = Math.max(now - start - 60_000, count * 1000)
  const times = Array.from({ length: count }, () => start + Math.floor(rng() * span)).sort(
    (a, b) => a - b,
  )
  // Keep timestamps strictly increasing so ordering is stable.
  for (let i = 1; i < times.length; i++) {
    const prev = times[i - 1] as number
    if ((times[i] as number) <= prev) times[i] = prev + 1000
  }

  const messages: Message[] = []
  let sender = pick(rng, participantIds)

  for (let i = 0; i < count; i++) {
    const isUnreadTail = i >= count - unread
    // Senders tend to send a few messages in a row.
    if (rng() < 0.45) sender = pick(rng, participantIds)
    if (isUnreadTail) sender = sender === currentUserId ? pick(rng, others) : sender
    // The message right before the unread tail is the user's own, so the
    // unread divider has a clean boundary.
    if (unread > 0 && i === count - unread - 1) sender = currentUserId

    const createdAt = new Date(times[i] as number).toISOString()
    const isOwn = sender === currentUserId
    const message: Message = {
      id: `${conversationId}-m${i + 1}`,
      conversationId,
      senderId: sender,
      kind: 'text',
      content: pick(rng, phrases),
      createdAt,
      // History is read; the latest own message may only be delivered (below).
      status: 'read',
      reactions: [],
    }

    if (i > 3 && rng() < 0.1) {
      const target = messages[randomInt(rng, Math.max(0, i - 8), i - 1)]
      if (target) message.replyToId = target.id
    }
    if (rng() < 0.12) message.reactions = randomReactions(rng, participantIds, sender)
    if (isOwn && rng() < 0.05) {
      message.editedAt = addMinutes(createdAt, randomInt(rng, 1, 10))
    }
    messages.push(message)
  }

  const last = messages[messages.length - 1]
  if (last && last.senderId === currentUserId && rng() < 0.5) last.status = 'delivered'
  return messages
}

function randomReactions(rng: Rng, participants: UserId[], sender: UserId): Reaction[] {
  const reactors = participants.filter((id) => id !== sender)
  if (reactors.length === 0) return []
  const emoji = pick(rng, reactionEmojis)
  const userIds = reactors.filter(() => rng() < 0.5)
  return [{ emoji, userIds: userIds.length > 0 ? userIds : [pick(rng, reactors)] }]
}

const addMinutes = (iso: ISODateString, minutes: number) =>
  new Date(new Date(iso).getTime() + minutes * 60_000).toISOString()
