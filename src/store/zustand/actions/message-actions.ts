import { nanoid } from 'nanoid'
import { handleError } from '@/shared/lib/handle-error'
import { notify } from '@/shared/lib/notify'
import { toggleReaction } from '@/shared/lib/reactions'
import type { ConversationId, MessageId } from '@/types/common.types'
import type { Message, SendMessageInput } from '@/types/message.types'
import { messageServices } from '../services/message-services'
import { realtimeServices } from '../services/realtime-services'
import { useConversationStore } from '../stores/conversation-store'
import { useMessageStore } from '../stores/message-store'
import { useUiStore } from '../stores/ui-store'
import { useUserStore } from '../stores/user-store'

export type NewMessage = Omit<SendMessageInput, 'clientId'>

const TEMP_PREFIX = 'tmp-'
export const isTempId = (id: MessageId) => id.startsWith(TEMP_PREFIX)

function requireCurrentUserId() {
  const id = useUserStore.getState().currentUserId
  if (!id) throw new Error('Not signed in')
  return id
}

/** Sends an optimistic message to the server and reconciles the result. */
async function deliver(temp: Message): Promise<void> {
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
    realtimeServices.notifyOutgoing(saved)
  } catch (error) {
    messages.patchMessage(temp.id, { status: 'failed' })
    notify.error(handleError(error, 'Message failed to send'))
  }
}

export const messageActions = {
  /** First page of a conversation's history. */
  loadHistory: async (conversationId: ConversationId): Promise<void> => {
    const messages = useMessageStore.getState()
    messages.setHistoryStatus(conversationId, 'loading')
    try {
      const page = await messageServices.getPage(conversationId)
      messages.addPage(conversationId, page)
      messages.setHistoryStatus(conversationId, 'success')
    } catch (error) {
      messages.setHistoryStatus(conversationId, 'error', handleError(error))
    }
  },

  /** Next older page (infinite scroll). No-op while loading or when done. */
  loadOlder: async (conversationId: ConversationId): Promise<void> => {
    const messages = useMessageStore.getState()
    const timeline = messages.byConversation[conversationId]
    if (!timeline?.hasMore || timeline.olderStatus === 'loading') return
    const oldest = timeline.ids.find((id) => !isTempId(id))
    if (!oldest) return
    messages.setOlderStatus(conversationId, 'loading')
    try {
      const page = await messageServices.getPage(conversationId, oldest)
      messages.addPage(conversationId, page)
      messages.setOlderStatus(conversationId, 'success')
    } catch (error) {
      messages.setOlderStatus(conversationId, 'error')
      notify.error(handleError(error))
    }
  },

  /** Optimistic send: the message shows immediately with status `sending`. */
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
    await deliver(temp)
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
      if (message.status === 'failed') messages.removeMessage(id)
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
