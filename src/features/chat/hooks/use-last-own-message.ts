import { useCallback } from 'react'
import { isTempId, useMessageStore, useUserStore } from '@/store'
import type { ConversationId, MessageId } from '@/types/common.types'

/** Returns a getter for the newest editable own message (for "↑ to edit"). */
export function useLastOwnMessageGetter(conversationId: ConversationId) {
  return useCallback((): MessageId | null => {
    const { byConversation, byId } = useMessageStore.getState()
    const me = useUserStore.getState().currentUserId
    const ids = byConversation[conversationId]?.ids ?? []
    for (let i = ids.length - 1; i >= 0; i--) {
      const m = byId[ids[i]!]
      if (m && m.senderId === me && m.kind === 'text' && !m.isDeleted && !isTempId(m.id))
        return m.id
    }
    return null
  }, [conversationId])
}
