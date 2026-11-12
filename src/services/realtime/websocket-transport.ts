import { TypedEmitter } from '@/services/mock/typed-emitter'
import type { Message } from '@/types/message.types'
import { type ClientFrame, decodeServerFrame, encode, type ServerFrame } from './protocol'
import type { RealtimeEventMap, RealtimeEventType, RealtimeTransport } from './transport'

export interface WebSocketTransportOptions {
  /** Called for every server frame before listeners see it (keeps the REST mock in sync). */
  apply?: (frame: ServerFrame) => void
  /** Reconnect backoff: base delay doubles per attempt, capped at `maxMs`. */
  backoff?: { baseMs: number; maxMs: number }
  /** For tests or other runtimes. */
  WebSocketImpl?: typeof WebSocket
}

/**
 * Realtime over a WebSocket, with automatic reconnect (exponential backoff)
 * and a small buffer for outgoing frames written while disconnected.
 */
export class WebSocketTransport implements RealtimeTransport {
  readonly kind = 'websocket' as const
  private readonly emitter = new TypedEmitter<RealtimeEventMap>()
  private socket: WebSocket | null = null
  private wanted = false
  private attempt = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private pending: ClientFrame[] = []
  private readonly backoff: { baseMs: number; maxMs: number }
  private readonly WS: typeof WebSocket

  private readonly url: string
  private readonly options: WebSocketTransportOptions

  constructor(url: string, options: WebSocketTransportOptions = {}) {
    this.url = url
    this.options = options
    this.backoff = options.backoff ?? { baseMs: 500, maxMs: 10_000 }
    this.WS = options.WebSocketImpl ?? globalThis.WebSocket
  }

  get isConnected() {
    return this.socket?.readyState === this.WS.OPEN
  }

  on<K extends RealtimeEventType>(type: K, handler: (payload: RealtimeEventMap[K]) => void) {
    return this.emitter.on(type, handler)
  }

  listenerCount(type?: RealtimeEventType) {
    return this.emitter.listenerCount(type)
  }

  start(): void {
    if (this.wanted) return
    this.wanted = true
    this.connect()
  }

  stop(): void {
    this.wanted = false
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.reconnectTimer = null
    const socket = this.socket
    this.socket = null
    socket?.close()
  }

  handleOutgoingMessage(message: Message): void {
    this.send({ type: 'outgoing', message })
  }

  private send(frame: ClientFrame) {
    if (this.socket && this.isConnected) this.socket.send(encode(frame))
    else this.pending.push(frame)
  }

  private connect() {
    const socket = new this.WS(this.url)
    this.socket = socket
    socket.onopen = () => {
      this.attempt = 0
      const pending = this.pending
      this.pending = []
      pending.forEach((frame) => socket.send(encode(frame)))
    }
    socket.onmessage = (event) => {
      const frame = decodeServerFrame(event.data)
      if (!frame) return
      this.options.apply?.(frame)
      this.emitter.emit(frame.type, frame.payload as never)
    }
    socket.onclose = () => {
      // Only the current socket may trigger a reconnect. A socket closed by
      // stop() (e.g. a quick stop → start) must not open a second connection.
      if (this.socket !== socket) return
      this.socket = null
      if (this.wanted) this.scheduleReconnect()
    }
    socket.onerror = () => {
      // A close event always follows; reconnecting happens there.
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return
    const { baseMs, maxMs } = this.backoff
    const delay = Math.min(maxMs, baseMs * 2 ** this.attempt) * (0.8 + Math.random() * 0.4)
    this.attempt += 1
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (this.wanted) this.connect()
    }, delay)
  }
}
