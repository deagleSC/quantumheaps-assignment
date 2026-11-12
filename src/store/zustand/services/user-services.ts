import { mockApi } from '@/services/mock/mock-api'
import { handleError } from '@/shared/lib/handle-error'
import type { UserId } from '@/types/common.types'
import type { User } from '@/types/user.types'

export const userServices = {
  getCurrentUserId: async (): Promise<UserId> => {
    try {
      return await mockApi.getCurrentUserId()
    } catch (error) {
      throw new Error(handleError(error, 'Could not load your profile'))
    }
  },

  getAll: async (): Promise<User[]> => {
    try {
      return await mockApi.getUsers()
    } catch (error) {
      throw new Error(handleError(error, 'Could not load contacts'))
    }
  },
}
