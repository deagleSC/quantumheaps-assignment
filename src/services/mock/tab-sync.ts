import { nanoid } from 'nanoid'
import type { DbOp, MockDb } from './mock-db'

/** Messages exchanged between tabs of the same app. */
export type SyncMessage =
  | { kind: 'op'; from: string; op: DbOp }
  | { kind: 'reset'; from: string }
  | { kind: 'flush-request'; from: string; id: string }
  | { kind: 'flush-done'; from: string; id: string }

/** The subset of BroadcastChannel this uses (tests pass a fake). */
export interface ChannelLike {
  postMessage(message: SyncMessage): void
  addEventListener(type: 'message', listener: (event: MessageEvent<SyncMessage>) => void): void
  removeEventListener(type: 'message', listener: (event: MessageEvent<SyncMessage>) => void): void
  close(): void
}

export const SYNC_CHANNEL = 'quantum-chat-sync'

export interface TabSyncOptions {
  /** Another tab changed a record (already applied to the attached database). */
  onRemoteOp: (op: DbOp, info: { isNew: boolean }) => void
  /** Another tab reset the demo data. */
  onReset: () => void
  /** Another tab is about to load saved data: save now if we're the saving tab. Return whether we did. */
  onFlushRequest: () => Promise<boolean>
  channel?: ChannelLike | null
}

export interface TabSync {
  /** Start replicating this database (ops received before this are buffered, then applied). */
  attach: (db: MockDb) => void
  /** Ask the saving tab to save, so a fresh load sees everything. Resolves on reply or timeout. */
  requestFlush: (timeoutMs?: number) => Promise<void>
  broadcastReset: () => void
  dispose: () => void
}

const noop: TabSync = {
  attach: () => {},
  requestFlush: () => Promise.resolve(),
  broadcastReset: () => {},
  dispose: () => {},
}

/**
 * Keeps every open tab's in-memory database in step, live. Each tab's own
 * writes are broadcast as record-level ops; other tabs apply them (idempotent
 * upserts) and surface them to the UI as realtime events.
 */
export function createTabSync(options: TabSyncOptions): TabSync {
  const channel =
    options.channel !== undefined
      ? options.channel
      : typeof BroadcastChannel !== 'undefined'
        ? (new BroadcastChannel(SYNC_CHANNEL) as ChannelLike)
        : null
  if (!channel) return noop

  const tabId = nanoid(8)
  let db: MockDb | null = null
  let offOps: () => void = () => {}
  const buffered: DbOp[] = []
  const pendingFlushes = new Map<string, () => void>()

  const apply = (op: DbOp) => {
    if (!db) {
      buffered.push(op)
      return
    }
    options.onRemoteOp(op, db.applyRemote(op))
  }

  const onMessage = (event: MessageEvent<SyncMessage>) => {
    const message = event.data
    if (!message || message.from === tabId) return
    switch (message.kind) {
      case 'op':
        apply(message.op)
        break
      case 'reset':
        options.onReset()
        break
      case 'flush-request':
        void options.onFlushRequest().then((flushed) => {
          if (flushed) channel.postMessage({ kind: 'flush-done', from: tabId, id: message.id })
        })
        break
      case 'flush-done':
        pendingFlushes.get(message.id)?.()
        break
    }
  }
  channel.addEventListener('message', onMessage)

  return {
    attach: (next) => {
      offOps()
      db = next
      offOps = next.onOp((op) => channel.postMessage({ kind: 'op', from: tabId, op }))
      buffered.splice(0).forEach(apply)
    },
    requestFlush: (timeoutMs = 500) =>
      new Promise<void>((resolve) => {
        const id = nanoid(8)
        const done = () => {
          clearTimeout(timer)
          pendingFlushes.delete(id)
          resolve()
        }
        const timer = setTimeout(done, timeoutMs) // no saving tab open: nothing to wait for
        pendingFlushes.set(id, done)
        channel.postMessage({ kind: 'flush-request', from: tabId, id })
      }),
    broadcastReset: () => channel.postMessage({ kind: 'reset', from: tabId }),
    dispose: () => {
      offOps()
      channel.removeEventListener('message', onMessage)
      channel.close()
    },
  }
}
