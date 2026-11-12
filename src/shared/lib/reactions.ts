import type { UserId } from '@/types/common.types'
import type { Reaction } from '@/types/message.types'

/** The quick-reaction set offered in the picker (also used by seed data). */
export const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const

/**
 * Adds `userId`'s `emoji` reaction, or removes it if already present.
 * Pure: returns new arrays, so it works for optimistic UI and the mock DB alike.
 */
export function toggleReaction(reactions: Reaction[], emoji: string, userId: UserId): Reaction[] {
  const existing = reactions.find((r) => r.emoji === emoji)
  if (!existing) return [...reactions, { emoji, userIds: [userId] }]
  if (!existing.userIds.includes(userId)) {
    return reactions.map((r) => (r === existing ? { ...r, userIds: [...r.userIds, userId] } : r))
  }
  const userIds = existing.userIds.filter((id) => id !== userId)
  return userIds.length === 0
    ? reactions.filter((r) => r !== existing)
    : reactions.map((r) => (r === existing ? { ...r, userIds } : r))
}
