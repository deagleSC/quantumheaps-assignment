import { WebSocketServer } from 'ws'
import type { RealtimeSimulatorConfig } from '../src/shared/lib/configs/mock-api'
import { MockDb } from '../src/services/mock/mock-db'
import { REALTIME_EVENT_TYPES, RealtimeSimulator } from '../src/services/mock/realtime-simulator'
import { decodeClientFrame, encode, type ServerFrame } from '../src/services/realtime/protocol'

export interface RealtimeServerOptions {
  /** 0 picks a free port (tests). */
  port?: number
  config?: Partial<RealtimeSimulatorConfig>
  random?: () => number
  log?: (message: string) => void
}

export interface RealtimeServer {
  port: number
  /** Open client connections. */
  connections: () => number
  close: () => Promise<void>
}

/**
 * A tiny realtime server: each connection gets its own copy of the seed data
 * and a RealtimeSimulator (the same code the in-memory transport runs), whose
 * events are forwarded to the client as JSON frames.
 */
export function createRealtimeServer(options: RealtimeServerOptions = {}): Promise<RealtimeServer> {
  const { port = 8787, config, random, log = () => {} } = options
  const wss = new WebSocketServer({ port })

  wss.on('connection', (socket) => {
    const db = new MockDb()
    const simulator = new RealtimeSimulator({ getDb: () => db, config, random })
    const offs = REALTIME_EVENT_TYPES.map((type) =>
      simulator.on(type, (payload) => {
        if (socket.readyState === socket.OPEN) {
          socket.send(encode({ type, payload } as ServerFrame))
        }
      }),
    )
    simulator.start()
    log(`client connected (${wss.clients.size} open)`)

    socket.on('message', (data) => {
      const frame = decodeClientFrame(data)
      if (!frame) return
      try {
        db.insertExternal(frame.message)
        simulator.handleOutgoingMessage(frame.message)
      } catch (error) {
        log(`ignored outgoing message: ${(error as Error).message}`)
      }
    })

    socket.on('close', () => {
      offs.forEach((off) => off())
      simulator.dispose()
      log(`client disconnected (${wss.clients.size} open)`)
    })
  })

  return new Promise((resolve, reject) => {
    wss.once('error', reject)
    wss.once('listening', () => {
      const address = wss.address()
      resolve({
        port: typeof address === 'object' && address ? address.port : port,
        connections: () => wss.clients.size,
        close: () =>
          new Promise<void>((done) => {
            wss.clients.forEach((client) => client.terminate())
            wss.close(() => done())
          }),
      })
    })
  })
}
