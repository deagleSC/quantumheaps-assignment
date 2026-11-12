import type { UserId } from '@/types/common.types'
import type { User } from '@/types/user.types'

export interface MemberEntry {
  user: User
  isAdmin: boolean
  isYou: boolean
}

/** You first, then online members, then offline; alphabetical within each. */
export function sortMembers(
  memberIds: UserId[],
  adminIds: UserId[],
  usersById: Record<UserId, User>,
  currentUserId: UserId | null,
): MemberEntry[] {
  return memberIds
    .flatMap((id) => {
      const user = usersById[id]
      return user ? [{ user, isAdmin: adminIds.includes(id), isYou: id === currentUserId }] : []
    })
    .sort((a, b) => {
      if (a.isYou !== b.isYou) return a.isYou ? -1 : 1
      if (a.user.isOnline !== b.user.isOnline) return a.user.isOnline ? -1 : 1
      return a.user.name.localeCompare(b.user.name)
    })
}
