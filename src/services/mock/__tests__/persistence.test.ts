import 'fake-indexeddb/auto'
import * as idb from 'idb-keyval'
import { appActions } from '@/store'
import { configureMockApi, flushPersistence, initMockApi, mockApi, resetMockApi } from '../mock-api'
import { MockDb } from '../mock-db'
import { clearPersisted, createPersister, loadSnapshot, SNAPSHOT_VERSION } from '../persistence'

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
