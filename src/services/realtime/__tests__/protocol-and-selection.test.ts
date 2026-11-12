import { realtimeSimulator } from '@/services/mock/realtime-simulator'
import { decodeClientFrame, decodeServerFrame, encode } from '../protocol'
import { getRealtimeTransport, readTransportMode, setRealtimeTransport } from '../get-transport'
import { WebSocketTransport } from '../websocket-transport'

describe('protocol', () => {
  it('round-trips frames', () => {
    const server = {
      type: 'typing:start' as const,
      payload: { conversationId: 'c1', userId: 'u1' },
    }
    expect(decodeServerFrame(encode(server))).toEqual(server)
    const client = { type: 'outgoing' as const, message: { id: 'm1' } as never }
    expect(decodeClientFrame(encode(client))).toEqual(client)
  })

  it.each(['not json', '{}', '{"type":1}', 'null'])('rejects malformed server frame %j', (raw) => {
    expect(decodeServerFrame(raw)).toBeNull()
  })

  it.each(['not json', '{"type":"outgoing"}', '{"type":"other","message":{}}'])(
    'rejects malformed client frame %j',
    (raw) => {
      expect(decodeClientFrame(raw)).toBeNull()
    },
  )
})

describe('transport selection', () => {
  afterEach(() => {
    setRealtimeTransport(null)
    window.history.replaceState(null, '', '/')
    vi.unstubAllEnvs()
  })

  it('defaults to the in-memory simulator', () => {
    expect(readTransportMode()).toBe('memory')
    expect(getRealtimeTransport()).toBe(realtimeSimulator)
    expect(getRealtimeTransport().kind).toBe('memory')
  })

  it('uses WebSocket with ?realtime=ws, and the URL wins over the env flag', () => {
    vi.stubEnv('VITE_REALTIME', 'memory')
    window.history.replaceState(null, '', '/?realtime=ws')
    expect(readTransportMode()).toBe('ws')
    const transport = getRealtimeTransport()
    expect(transport).toBeInstanceOf(WebSocketTransport)
    expect(transport.kind).toBe('websocket')
  })

  it('reads VITE_REALTIME when the URL says nothing', () => {
    vi.stubEnv('VITE_REALTIME', 'ws')
    expect(readTransportMode()).toBe('ws')
  })
})
