import { useCallback, useEffect, useRef } from 'react'

export const LONG_PRESS_MS = 450
/** Finger movement (px) that cancels a long press, so scrolling doesn't trigger it. */
const MOVE_TOLERANCE = 10

/**
 * Touch long-press handlers (mobile "tap and hold" to open a message menu).
 * Mouse users get the same menu via hover and right-click instead.
 */
export function useLongPress(onLongPress: () => void, ms = LONG_PRESS_MS) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const start = useRef<{ x: number; y: number } | null>(null)

  const cancel = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    start.current = null
  }, [])

  useEffect(() => cancel, [cancel])

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0]
      if (!touch) return
      start.current = { x: touch.clientX, y: touch.clientY }
      timer.current = setTimeout(() => {
        timer.current = null
        onLongPress()
      }, ms)
    },
    [ms, onLongPress],
  )

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0]
      if (!touch || !start.current) return
      const moved = Math.hypot(touch.clientX - start.current.x, touch.clientY - start.current.y)
      if (moved > MOVE_TOLERANCE) cancel()
    },
    [cancel],
  )

  return { onTouchStart, onTouchMove, onTouchEnd: cancel, onTouchCancel: cancel }
}
