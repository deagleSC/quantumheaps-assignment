import 'fake-indexeddb/auto'
import { MockDb, type DbOp } from '../mock-db'
import { clearPersisted, createPersister, loadSnapshot, type WriterLock } from '../persistence'
import { RealtimeSimulator } from '../realtime-simulator'
import { createTabSync, type ChannelLike, type SyncMessage } from '../tab-sync'

// Seed history ends an hour ago, so writes made "now" are the newest.
const NOW = Date.now() - 60 * 60_000
const settle = () => new Promise((r) => setTimeout(r, 0))

/** In-memory BroadcastChannel stand-in: delivers to every *other* channel, asynchronously. */
function bus() {
  const channels = new Set<FakeChannel>()
  class FakeChannel implements ChannelLike {
    listeners = new Set<(e: MessageEvent<SyncMessage>) => void>()
    constructor() {
      channels.add(this)
    }
    postMessage(data: SyncMessage) {
      const copy = structuredClone(data)
      for (const ch of channels) {
        if (ch !== this)
          queueMicrotask(() =>
            ch.listeners.forEach((l) => l({ data: copy } as MessageEvent<SyncMessage>)),
          )
      }
    }
    addEventListener(_: 'message', l: (e: MessageEvent<SyncMessage>) => void) {
      this.listeners.add(l)
    }
    removeEventListener(_: 'message', l: (e: MessageEvent<SyncMessage>) => void) {
      this.listeners.delete(l)
    }
    close() {
      channels.delete(this)
    }
  }
  return () => new FakeChannel()
}

function tab(
  channel: ChannelLike,
  db: MockDb,
  extra: Partial<Parameters<typeof createTabSync>[0]> = {},
) {
  const remote: { op: DbOp; isNew: boolean }[] = []
  const sync = createTabSync({
    channel,
    onRemoteOp: (op, info) => remote.push({ op, ...info }),
    onReset: vi.fn(),
    onFlushRequest: async () => false,
    ...extra,
  })
  sync.attach(db)
  return { db, sync, remote }
}

const fresh = () => new MockDb({ now: NOW }).toSnapshot()

describe('MockDb.applyRemote', () => {
  it('upserts messages in time order, without re-emitting them', () => {
    const db = new MockDb({ now: NOW })
    const emitted: DbOp[] = []
    db.onOp((op) => emitted.push(op))
    const list = db.getAllMessages('c-liam')
    const middle = {
      ...list[0]!,
      id: 'm-remote',
      createdAt: new Date(Date.parse(list[1]!.createdAt) + 1).toISOString(),
    }
    expect(db.applyRemote({ type: 'message', message: middle })).toEqual({ isNew: true })
    expect(
      db
        .getAllMessages('c-liam')
        .map((m) => m.id)
        .indexOf('m-remote'),
    ).toBe(2)
    expect(db.applyRemote({ type: 'message', message: { ...middle, content: 'edited' } })).toEqual({
      isNew: false,
    })
    expect(db.getMessage('m-remote').content).toBe('edited')
    expect(emitted).toEqual([])
  })

  it('keeps the newer latest message when a conversation update is older', () => {
    const db = new MockDb({ now: NOW })
    const local = db.getConversation('c-liam')
    db.applyRemote({
      type: 'conversation',
      conversation: {
        ...local,
        lastMessageId: 'old',
        updatedAt: '2000-01-01T00:00:00Z',
        unreadCount: 7,
      },
    })
    expect(db.getConversation('c-liam')).toMatchObject({
      lastMessageId: local.lastMessageId,
      unreadCount: 7,
    })
  })
})

describe('tab sync', () => {
  it('replicates writes to other tabs and reports whether a message was new', async () => {
    const channel = bus()
    const seed = fresh()
    const a = tab(channel(), new MockDb({ snapshot: structuredClone(seed) }))
    const b = tab(channel(), new MockDb({ snapshot: structuredClone(seed) }))
    const sent = a.db.insertOwnMessage({
      conversationId: 'c-liam',
      content: 'hello from A',
      clientId: 'tmp-1',
    })
    await settle()
    expect(b.db.getMessage(sent.id).content).toBe('hello from A')
    expect(b.db.getConversation('c-liam').lastMessageId).toBe(sent.id)
    expect(b.remote.map((r) => [r.op.type, r.isNew])).toEqual([
      ['message', true],
      ['conversation', false],
    ])

    const fromB = b.db.insertOwnMessage({ conversationId: 'c-liam', content: 'b', clientId: 't2' })
    b.db.editMessage(fromB.id, 'b edited')
    a.db.setPresence('u-priya', false)
    await settle()
    expect(a.db.getAllMessages('c-liam').at(-1)!.content).toBe('b edited')
    expect(b.db.getUser('u-priya').isOnline).toBe(false)
    expect(a.remote.some((r) => r.op.type === 'message' && !r.isNew)).toBe(true)
  })

  it('buffers ops that arrive before the database is attached', async () => {
    const channel = bus()
    const seed = fresh()
    const late = createTabSync({
      channel: channel(),
      onRemoteOp: vi.fn(),
      onReset: vi.fn(),
      onFlushRequest: async () => false,
    })
    const a = tab(channel(), new MockDb({ snapshot: structuredClone(seed) }))
    const sent = a.db.insertOwnMessage({
      conversationId: 'c-liam',
      content: 'early',
      clientId: 't',
    })
    await settle()
    const db = new MockDb({ snapshot: structuredClone(seed) })
    late.attach(db)
    expect(db.getMessage(sent.id).content).toBe('early')
  })

  it('only the saving tab answers a flush request; requests time out otherwise', async () => {
    const channel = bus()
    const flushed = vi.fn(async () => true)
    tab(channel(), new MockDb({ now: NOW }), { onFlushRequest: flushed })
    const asker = tab(channel(), new MockDb({ now: NOW }))
    await asker.sync.requestFlush(1000)
    expect(flushed).toHaveBeenCalledOnce()

    const lonely = tab(bus()(), new MockDb({ now: NOW }))
    const t0 = Date.now()
    await lonely.sync.requestFlush(50)
    expect(Date.now() - t0).toBeGreaterThanOrEqual(45)
  })

  it('broadcasts a reset to other tabs', async () => {
    const channel = bus()
    const onReset = vi.fn()
    tab(channel(), new MockDb({ now: NOW }), { onReset })
    const a = tab(channel(), new MockDb({ now: NOW }))
    a.sync.broadcastReset()
    await settle()
    expect(onReset).toHaveBeenCalledOnce()
  })
})

describe('two tabs end to end (sync + single writer)', () => {
  it("saves the other tab's changes and keeps the saved data consistent", async () => {
    await clearPersisted()
    const channel = bus()
    let holder: string | null = null
    const lockFor =
      (name: string): WriterLock =>
      (onAcquired) => {
        if (!holder) {
          holder = name
          onAcquired()
        }
        return () => {}
      }
    const seed = fresh()
    const a = tab(channel(), new MockDb({ snapshot: structuredClone(seed) }))
    const b = tab(channel(), new MockDb({ snapshot: structuredClone(seed) }))
    const leader = createPersister(a.db, { lock: lockFor('a'), delayMs: 5 })
    const follower = createPersister(b.db, { lock: lockFor('b'), delayMs: 5 })

    // B (not saving) sends; A (saving) edits an older message in the same chat.
    const fromB = b.db.insertOwnMessage({
      conversationId: 'c-daniel',
      content: 'from B',
      clientId: 't',
    })
    const own = a.db.getAllMessages('c-daniel').find((m) => m.senderId === a.db.currentUserId)!
    a.db.editMessage(own.id, 'edited in A')
    await settle()
    await leader.flush()
    await follower.flush()

    const reloaded = new MockDb({ snapshot: (await loadSnapshot())! })
    expect(reloaded.repaired).toBe(false)
    expect(reloaded.getMessage(fromB.id).content).toBe('from B')
    expect(reloaded.getMessage(own.id).content).toBe('edited in A')
    expect(reloaded.getConversation('c-daniel').lastMessageId).toBe(fromB.id)
    leader.dispose()
    follower.dispose()
  })
})

describe('simulator in a non-leader tab', () => {
  it('generates no background activity', () => {
    vi.useFakeTimers()
    const db = new MockDb({ now: NOW })
    const sim = new RealtimeSimulator({
      getDb: () => db,
      isLeader: () => false,
      config: { incomingIntervalMs: { min: 100, max: 100 }, presenceIntervalMs: 100 },
    })
    const seen = vi.fn()
    sim.on('message:new', seen)
    sim.on('presence:change', seen)
    sim.start()
    vi.advanceTimersByTime(10_000)
    expect(seen).not.toHaveBeenCalled()
    expect(sim.pendingTimerCount).toBe(0)
    sim.dispose()
    vi.useRealTimers()
  })
})
