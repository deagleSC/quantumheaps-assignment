import 'fake-indexeddb/auto'
import * as idb from 'idb-keyval'
import { appActions } from '@/store'
import { configureMockApi, flushPersistence, initMockApi, mockApi, resetMockApi } from '../mock-api'
import { MockDb } from '../mock-db'
import {
  clearPersisted,
  createPersister,
  loadSnapshot,
  SNAPSHOT_VERSION,
  type WriterLock,
} from '../persistence'

vi.mock('idb-keyval', async (importOriginal) => {
  const actual = await importOriginal<typeof import('idb-keyval')>()
  return { ...actual, setMany: vi.fn(actual.setMany) }
})
vi.mock('@/shared/lib/notify')

const NOW = Date.parse('2026-11-12T12:00:00Z')
const fast = () =>
  configureMockApi({ latency: { min: 0, max: 0 }, readFailureRate: 0, writeFailureRate: 0 })
/** What a page reload does: a fresh API instance reading from IndexedDB. */
const reload = async () => {
  resetMockApi()
  fast()
  await initMockApi({ persist: true })
}

afterEach(() => {
  vi.useRealTimers()
})

beforeEach(async () => {
  resetMockApi()
  await clearPersisted()
  vi.mocked(idb.setMany).mockClear()
})

describe('MockDb snapshots', () => {
  it('round-trips everything through a snapshot', () => {
    const db = new MockDb({ now: NOW })
    const sent = db.insertOwnMessage({
      conversationId: 'c-liam',
      content: 'persist me',
      clientId: 't',
    })
    db.setPresence('u-priya', false)
    const restored = new MockDb({ snapshot: structuredClone(db.toSnapshot()) })
    expect(restored.getConversations()).toEqual(db.getConversations())
    expect(restored.getUser('u-priya').isOnline).toBe(false)
    expect(restored.getMessage(sent.id).content).toBe('persist me')
  })

  it('reports which storage keys each write touched', () => {
    const db = new MockDb({ now: NOW })
    const seen: string[][] = []
    db.onChange((keys) => seen.push(keys))
    db.setPresence('u-priya', false)
    db.insertOwnMessage({ conversationId: 'c-liam', content: 'hi', clientId: 't' })
    db.markConversationRead('c-sofia')
    expect(seen).toEqual([['users'], ['messages:c-liam', 'conversations'], ['conversations']])
  })
})

describe('persister', () => {
  it('rewrites only the keys that changed, batched', async () => {
    // Real timers: fake-indexeddb schedules its work on them.
    const db = new MockDb({ now: NOW })
    const persister = createPersister(db, { delayMs: 30 })
    await persister.flush() // the writer's initial full save
    vi.mocked(idb.setMany).mockClear()
    db.setPresence('u-priya', false)
    db.setPresence('u-daniel', true)
    expect(idb.setMany).not.toHaveBeenCalled() // batched, not written yet
    await new Promise((r) => setTimeout(r, 60))
    await persister.flush()
    expect(idb.setMany).toHaveBeenCalledOnce()
    const keys = vi.mocked(idb.setMany).mock.calls.flatMap(([entries]) => entries.map(([k]) => k))
    expect(keys.sort()).toEqual(['meta', 'users'])
    persister.dispose()
  })

  it('ignores data saved by an older version', async () => {
    const db = new MockDb({ now: NOW })
    const persister = createPersister(db, { saveAllNow: true })
    await persister.flush()
    expect(await loadSnapshot()).not.toBeNull()
    await idb.set(
      'meta',
      { version: SNAPSHOT_VERSION - 1 },
      idb.createStore('quantum-chat', 'mock-db'),
    )
    expect(await loadSnapshot()).toBeNull()
    persister.dispose()
  })
})

describe('mock API with persistence', () => {
  it('keeps sent messages, edits and reactions across a reload', async () => {
    await reload()
    const sent = await mockApi.sendMessage({
      conversationId: 'c-liam',
      content: 'Still here?',
      clientId: 't1',
    })
    await mockApi.editMessage(sent.id, 'Still here after reload?')
    await mockApi.toggleReaction(sent.id, '🙏')
    await mockApi.addMembers('g-design', ['u-omar'])
    await flushPersistence()

    await reload()
    const { messages } = await mockApi.getMessages('c-liam', { limit: 1 })
    expect(messages[0]).toMatchObject({
      id: sent.id,
      content: 'Still here after reload?',
      reactions: [{ emoji: '🙏' }],
    })
    const groups = await mockApi.getConversations()
    const design = groups.find((c) => c.id === 'g-design')
    expect(design?.type === 'group' && design.memberIds).toContain('u-omar')
  })

  it('reset demo data wipes saved changes', async () => {
    await reload()
    const sent = await mockApi.sendMessage({
      conversationId: 'c-liam',
      content: 'temporary',
      clientId: 't1',
    })
    await flushPersistence()
    const reloadPage = vi.fn()
    await appActions.resetDemoData(reloadPage)
    expect(reloadPage).toHaveBeenCalledOnce()

    await reload()
    const { messages } = await mockApi.getMessages('c-liam')
    expect(messages.some((m) => m.id === sent.id)).toBe(false)
  })
})

/** A fake Web Lock shared by several "tabs": one holder at a time, FIFO. */
function fakeLock() {
  let held = false
  const waiting: (() => void)[] = []
  const grant = (cb: () => void) => {
    held = true
    cb()
  }
  const lock: WriterLock = (onAcquired) => {
    let mine = false
    const take = () => {
      mine = true
      onAcquired()
    }
    if (!held) grant(take)
    else waiting.push(() => grant(take))
    return () => {
      if (!mine) return
      held = false
      waiting.shift()?.()
    }
  }
  return lock
}

describe('multiple tabs', () => {
  it('only the lock holder saves; the next tab saves everything when it takes over', async () => {
    const lock = fakeLock()
    const seed = new MockDb({ now: NOW }).toSnapshot()
    const tabA = new MockDb({ snapshot: structuredClone(seed) })
    const tabB = new MockDb({ snapshot: structuredClone(seed) })
    const a = createPersister(tabA, { lock, delayMs: 10 })
    const b = createPersister(tabB, { lock, delayMs: 10 })
    await a.flush()
    vi.mocked(idb.setMany).mockClear()

    tabB.insertOwnMessage({ conversationId: 'c-liam', content: 'from B', clientId: 't' })
    await b.flush()
    expect(idb.setMany).not.toHaveBeenCalled() // B is not the writer

    a.dispose() // tab A closes: B takes over and writes its whole state
    await b.flush()
    const keys = vi.mocked(idb.setMany).mock.calls.flatMap(([entries]) => entries.map(([k]) => k))
    expect(keys).toEqual(
      expect.arrayContaining([
        'users',
        'conversations',
        'messages:c-liam',
        'messages:g-loadtest',
        'meta',
      ]),
    )
    const saved = await loadSnapshot()
    expect(saved!.messages['c-liam']!.map((m) => m.content)).toContain('from B')
    b.dispose()
  })

  it('the reported two-tab sequence now leaves consistent data', async () => {
    const lock = fakeLock()
    const seed = new MockDb({ now: NOW }).toSnapshot()
    const tabA = new MockDb({ snapshot: structuredClone(seed) })
    const tabB = new MockDb({ snapshot: structuredClone(seed) })
    const a = createPersister(tabA, { lock, delayMs: 10 })
    const b = createPersister(tabB, { lock, delayMs: 10 })
    // B sends (B isn't the writer); A, which never saw it, edits an older message.
    tabB.insertOwnMessage({ conversationId: 'c-daniel', content: 'from B', clientId: 't' })
    const own = tabA.getAllMessages('c-daniel').find((m) => m.senderId === tabA.currentUserId)!
    tabA.editMessage(own.id, 'edited in A')
    await a.flush()
    await b.flush()
    const snapshot = (await loadSnapshot())!
    const reloaded = new MockDb({ snapshot })
    expect(reloaded.repaired).toBe(false)
    expect(() => reloaded.getLastMessages()).not.toThrow()
    a.dispose()
    b.dispose()
  })
})

describe('self-healing', () => {
  it('repairs a conversation whose latest message is missing from saved data', () => {
    const snapshot = new MockDb({ now: NOW }).toSnapshot()
    const daniel = snapshot.conversations.find((c) => c.id === 'c-daniel')!
    daniel.lastMessageId = 'm-gone'
    const db = new MockDb({ snapshot })
    expect(db.repaired).toBe(true)
    const last = snapshot.messages['c-daniel']!.at(-1)!
    expect(db.getConversation('c-daniel')).toMatchObject({
      lastMessageId: last.id,
      updatedAt: last.createdAt,
    })
    expect(db.getLastMessages().some((m) => m.id === 'm-gone')).toBe(false)
  })

  it('the API loads corrupted saved data and re-saves it repaired', async () => {
    const db = new MockDb({ now: NOW })
    const persister = createPersister(db, { saveAllNow: true })
    await persister.flush()
    persister.dispose()
    // Corrupt the saved conversation list the way two tabs used to.
    const store = idb.createStore('quantum-chat', 'mock-db')
    const conversations = (await idb.get('conversations', store)) as {
      id: string
      lastMessageId?: string
    }[]
    conversations.find((c) => c.id === 'c-daniel')!.lastMessageId = 'm-gone'
    await idb.set('conversations', conversations, store)

    await reload()
    await expect(mockApi.getInbox()).resolves.toMatchObject({ conversations: expect.any(Array) })
    await flushPersistence()
    const saved = (await idb.get('conversations', store)) as {
      id: string
      lastMessageId?: string
    }[]
    expect(saved.find((c) => c.id === 'c-daniel')!.lastMessageId).not.toBe('m-gone')
  })
})
