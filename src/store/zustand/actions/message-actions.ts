import { nanoid } from 'nanoid'
import { handleError } from '@/shared/lib/handle-error'
import { isOfflineError } from '@/shared/lib/network'
import { notify } from '@/shared/lib/notify'
import { toggleReaction } from '@/shared/lib/reactions'
import type { ConversationId, MessageId } from '@/types/common.types'
import type { Message, SendMessageInput } from '@/types/message.types'
import { MESSAGE_PAGE_SIZE, messageServices } from '../services/message-services'
import { realtimeServices } from '../services/realtime-services'
import { selectIsOnline, useConnectionStore } from '../stores/connection-store'
import { useConversationStore } from '../stores/conversation-store'
import { useMessageStore } from '../stores/message-store'
import { useOutboxStore } from '../stores/outbox-store'
import { useUiStore } from '../stores/ui-store'
import { useUserStore } from '../stores/user-store'

export type NewMessage = Omit<SendMessageInput, 'clientId'>

const TEMP_PREFIX = 'tmp-'
const LOAD_ALL_PAGE_SIZE = 2000
export const isTempId = (id: MessageId) => id.startsWith(TEMP_PREFIX)

function requireCurrentUserId() {
  const id = useUserStore.getState().currentUserId
  if (!id) throw new Error('Not signed in')
  return id
}

const isOnline = () => selectIsOnline(useConnectionStore.getState())

/** Puts a message in the offline outbox (persisted) and marks it queued. */
function queue(message: Message) {
  useMessageStore.getState().patchMessage(message.id, { status: 'queued' })
  useOutboxStore.getState().enqueue({ ...message, status: 'queued' })
}

type DeliveryResult = 'sent' | 'queued' | 'failed'

/**
 * Sends an optimistic message to the server and reconciles the result.
 * Losing the network mid-send queues it instead of failing it.
 */
async function deliver(temp: Message): Promise<DeliveryResult> {
  const messages = useMessageStore.getState()
  try {
    const saved = await messageServices.send({
      conversationId: temp.conversationId,
      content: temp.content,
      clientId: temp.id,
      replyToId: temp.replyToId,
      attachment: temp.attachment,
    })
    messages.replaceMessage(temp.id, saved)
    useConversationStore
      .getState()
      .touchConversation(saved.conversationId, saved.id, saved.createdAt)
    useOutboxStore.getState().dequeue(temp.id)
    realtimeServices.notifyOutgoing(saved)
    return 'sent'
  } catch (error) {
    if (isOfflineError(error) || !isOnline()) {
      queue(temp)
      return 'queued'
    }
    useOutboxStore.getState().dequeue(temp.id)
    messages.patchMessage(temp.id, { status: 'failed' })
    notify.error(handleError(error, 'Message failed to send'))
    return 'failed'
  }
}

/** Queued messages of a conversation, restored after its history loads. */
function mergeQueued(conversationId: ConversationId) {
  const messages = useMessageStore.getState()
  for (const m of useOutboxStore.getState().queue) {
    if (m.conversationId === conversationId) messages.upsertMessage(messages.byId[m.id] ?? m)
  }
}

let flushing: Promise<void> | null = null

export const messageActions = {
  /** First page of a conversation's history. */
  loadHistory: async (conversationId: ConversationId): Promise<void> => {
    const messages = useMessageStore.getState()
    messages.setHistoryStatus(conversationId, 'loading')
    try {
      const page = await messageServices.getPage(conversationId)
      messages.addPage(conversationId, page)
      mergeQueued(conversationId)
      messages.setHistoryStatus(conversationId, 'success')
    } catch (error) {
      messages.setHistoryStatus(conversationId, 'error', handleError(error))
    }
  },

  /** Next older page (infinite scroll). No-op while loading or when done. */
  loadOlder: async (conversationId: ConversationId, limit = MESSAGE_PAGE_SIZE): Promise<void> => {
    const messages = useMessageStore.getState()
    const timeline = messages.byConversation[conversationId]
    if (!timeline?.hasMore || timeline.olderStatus === 'loading') return
    const oldest = timeline.ids.find((id) => !isTempId(id))
    if (!oldest) return
    messages.setOlderStatus(conversationId, 'loading')
    try {
      const page = await messageServices.getPage(conversationId, oldest, limit)
      messages.addPage(conversationId, page)
      messages.setOlderStatus(conversationId, 'success')
    } catch (error) {
      messages.setOlderStatus(conversationId, 'error')
      notify.error(handleError(error))
    }
  },

  /** Pages through the whole history in large chunks (the "Load all" button). */
  loadAll: async (conversationId: ConversationId): Promise<void> => {
    for (let guard = 0; guard < 1000; guard++) {
      const timeline = useMessageStore.getState().byConversation[conversationId]
      if (!timeline?.hasMore || timeline.olderStatus === 'error') return
      await messageActions.loadOlder(conversationId, LOAD_ALL_PAGE_SIZE)
    }
  },

  /**
   * Sends everything in the offline outbox, oldest first, one at a time.
   * Stops (leaving the rest queued) if the network drops again.
   */
  flushOutbox: (): Promise<void> => {
    if (flushing) return flushing
    const run = async () => {
      for (const queued of [...useOutboxStore.getState().queue]) {
        if (!isOnline()) return
        const messages = useMessageStore.getState()
        if (!messages.byId[queued.id]) messages.upsertMessage(queued)
        messages.patchMessage(queued.id, { status: 'sending' })
        const result = await deliver({ ...queued, status: 'sending' })
        if (result === 'queued') return
      }
    }
    // Clear the in-flight marker in `.finally` (always asynchronous). Clearing
    // it inside `run` would happen *before* the assignment when the outbox is
    // empty, leaving a settled promise behind that blocks every later flush.
    const current: Promise<void> = run().finally(() => {
      if (flushing === current) flushing = null
    })
    flushing = current
    return current
  },

  /** On start-up: show queued messages again (sidebar + open chats), then try sending. */
  restoreOutbox: async (): Promise<void> => {
    const queue = useOutboxStore.getState().queue
    for (const m of queue) {
      useMessageStore.getState().upsertMessage(m)
      useConversationStore.getState().touchConversation(m.conversationId, m.id, m.createdAt)
    }
    if (queue.length > 0 && isOnline()) await messageActions.flushOutbox()
  },

  /** Optimistic send: the message shows immediately (queued when offline). */
  send: async (input: NewMessage): Promise<MessageId | null> => {
    const content = input.content.trim()
    if (!content && !input.attachment) return null
    const temp: Message = {
      id: `${TEMP_PREFIX}${nanoid(10)}`,
      conversationId: input.conversationId,
      senderId: requireCurrentUserId(),
      kind: 'text',
      content,
      createdAt: new Date().toISOString(),
      status: 'sending',
      reactions: [],
      replyToId: input.replyToId,
      attachment: input.attachment,
    }
    useMessageStore.getState().upsertMessage(temp)
    useConversationStore.getState().touchConversation(temp.conversationId, temp.id, temp.createdAt)
    useUiStore.getState().setReplyingTo(null)
    if (!isOnline()) queue(temp)
    else await deliver(temp)
    return temp.id
  },

  /** Re-sends a message that failed. */
  retry: async (tempId: MessageId): Promise<void> => {
    const message = useMessageStore.getState().byId[tempId]
    if (!message || message.status !== 'failed') return
    useMessageStore.getState().patchMessage(tempId, { status: 'sending' })
    await deliver({ ...message, status: 'sending' })
  },

  /** Optimistic edit with rollback on failure. */
  edit: async (id: MessageId, content: string): Promise<void> => {
    const messages = useMessageStore.getState()
    const message = messages.byId[id]
    const trimmed = content.trim()
    useUiStore.getState().setEditing(null)
    if (!message || message.isDeleted || isTempId(id) || !trimmed || trimmed === message.content) {
      return
    }
    const previous = { content: message.content, editedAt: message.editedAt }
    messages.patchMessage(id, { content: trimmed, editedAt: new Date().toISOString() })
    try {
      messages.upsertMessage(await messageServices.edit(id, trimmed))
    } catch (error) {
      messages.patchMessage(id, previous)
      notify.error(handleError(error))
    }
  },

  /** Soft delete with rollback. A failed, never-sent message is just discarded. */
  remove: async (id: MessageId): Promise<void> => {
    const messages = useMessageStore.getState()
    const message = messages.byId[id]
    if (!message || message.isDeleted) return
    const ui = useUiStore.getState()
    if (ui.replyingToId === id) ui.setReplyingTo(null)
    if (ui.editingId === id) ui.setEditing(null)
    if (isTempId(id)) {
      // Never reached the server: discard locally (and from the outbox).
      if (message.status === 'failed' || message.status === 'queued') {
        messages.removeMessage(id)
        useOutboxStore.getState().dequeue(id)
      }
      return
    }
    const previous = {
      content: message.content,
      reactions: message.reactions,
      attachment: message.attachment,
      isDeleted: message.isDeleted,
    }
    messages.patchMessage(id, {
      isDeleted: true,
      content: '',
      reactions: [],
      attachment: undefined,
    })
    try {
      messages.upsertMessage(await messageServices.remove(id))
    } catch (error) {
      messages.patchMessage(id, previous)
      notify.error(handleError(error))
    }
  },

  /** Optimistic reaction toggle with rollback. */
  toggleReaction: async (id: MessageId, emoji: string): Promise<void> => {
    const messages = useMessageStore.getState()
    const message = messages.byId[id]
    if (!message || message.isDeleted || isTempId(id)) return
    const previous = message.reactions
    messages.patchMessage(id, {
      reactions: toggleReaction(previous, emoji, requireCurrentUserId()),
    })
    try {
      const saved = await messageServices.toggleReaction(id, emoji)
      messages.patchMessage(id, { reactions: saved.reactions })
    } catch (error) {
      messages.patchMessage(id, { reactions: previous })
      notify.error(handleError(error))
    }
  },
}
