import { useEffect, useRef } from 'react'

export interface Hotkey {
  /** `KeyboardEvent.key`, compared case-insensitively (e.g. "k", "ArrowUp", "?", "Escape"). */
  key: string
  /** Ctrl on Windows/Linux, ⌘ on macOS. */
  mod?: boolean
  alt?: boolean
  /** Leave undefined to ignore Shift (needed for keys like "?"). */
  shift?: boolean
  /** Fire even while typing in an input, textarea or editable element. */
  allowInInputs?: boolean
  handler: (event: KeyboardEvent) => void
}

export const isTypingTarget = (target: EventTarget | null) => {
  const el = target as HTMLElement | null
  if (!el) return false
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)
}

export function matchesHotkey(e: KeyboardEvent, hotkey: Hotkey) {
  if (e.key.toLowerCase() !== hotkey.key.toLowerCase()) return false
  if (!!hotkey.mod !== (e.metaKey || e.ctrlKey)) return false
  if (!!hotkey.alt !== e.altKey) return false
  if (hotkey.shift !== undefined && hotkey.shift !== e.shiftKey) return false
  if (!hotkey.allowInInputs && isTypingTarget(e.target)) return false
  return true
}

/**
 * Global keyboard shortcuts on `window`. The listener is attached once and
 * removed on unmount; the latest bindings are read through a ref.
 * Events already handled by a component (`defaultPrevented`) are skipped.
 */
export function useHotkeys(hotkeys: Hotkey[], enabled = true) {
  const ref = useRef(hotkeys)
  ref.current = hotkeys

  useEffect(() => {
    if (!enabled) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing) return
      const hit = ref.current.find((h) => matchesHotkey(e, h))
      if (!hit) return
      e.preventDefault()
      hit.handler(e)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [enabled])
}
