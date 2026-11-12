import { getRealtimeTransport } from '@/services/realtime/get-transport'
import type {
  RealtimeEventMap,
  RealtimeEventType,
  RealtimeTransport,
} from '@/services/realtime/transport'
import type { Message } from '@/types/message.types'

export type RealtimeHandlers = {
  [K in RealtimeEventType]?: (payload: RealtimeEventMap[K]) => void
}

/**
 * The realtime connection, behind the `RealtimeTransport` interface: the
 * in-memory simulator by default, or a WebSocket (`?realtime=ws`).
 */
export const realtimeServices = {
  /** Subscribes handlers and starts the connection. Returns a disconnect function. */
  connect: (handlers: RealtimeHandlers): (() => void) => {
    const transport = getRealtimeTransport()
    const offs = (Object.keys(handlers) as RealtimeEventType[]).map((type) =>
      transport.on(type, handlers[type] as (payload: RealtimeEventMap[typeof type]) => void),
    )
    transport.start()
    return () => {
      offs.forEach((off) => off())
      if (transport.listenerCount() === 0) transport.stop()
    }
  },

  /** Stops (offline) or restarts (online) live events while subscribed. */
  setPaused: (paused: boolean): void => {
    const transport = getRealtimeTransport()
    if (paused) transport.stop()
    else if (transport.listenerCount() > 0) transport.start()
  },

  /** Tells the server about a message it accepted, so status and replies follow. */
  notifyOutgoing: (message: Message): void => {
    getRealtimeTransport().handleOutgoingMessage(message)
  },

  /** Which transport is in use (shown in settings). */
  kind: (): RealtimeTransport['kind'] => getRealtimeTransport().kind,
}
