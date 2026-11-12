import { onRemoteChange } from '@/services/mock/mock-api'
import { getRealtimeTransport } from '@/services/realtime/get-transport'
import type {
  RealtimeEventMap,
  RealtimeEventType,
  RealtimeTransport,
} from '@/services/realtime/transport'
import type { Conversation } from '@/types/conversation.types'
import type { Message } from '@/types/message.types'

/** Events that only come from other tabs (records changed elsewhere). */
export type SyncEventMap = {
  'message:updated': { message: Message }
  'conversation:updated': { conversation: Conversation }
}

export type RealtimeHandlers = {
  [K in RealtimeEventType]?: (payload: RealtimeEventMap[K]) => void
} & {
  [K in keyof SyncEventMap]?: (payload: SyncEventMap[K]) => void
}

const transportTypes = (handlers: RealtimeHandlers) =>
  (Object.keys(handlers) as string[]).filter(
    (type): type is RealtimeEventType =>
      type !== 'message:updated' && type !== 'conversation:updated',
  )

/**
 * The realtime connection, behind the `RealtimeTransport` interface: the
 * in-memory simulator by default, or a WebSocket (`?realtime=ws`).
 */
export const realtimeServices = {
  /** Subscribes handlers and starts the connection. Returns a disconnect function. */
  connect: (handlers: RealtimeHandlers): (() => void) => {
    const transport = getRealtimeTransport()
    const offs = transportTypes(handlers).map((type) =>
      transport.on(type, handlers[type] as (payload: RealtimeEventMap[typeof type]) => void),
    )
    // Changes made in other open tabs arrive as the same kinds of events.
    const offTabs = onRemoteChange(({ op, isNew }) => {
      if (op.type === 'message') {
        if (isNew) handlers['message:new']?.({ message: op.message })
        else handlers['message:updated']?.({ message: op.message })
      } else if (op.type === 'conversation') {
        handlers['conversation:updated']?.({ conversation: op.conversation })
      } else {
        const { id, isOnline, lastSeen } = op.user
        handlers['presence:change']?.({ userId: id, isOnline, lastSeen })
      }
    })
    transport.start()
    return () => {
      offTabs()
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
