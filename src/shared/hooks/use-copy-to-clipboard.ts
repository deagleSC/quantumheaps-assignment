import { useCallback } from 'react'
import { notify } from '@/shared/lib/notify'

/** Writes text to the clipboard, falling back to execCommand for older browsers. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Permission denied or insecure context: try the fallback.
  }
  try {
    const el = document.createElement('textarea')
    el.value = text
    el.setAttribute('readonly', '')
    el.style.position = 'fixed'
    el.style.opacity = '0'
    document.body.appendChild(el)
    el.select()
    const ok = document.execCommand?.('copy') ?? false
    el.remove()
    return ok
  } catch {
    return false
  }
}

/** Copy with a toast confirming success or failure. */
export function useCopyToClipboard() {
  return useCallback(async (text: string) => {
    const ok = await copyText(text)
    if (ok) notify.success('Copied to clipboard')
    else notify.error("Couldn't copy to the clipboard")
    return ok
  }, [])
}
