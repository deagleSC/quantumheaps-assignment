import { notify } from '@/shared/lib/notify'
import { connectionServices } from '../services/connection-services'
import { selectIsOnline, useConnectionStore } from '../stores/connection-store'
import { useOutboxStore } from '../stores/outbox-store'
import { messageActions } from './message-actions'

/** Applies an online/offline change: network, realtime, toast and outbox flush. */
function transition(update: () => void) {
  const before = selectIsOnline(useConnectionStore.getState())
  update()
  const after = selectIsOnline(useConnectionStore.getState())
  if (before === after) return
  connectionServices.setOnline(after)
  if (after) {
    const queued = useOutboxStore.getState().queue.length
    notify.success(queued > 0 ? `Back online, sending ${queued} queued` : 'Back online')
    void messageActions.flushOutbox()
  } else {
    notify.info('You are offline. Messages will be sent when you reconnect.')
  }
}

export const connectionActions = {
  /** From the browser's online/offline events. */
  setBrowserOnline: (online: boolean): void =>
    transition(() => useConnectionStore.getState().setBrowserOnline(online)),

  /** The "Simulate offline" demo toggle. */
  setSimulatedOffline: (offline: boolean): void =>
    transition(() => useConnectionStore.getState().setSimulatedOffline(offline)),

  /** Syncs the network layer with the initial state (e.g. the page loaded offline). */
  init: (): void => {
    connectionServices.setOnline(selectIsOnline(useConnectionStore.getState()))
  },
}
