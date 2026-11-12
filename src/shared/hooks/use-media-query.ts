import { useCallback, useSyncExternalStore } from 'react'

/** Tracks a CSS media query; re-renders when it starts or stops matching. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    [query],
  )
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  )
}

/** Tailwind's `lg` breakpoint: room for a third (info) column. */
export const DESKTOP_QUERY = '(min-width: 1024px)'
