import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'
import { messageActions } from '@/store'
import type { AsyncStatus, ConversationId } from '@/types/common.types'

/** Start loading older messages when the user is this close to the top. */
export const LOAD_OLDER_THRESHOLD_PX = 300

export interface UseLoadOlderOptions {
  containerRef: RefObject<HTMLDivElement | null>
  conversationId: ConversationId
  ready: boolean
  hasMore: boolean
  olderStatus: AsyncStatus
  /** ID of the oldest loaded message: a change means a page was prepended. */
  firstMessageId: string | undefined
}

/**
 * Infinite scroll upwards: loads the previous page near the top, and keeps
 * the viewport anchored on the same messages when the page is prepended.
 */
export function useLoadOlder({
  containerRef,
  conversationId,
  ready,
  hasMore,
  olderStatus,
  firstMessageId,
}: UseLoadOlderOptions) {
  const snapshot = useRef<{ height: number; top: number; firstId: string | undefined } | null>(null)
  const canLoad = useRef(false)
  canLoad.current = ready && hasMore && olderStatus !== 'loading' && olderStatus !== 'error'

  useEffect(() => {
    const el = containerRef.current
    if (!el || !ready) return
    const onScroll = () => {
      if (canLoad.current && el.scrollTop < LOAD_OLDER_THRESHOLD_PX) {
        void messageActions.loadOlder(conversationId)
      }
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [containerRef, conversationId, ready])

  // Runs after every commit: if older messages were prepended since the last
  // commit, shift the scroll position by the height they added.
  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const prev = snapshot.current
    if (prev && prev.firstId && firstMessageId !== prev.firstId) {
      const added = el.scrollHeight - prev.height
      if (added > 0) el.scrollTop = prev.top + added
    }
    snapshot.current = { height: el.scrollHeight, top: el.scrollTop, firstId: firstMessageId }
  })
}
