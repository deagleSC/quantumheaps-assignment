import { create } from 'zustand'
import { createJSONStorage, devtools, persist } from 'zustand/middleware'
import type { MessageId } from '@/types/common.types'
import type { Message } from '@/types/message.types'

export interface OutboxState {
  /** Messages written while offline, oldest first; sent in this order. */
  queue: Message[]
}

export interface OutboxStoreActions {
  enqueue: (message: Message) => void
  dequeue: (id: MessageId) => void
}

export type OutboxStore = OutboxState & OutboxStoreActions

export const initialOutboxState: OutboxState = { queue: [] }

/** The offline outbox. Persisted, so queued messages survive a reload. */
export const useOutboxStore = create<OutboxStore>()(
  devtools(
    persist(
      (set) => ({
        ...initialOutboxState,
        // Re-queuing (a send failed because the network dropped) keeps the
        // message's original place, so the outbox is always sent in order.
        enqueue: (message) =>
          set((s) =>
            s.queue.some((m) => m.id === message.id)
              ? { queue: s.queue.map((m) => (m.id === message.id ? message : m)) }
              : { queue: [...s.queue, message] },
          ),
        dequeue: (id) => set((s) => ({ queue: s.queue.filter((m) => m.id !== id) })),
      }),
      {
        name: 'quantum-chat-outbox',
        version: 1,
        storage: createJSONStorage(() => localStorage),
      },
    ),
    { name: 'outbox-store' },
  ),
)

// The outbox lives in localStorage, shared by every tab: pick up other tabs' changes.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === 'quantum-chat-outbox') void useOutboxStore.persist.rehydrate()
  })
}
