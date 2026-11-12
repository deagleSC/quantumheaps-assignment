import type { RealtimeEventMap, RealtimeEventType } from '@/services/mock/realtime-simulator'
import type { Message } from '@/types/message.types'

export type { RealtimeEventMap, RealtimeEventType }

/**
 * How realtime events reach the app. Implementations:
 * - `RealtimeSimulator` (in-memory, the default; no server needed)
 * - `WebSocketTransport` (talks to `mock-server/` over a real socket)
 */
export interface RealtimeTransport {
  readonly kind: 'memory' | 'websocket'
  on<K extends RealtimeEventType>(
    type: K,
    handler: (payload: RealtimeEventMap[K]) => void,
  ): () => void
  listenerCount(type?: RealtimeEventType): number
  /** Connect / start producing events. Idempotent. */
  start(): void
  /** Disconnect / stop producing events (listeners are kept). */
  stop(): void
  /** The REST API accepted one of our messages: status updates and replies follow. */
  handleOutgoingMessage(message: Message): void
}
