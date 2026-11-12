import type { MessageId } from '@/types/common.types'

/** Scrolls to a message in the open chat and flashes it. */
export function jumpToMessage(id: MessageId) {
  const el = document.querySelector<HTMLElement>(`[data-message-id="${CSS.escape(id)}"]`)
  if (!el) return
  el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  el.classList.remove('animate-highlight')
  void el.offsetWidth // restart the animation
  el.classList.add('animate-highlight')
}
