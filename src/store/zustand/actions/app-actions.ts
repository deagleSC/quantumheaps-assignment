import { handleError } from '@/shared/lib/handle-error'
import { notify } from '@/shared/lib/notify'
import { appServices } from '../services/app-services'

export const appActions = {
  /** Wipes saved chats and reloads with fresh seed data. */
  resetDemoData: async (reload: () => void = () => window.location.reload()): Promise<void> => {
    try {
      await appServices.resetDemoData()
      reload()
    } catch (error) {
      notify.error(handleError(error))
    }
  },
}
