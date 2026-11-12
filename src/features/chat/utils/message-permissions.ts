import { isTempId } from '@/store'
import type { Message } from '@/types/message.types'

/** What a message allows, given who sent it and its state. */
export function getMessagePermissions(message: Message, isOwn: boolean) {
  const sent = !isTempId(message.id)
  const live = !message.isDeleted
  return {
    canReply: live && sent,
    canReact: live && sent,
    canCopy: live && message.content.length > 0,
    canEdit: live && sent && isOwn,
    // Own sent messages, or discarding an own failed one.
    canDelete:
      live && isOwn && (sent || message.status === 'failed' || message.status === 'queued'),
  }
}
