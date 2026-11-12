import { mockApi } from '@/services/mock/mock-api'
import { handleError } from '@/shared/lib/handle-error'

export const appServices = {
  resetDemoData: async (): Promise<void> => {
    try {
      await mockApi.resetDemoData()
    } catch (error) {
      throw new Error(handleError(error, 'Could not reset the demo data'))
    }
  },
}
