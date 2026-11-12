import { TypedEmitter } from '../typed-emitter'

type Events = { ping: { n: number }; pong: string }

describe('TypedEmitter', () => {
  it('delivers payloads and unsubscribes', () => {
    const e = new TypedEmitter<Events>()
    const handler = vi.fn()
    const off = e.on('ping', handler)
    e.emit('ping', { n: 1 })
    off()
    e.emit('ping', { n: 2 })
    expect(handler).toHaveBeenCalledExactlyOnceWith({ n: 1 })
    expect(e.listenerCount()).toBe(0)
  })

  it('tolerates a handler unsubscribing during emit', () => {
    const e = new TypedEmitter<Events>()
    const second = vi.fn()
    const off = e.on('pong', () => off())
    e.on('pong', second)
    e.emit('pong', 'x')
    expect(second).toHaveBeenCalledOnce()
    expect(e.listenerCount('pong')).toBe(1)
  })

  it('removes all listeners', () => {
    const e = new TypedEmitter<Events>()
    e.on('ping', vi.fn())
    e.on('pong', vi.fn())
    e.removeAllListeners()
    expect(e.listenerCount()).toBe(0)
  })
})
