import { useEffect } from 'react'
import { useMediaQuery } from '@/shared/hooks/use-media-query'
import { useUiStore } from '@/store'

export type ResolvedTheme = 'light' | 'dark'

/** The theme actually shown: the preference, or the OS setting for "system". */
export function useResolvedTheme(): ResolvedTheme {
  const theme = useUiStore((s) => s.theme)
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)')
  return theme === 'system' ? (prefersDark ? 'dark' : 'light') : theme
}

/**
 * Applies the theme to <html> (the `dark` class and `color-scheme`) and keeps
 * it in sync with the preference and OS changes. index.html applies the
 * stored theme before React loads, so there is no flash.
 */
export function useApplyTheme(): ResolvedTheme {
  const resolved = useResolvedTheme()
  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', resolved === 'dark')
    root.style.colorScheme = resolved
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', resolved === 'dark' ? '#18181b' : '#ffffff')
  }, [resolved])
  return resolved
}
