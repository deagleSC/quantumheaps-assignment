import type { MessageId } from '@/types/common.types'
import { getMessageScroller } from './message-scroller'

const findRow = (id: MessageId) =>
  document.querySelector<HTMLElement>(`[data-message-id="${CSS.escape(id)}"]`)

function flash(el: HTMLElement) {
  el.classList.remove('animate-highlight')
  void el.offsetWidth // restart the animation
  el.classList.add('animate-highlight')
}

/**
 * Scrolls to a message in the open chat and flashes it. Works for rows the
 * virtualised list hasn't rendered yet: it scrolls by index first, then
 * flashes the row once it mounts.
 */
export function jumpToMessage(id: MessageId): boolean {
  const el = findRow(id)
  if (el) {
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    flash(el)
    return true
  }
  const scroller = getMessageScroller()
  if (!scroller?.(id)) return false
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const mounted = findRow(id)
      if (mounted) flash(mounted)
    }),
  )
  return true
}
