import type { MessageId } from '@/types/common.types'

/**
 * Scrolls the open message list so a message is rendered and centred.
 * Returns false if the message isn't in the loaded history.
 * The (virtualised) list registers itself here, because a virtualised row
 * may not be in the DOM yet, so a plain querySelector can't find it.
 */
export type MessageScroller = (id: MessageId) => boolean

let current: MessageScroller | null = null

export function registerMessageScroller(scroller: MessageScroller): () => void {
  current = scroller
  return () => {
    if (current === scroller) current = null
  }
}

export const getMessageScroller = () => current
