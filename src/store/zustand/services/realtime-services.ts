import {
  realtimeSimulator,
  type RealtimeEventMap,
  type RealtimeEventType,
} from '@/services/mock/realtime-simulator'
import type { Message } from '@/types/message.types'

export type RealtimeHandlers = {
  [K in RealtimeEventType]?: (payload: RealtimeEventMap[K]) => void
}

/**
 * The realtime "socket". Today it wraps the in-memory simulator; Phase 9 puts
 * a WebSocket transport behind the same interface.
 */
export const realtimeServices = {
  /** Subscribes handlers and starts the connection. Returns a disconnect function. */
  connect: (handlers: RealtimeHandlers): (() => void) => {
    const offs = (Object.keys(handlers) as RealtimeEventType[]).map((type) =>
      realtimeSimulator.on(
        type,
        handlers[type] as (payload: RealtimeEventMap[typeof type]) => void,
      ),
    )
    realtimeSimulator.start()
    return () => {
      offs.forEach((off) => off())
      if (realtimeSimulator.listenerCount() === 0) realtimeSimulator.stop()
    }
  },

  /** Tells the server about a message it accepted, so status and replies follow. */
  notifyOutgoing: (message: Message): void => {
    realtimeSimulator.handleOutgoingMessage(message)
  },
}
