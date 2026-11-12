import type { RealtimeEventMap, RealtimeEventType } from '@/services/mock/realtime-simulator'
import type { Message } from '@/types/message.types'

/** Server → client: one realtime event per frame. */
export type ServerFrame = {
  [K in RealtimeEventType]: { type: K; payload: RealtimeEventMap[K] }
}[RealtimeEventType]

/** Client → server: tell the server about a message the REST API accepted. */
export type ClientFrame = { type: 'outgoing'; message: Message }

export const encode = (frame: ServerFrame | ClientFrame) => JSON.stringify(frame)

export function decodeServerFrame(data: unknown): ServerFrame | null {
  try {
    const frame = JSON.parse(String(data)) as ServerFrame
    return frame && typeof frame.type === 'string' && 'payload' in frame ? frame : null
  } catch {
    return null
  }
}

export function decodeClientFrame(data: unknown): ClientFrame | null {
  try {
    const frame = JSON.parse(String(data)) as ClientFrame
    return frame?.type === 'outgoing' && frame.message ? frame : null
  } catch {
    return null
  }
}
