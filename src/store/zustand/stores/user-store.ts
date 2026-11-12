import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { AsyncStatus, UserId } from '@/types/common.types'
import type { User } from '@/types/user.types'

export interface UserState {
  currentUserId: UserId | null
  byId: Record<UserId, User>
  status: AsyncStatus
  error: string | null
}

export interface UserStoreActions {
  setCurrentUserId: (id: UserId) => void
  setUsers: (users: User[]) => void
  patchUser: (id: UserId, patch: Partial<User>) => void
  setStatus: (status: AsyncStatus, error?: string | null) => void
}

export type UserStore = UserState & UserStoreActions

export const initialUserState: UserState = {
  currentUserId: null,
  byId: {},
  status: 'idle',
  error: null,
}

export const useUserStore = create<UserStore>()(
  devtools(
    (set) => ({
      ...initialUserState,
      setCurrentUserId: (currentUserId) => set({ currentUserId }),
      setUsers: (users) => set({ byId: Object.fromEntries(users.map((u) => [u.id, u])) }),
      patchUser: (id, patch) =>
        set((s) => {
          const user = s.byId[id]
          return user ? { byId: { ...s.byId, [id]: { ...user, ...patch } } } : s
        }),
      setStatus: (status, error = null) => set({ status, error }),
    }),
    { name: 'user-store' },
  ),
)
