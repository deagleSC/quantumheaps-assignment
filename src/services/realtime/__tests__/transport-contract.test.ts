// @vitest-environment node
import { createRealtimeServer, type RealtimeServer } from '../../../../mock-server/realtime-server'
import { MockDb } from '@/services/mock/mock-db'
import { RealtimeSimulator } from '@/services/mock/realtime-simulator'
import type { RealtimeSimulatorConfig } from '@/shared/lib/configs/mock-api'
import type { Message } from '@/types/message.types'
import type { RealtimeEventType, RealtimeTransport } from '../transport'
import { WebSocketTransport } from '../websocket-transport'

/** Fast, deterministic simulator settings shared by both transports. */
const config: Partial<RealtimeSimulatorConfig> = {
  deliveredDelayMs: 20,
  readDelayMs: 20,
  typingDelayMs: 20,
  typingDurationMs: 40,
  replyProbability: 1,
  incomingIntervalMs: { min: 60_000, max: 60_000 },
  presenceIntervalMs: 60_000,
}
const random = () => 0

const outgoing = (): Message => ({
  id: `m-out-${Math.random().toString(36).slice(2)}`,
  conversationId: 'c-daniel',
  senderId: 'u-me',
  kind: 'text',
  content: 'contract test',
  createdAt: new Date().toISOString(),
  status: 'sent',
  reactions: [],
})

const until = async (check: () => boolean, timeoutMs = 3000) => {
  const start = Date.now()
  while (!check()) {
    if (Date.now() - start > timeoutMs) throw new Error('timed out waiting for condition')
    await new Promise((r) => setTimeout(r, 10))
  }
}

const TYPES: RealtimeEventType[] = [
  'message:new',
  'message:status',
  'typing:start',
  'typing:stop',
  'presence:change',
]
function record(transport: RealtimeTransport) {
  const events: string[] = []
  const offs = TYPES.map((type) =>
    transport.on(type, (payload) => {
      const p = payload as { status?: string }
      events.push(type === 'message:status' ? `status:${p.status}` : type)
    }),
  )
  return { events, off: () => offs.forEach((o) => o()) }
}

interface Harness {
  transport: RealtimeTransport
  /** Called before sending, mirroring the REST API storing the message first. */
  prepare: (m: Message) => void
  teardown: () => Promise<void>
}

const harnesses: [string, () => Promise<Harness>][] = [
  [
    'in-memory simulator',
    async () => {
      const db = new MockDb()
      const transport = new RealtimeSimulator({ getDb: () => db, config, random })
      return {
        transport,
        prepare: (m) => db.insertExternal(m),
        teardown: async () => transport.dispose(),
      }
    },
  ],
  [
    'WebSocket transport + mock-server',
    async () => {
      const server = await createRealtimeServer({ port: 0, config, random })
      const transport = new WebSocketTransport(`ws://localhost:${server.port}`, {
        backoff: { baseMs: 20, maxMs: 100 },
      })
      return {
        transport,
        prepare: () => {},
        teardown: async () => (transport.stop(), server.close()),
      }
    },
  ],
]

describe.each(harnesses)('RealtimeTransport contract: %s', (_, make) => {
  let h: Harness
  beforeEach(async () => {
    h = await make()
  })
  afterEach(async () => {
    await h.teardown()
  })

  it('reports status, typing and a reply for an outgoing message', async () => {
    const { events, off } = record(h.transport)
    h.transport.start()
    const message = outgoing()
    h.prepare(message)
    h.transport.handleOutgoingMessage(message)
    await until(() => events.includes('message:new'))
    expect(events).toEqual([
      'status:delivered',
      'status:read',
      'typing:start',
      'typing:stop',
      'message:new',
    ])
    off()
  })

  it('emits nothing after stop()', async () => {
    const { events, off } = record(h.transport)
    h.transport.start()
    h.transport.stop()
    const message = outgoing()
    h.prepare(message)
    h.transport.handleOutgoingMessage(message)
    await new Promise((r) => setTimeout(r, 200))
    expect(events).toEqual([])
    off()
  })

  it('unsubscribes listeners', () => {
    const off = h.transport.on('message:new', () => {})
    expect(h.transport.listenerCount('message:new')).toBe(1)
    off()
    expect(h.transport.listenerCount('message:new')).toBe(0)
  })
})

describe('WebSocketTransport specifics', () => {
  it('buffers outgoing frames until connected, and applies frames before emitting', async () => {
    const server = await createRealtimeServer({ port: 0, config, random })
    const applied: string[] = []
    const transport = new WebSocketTransport(`ws://localhost:${server.port}`, {
      apply: (frame) => applied.push(frame.type),
    })
    const { events, off } = record(transport)
    transport.handleOutgoingMessage(outgoing()) // before start(): buffered
    transport.start()
    await until(() => events.includes('message:new'))
    expect(applied).toEqual([
      'message:status',
      'message:status',
      'typing:start',
      'typing:stop',
      'message:new',
    ])
    off()
    transport.stop()
    await server.close()
  })

  it('keeps a single connection through a quick stop → start (React StrictMode)', async () => {
    const server = await createRealtimeServer({ port: 0, config, random })
    const transport = new WebSocketTransport(`ws://localhost:${server.port}`, {
      backoff: { baseMs: 20, maxMs: 100 },
    })
    transport.start()
    transport.stop()
    transport.start()
    await until(() => transport.isConnected)
    await new Promise((r) => setTimeout(r, 300)) // give a stray reconnect time to happen
    expect(server.connections()).toBe(1)
    transport.stop()
    await server.close()
  })

  it('reconnects with backoff after the server restarts', async () => {
    let server: RealtimeServer = await createRealtimeServer({ port: 0, config, random })
    const port = server.port
    const transport = new WebSocketTransport(`ws://localhost:${port}`, {
      backoff: { baseMs: 20, maxMs: 100 },
    })
    transport.start()
    await until(() => transport.isConnected)

    await server.close()
    await until(() => !transport.isConnected)
    server = await createRealtimeServer({ port, config, random })
    await until(() => transport.isConnected, 5000)

    const { events, off } = record(transport)
    transport.handleOutgoingMessage(outgoing())
    await until(() => events.includes('message:new'))
    off()
    transport.stop()
    await server.close()
  })
})
