import { useEffect } from 'react'
import { getTotalUnread, useConversationStore } from '@/store'

export const APP_TITLE = 'Quantum Chat'

/** Tab title shows the total unread count: "(3) Quantum Chat". */
export function useUnreadDocumentTitle() {
  const unread = useConversationStore((s) => getTotalUnread(s.byId))
  useEffect(() => {
    document.title = unread > 0 ? `(${unread > 99 ? '99+' : unread}) ${APP_TITLE}` : APP_TITLE
  }, [unread])
}
