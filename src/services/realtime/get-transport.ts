import { applyServerEvent } from '@/services/mock/mock-api'
import { realtimeSimulator } from '@/services/mock/realtime-simulator'
import type { RealtimeTransport } from './transport'
import { WebSocketTransport } from './websocket-transport'

export const DEFAULT_WS_URL = 'ws://localhost:8787'

/** `?realtime=ws` in the URL wins over `VITE_REALTIME=ws`; anything else means in-memory. */
export function readTransportMode(): 'memory' | 'ws' {
  const fromUrl =
    typeof location !== 'undefined' ? new URLSearchParams(location.search).get('realtime') : null
  const mode = fromUrl ?? import.meta.env?.VITE_REALTIME
  return mode === 'ws' ? 'ws' : 'memory'
}

let transport: RealtimeTransport | null = null

export function getRealtimeTransport(): RealtimeTransport {
  transport ??=
    readTransportMode() === 'ws'
      ? new WebSocketTransport(import.meta.env?.VITE_WS_URL || DEFAULT_WS_URL, {
          apply: applyServerEvent,
        })
      : realtimeSimulator
  return transport
}

/** Tests: swap the transport (pass `null` to go back to the default). */
export function setRealtimeTransport(next: RealtimeTransport | null) {
  transport = next
}
