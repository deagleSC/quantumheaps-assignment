import { useEffect, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useDebouncedValue } from '@/shared/hooks/use-debounced-value'
import { useMessageStore, useUiStore } from '@/store'
import type { ConversationId, MessageId } from '@/types/common.types'
import { messageMatches } from '../utils/highlight'
import { jumpToMessage } from '../utils/jump-to-message'

/**
 * Matches for the in-chat search over the loaded history, newest match first
 * when the query changes; `prev` walks back in time, `next` forward.
 */
export function useMessageSearch(conversationId: ConversationId) {
  const query = useUiStore((s) => s.messageSearch?.query ?? '')
  const activeId = useUiStore((s) => s.messageSearch?.activeMatchId ?? null)
  const setActive = useUiStore((s) => s.setActiveSearchMatch)
  const debounced = useDebouncedValue(query, 200)

  const matches = useMessageStore(
    useShallow((s): MessageId[] => {
      const ids = s.byConversation[conversationId]?.ids ?? []
      return debounced.trim()
        ? ids.filter((id) => {
            const m = s.byId[id]
            return !!m && messageMatches(m, debounced)
          })
        : []
    }),
  )

  const index = useMemo(() => (activeId ? matches.indexOf(activeId) : -1), [matches, activeId])

  // New query: focus the newest match.
  useEffect(() => {
    const newest = matches[matches.length - 1]
    if (!activeId && newest) {
      setActive(newest)
      jumpToMessage(newest)
    }
  }, [matches, activeId, setActive])

  const go = (delta: number) => {
    if (matches.length === 0) return
    const from = index === -1 ? matches.length : index
    const nextIndex = (from + delta + matches.length) % matches.length
    const id = matches[nextIndex]!
    setActive(id)
    jumpToMessage(id)
  }

  return {
    query: debounced,
    matches,
    /** 1-based position for "3 of 12", or 0 when nothing is focused. */
    position: index + 1,
    prev: () => go(-1),
    next: () => go(1),
  }
}
