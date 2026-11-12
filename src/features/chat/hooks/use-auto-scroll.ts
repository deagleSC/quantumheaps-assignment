import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

/** Within this many px of the bottom counts as "at the bottom". */
export const NEAR_BOTTOM_PX = 120

export const distanceFromBottom = (el: HTMLElement) =>
  el.scrollHeight - el.scrollTop - el.clientHeight

export interface UseAutoScrollOptions {
  /** History has loaded; run the initial scroll once this turns true. */
  ready: boolean
  /** ID of the newest message: a change means something was appended. */
  lastMessageId: string | undefined
  /** The newest message is the current user's (always follow own sends). */
  lastMessageIsOwn: boolean
  /** Changes when content at the bottom grows (e.g. typing indicator). */
  bottomContentKey?: unknown
}

/**
 * "Stick to bottom when appropriate":
 * - first load: jump to the unread divider if there is one, else the bottom
 * - new message: follow it if the user is near the bottom or sent it,
 *   otherwise count it for a "new messages" button
 */
export function useAutoScroll({
  ready,
  lastMessageId,
  lastMessageIsOwn,
  bottomContentKey,
}: UseAutoScrollOptions) {
  const containerRef = useRef<HTMLDivElement>(null)
  const atBottomRef = useRef(true)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [newCount, setNewCount] = useState(0)
  const initialised = useRef(false)
  const prevLastId = useRef<string | undefined>(undefined)

  const scrollToBottom = useCallback((smooth = false) => {
    const el = containerRef.current
    if (!el) return
    if (smooth && typeof el.scrollTo === 'function') {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    } else {
      el.scrollTop = el.scrollHeight
    }
    atBottomRef.current = true
    setIsAtBottom(true)
    setNewCount(0)
  }, [])

  // Track whether the user is near the bottom; listener removed on unmount.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onScroll = () => {
      const near = distanceFromBottom(el) <= NEAR_BOTTOM_PX
      atBottomRef.current = near
      setIsAtBottom(near)
      if (near) setNewCount(0)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [ready])

  // Initial position and newly appended messages. Layout effect: no flicker.
  useLayoutEffect(() => {
    const el = containerRef.current
    if (!ready || !el) return
    if (!initialised.current) {
      initialised.current = true
      prevLastId.current = lastMessageId
      const divider = el.querySelector<HTMLElement>('[data-unread-divider]')
      if (divider) {
        divider.scrollIntoView({ block: 'center' })
        atBottomRef.current = distanceFromBottom(el) <= NEAR_BOTTOM_PX
        setIsAtBottom(atBottomRef.current)
      } else {
        scrollToBottom()
      }
      return
    }
    if (lastMessageId === prevLastId.current) return
    prevLastId.current = lastMessageId
    if (lastMessageIsOwn || atBottomRef.current) scrollToBottom()
    else setNewCount((n) => n + 1)
  }, [ready, lastMessageId, lastMessageIsOwn, scrollToBottom])

  // If the viewport shrinks (composer grows, keyboard opens) stay pinned to the bottom.
  useEffect(() => {
    const el = containerRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      if (initialised.current && atBottomRef.current) el.scrollTop = el.scrollHeight
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [ready])

  // Keep the typing indicator (and similar) in view if already at the bottom.
  useLayoutEffect(() => {
    const el = containerRef.current
    if (el && initialised.current && atBottomRef.current) el.scrollTop = el.scrollHeight
  }, [bottomContentKey])

  return { containerRef, isAtBottom, newCount, scrollToBottom }
}
