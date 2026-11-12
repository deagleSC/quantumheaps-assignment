import { clear, createStore, get, getMany, setMany, type UseStore } from 'idb-keyval'
import type { Conversation } from '@/types/conversation.types'
import type { Message } from '@/types/message.types'
import type { User } from '@/types/user.types'
import { type ChangeKey, type MockDb, type MockDbSnapshot, messagesKey } from './mock-db'

/** Bump when the stored shape changes; older data is then ignored (re-seeded). */
export const SNAPSHOT_VERSION = 1

interface Meta {
  version: number
  currentUserId: string
  savedAt: string
}

export const isPersistenceAvailable = () => typeof indexedDB !== 'undefined'

let store: UseStore | null = null
const getStore = () => (store ??= createStore('quantum-chat', 'mock-db'))

/** Reads the persisted database, or `null` if there is none (or it's outdated). */
export async function loadSnapshot(): Promise<MockDbSnapshot | null> {
  if (!isPersistenceAvailable()) return null
  const meta = await get<Meta>('meta', getStore())
  if (!meta || meta.version !== SNAPSHOT_VERSION) return null
  const [users, conversations] = (await getMany(['users', 'conversations'], getStore())) as [
    User[] | undefined,
    Conversation[] | undefined,
  ]
  if (!users || !conversations) return null
  const lists = (await getMany(
    conversations.map((c) => messagesKey(c.id)),
    getStore(),
  )) as (Message[] | undefined)[]
  return {
    currentUserId: meta.currentUserId,
    users,
    conversations,
    messages: Object.fromEntries(conversations.map((c, i) => [c.id, lists[i] ?? []])),
  }
}

export async function clearPersisted(): Promise<void> {
  if (isPersistenceAvailable()) await clear(getStore())
}

export interface Persister {
  /** Writes pending changes now (also used on page hide). */
  flush: () => Promise<void>
  dispose: () => void
}

/**
 * Saves database changes to IndexedDB, batched: each write marks the keys it
 * touched, and one save per `delayMs` rewrites only those keys. A presence
 * change therefore rewrites the user list, not the 10,000-message chat.
 */
export function createPersister(
  db: MockDb,
  { delayMs = 1000, saveAllNow = false }: { delayMs?: number; saveAllNow?: boolean } = {},
): Persister {
  const dirty = new Set<ChangeKey>()
  let timer: ReturnType<typeof setTimeout> | null = null
  let saving: Promise<void> = Promise.resolve()

  const valueFor = (key: ChangeKey): unknown => {
    if (key === 'users') return db.getUsers()
    if (key === 'conversations') return db.getConversations()
    return db.getAllMessages(key.slice('messages:'.length))
  }

  const flush = () => {
    if (timer) clearTimeout(timer)
    timer = null
    if (dirty.size === 0) return saving
    const keys = [...dirty]
    dirty.clear()
    const meta: Meta = {
      version: SNAPSHOT_VERSION,
      currentUserId: db.currentUserId,
      savedAt: new Date().toISOString(),
    }
    const entries: [IDBValidKey, unknown][] = [
      ...keys.map((k): [IDBValidKey, unknown] => [k, valueFor(k)]),
      ['meta', meta],
    ]
    // Chain saves so they land in order.
    saving = saving
      .then(() => setMany(entries, getStore()))
      .catch((error) => console.warn('[mock-db] failed to persist', error))
    return saving
  }

  const unsubscribe = db.onChange((keys) => {
    keys.forEach((k) => dirty.add(k))
    if (!timer) timer = setTimeout(() => void flush(), delayMs)
  })

  const onPageHide = () => void flush()
  if (typeof window !== 'undefined') window.addEventListener('pagehide', onPageHide)

  if (saveAllNow) {
    db.allKeys().forEach((k) => dirty.add(k))
    void flush()
  }

  return {
    flush,
    dispose: () => {
      unsubscribe()
      if (timer) clearTimeout(timer)
      if (typeof window !== 'undefined') window.removeEventListener('pagehide', onPageHide)
    },
  }
}
