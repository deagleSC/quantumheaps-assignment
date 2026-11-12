import { setMockNetworkOnline } from '@/services/mock/mock-api'
import { realtimeServices } from './realtime-services'

export const connectionServices = {
  /** Switches the (mock) network and the realtime connection together. */
  setOnline: (online: boolean): void => {
    setMockNetworkOnline(online)
    realtimeServices.setPaused(!online)
  },
}
