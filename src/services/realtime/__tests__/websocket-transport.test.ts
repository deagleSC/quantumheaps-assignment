import { WebSocketTransport } from '../websocket-transport'

/** Minimal WebSocket stand-in whose close event is asynchronous, like browsers. */
class FakeSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3
  static instances: FakeSocket[] = []
  readyState = FakeSocket.CONNECTING
  sent: string[] = []
  onopen: (() => void) | null = null
  onclose: (() => void) | null = null
  onmessage: ((e: { data: string }) => void) | null = null
  onerror: (() => void) | null = null
  url: string
  constructor(url: string) {
    this.url = url
    FakeSocket.instances.push(this)
  }
  open() {
    this.readyState = FakeSocket.OPEN
    this.onopen?.()
  }
  send(data: string) {
    this.sent.push(data)
  }
  close() {
    this.readyState = FakeSocket.CLOSING
    setTimeout(() => {
      this.readyState = FakeSocket.CLOSED
      this.onclose?.()
    }, 0)
  }
  /** Server-side drop. */
  drop() {
    this.readyState = FakeSocket.CLOSED
    this.onclose?.()
  }
}

const make = () =>
  new WebSocketTransport('ws://test', {
    WebSocketImpl: FakeSocket as unknown as typeof WebSocket,
    backoff: { baseMs: 100, maxMs: 1000 },
  })

beforeEach(() => {
  vi.useFakeTimers()
  FakeSocket.instances = []
})
afterEach(() => vi.useRealTimers())

it('does not open a second connection after a quick stop → start (StrictMode)', () => {
  const t = make()
  t.start()
  t.stop()
  t.start()
  vi.advanceTimersByTime(5000) // the first socket's async close fires; no reconnect may follow
  expect(FakeSocket.instances).toHaveLength(2)
  t.stop()
})

it('reconnects with exponential backoff after drops, resetting once connected', () => {
  vi.spyOn(Math, 'random').mockReturnValue(0.5) // no jitter
  const t = make()
  t.start()
  FakeSocket.instances[0]!.drop()
  vi.advanceTimersByTime(99)
  expect(FakeSocket.instances).toHaveLength(1)
  vi.advanceTimersByTime(1) // 100ms
  expect(FakeSocket.instances).toHaveLength(2)
  FakeSocket.instances[1]!.drop()
  vi.advanceTimersByTime(199)
  expect(FakeSocket.instances).toHaveLength(2)
  vi.advanceTimersByTime(1) // 200ms (doubled)
  expect(FakeSocket.instances).toHaveLength(3)
  FakeSocket.instances[2]!.open() // success resets the backoff
  FakeSocket.instances[2]!.drop()
  vi.advanceTimersByTime(100)
  expect(FakeSocket.instances).toHaveLength(4)
  t.stop()
})

it('stops reconnecting after stop()', () => {
  const t = make()
  t.start()
  FakeSocket.instances[0]!.drop()
  t.stop()
  vi.advanceTimersByTime(10_000)
  expect(FakeSocket.instances).toHaveLength(1)
})

it('buffers outgoing frames until the socket opens', () => {
  const t = make()
  t.start()
  t.handleOutgoingMessage({ id: 'm1' } as never)
  const socket = FakeSocket.instances[0]!
  expect(socket.sent).toEqual([])
  socket.open()
  expect(socket.sent.map((s) => JSON.parse(s).type)).toEqual(['outgoing'])
  t.stop()
})
