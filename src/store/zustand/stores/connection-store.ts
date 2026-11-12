import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

export interface ConnectionState {
  /** `navigator.onLine`, kept in sync with online/offline events. */
  isBrowserOnline: boolean
  /** "Simulate offline" demo toggle. */
  isSimulatedOffline: boolean
}

export interface ConnectionStoreActions {
  setBrowserOnline: (online: boolean) => void
  setSimulatedOffline: (offline: boolean) => void
}

export type ConnectionStore = ConnectionState & ConnectionStoreActions

export const initialConnectionState: ConnectionState = {
  isBrowserOnline: typeof navigator === 'undefined' ? true : navigator.onLine,
  isSimulatedOffline: false,
}

export const selectIsOnline = (s: ConnectionState) => s.isBrowserOnline && !s.isSimulatedOffline

export const useConnectionStore = create<ConnectionStore>()(
  devtools(
    (set) => ({
      ...initialConnectionState,
      setBrowserOnline: (isBrowserOnline) => set({ isBrowserOnline }),
      setSimulatedOffline: (isSimulatedOffline) => set({ isSimulatedOffline }),
    }),
    { name: 'connection-store' },
  ),
)
