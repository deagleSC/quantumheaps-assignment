import { renderHook } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useUiStore } from '@/store'
import { act, render, screen } from '@/test/render'
import { resetStores } from '@/test/reset-stores'
import { ThemeToggle } from '../components/theme-toggle'
import { useApplyTheme } from '../hooks/use-theme'

const realMatchMedia = window.matchMedia
function prefersDark(dark: boolean) {
  window.matchMedia = (query: string) => ({
    ...realMatchMedia(query),
    matches: query.includes('prefers-color-scheme: dark') ? dark : false,
  })
}

beforeEach(() => {
  resetStores()
  document.documentElement.className = ''
})
afterEach(() => {
  window.matchMedia = realMatchMedia
})

describe('useApplyTheme', () => {
  it('follows the OS when set to system', () => {
    prefersDark(true)
    const { result } = renderHook(() => useApplyTheme())
    expect(result.current).toBe('dark')
    expect(document.documentElement).toHaveClass('dark')
    expect(document.documentElement.style.colorScheme).toBe('dark')
  })

  it('applies an explicit preference over the OS', () => {
    prefersDark(true)
    const { result } = renderHook(() => useApplyTheme())
    act(() => useUiStore.getState().setTheme('light'))
    expect(result.current).toBe('light')
    expect(document.documentElement).not.toHaveClass('dark')
  })
})

it('ThemeToggle switches and persists the preference', async () => {
  prefersDark(false)
  const ui = userEvent.setup()
  render(<ThemeToggle />)
  await ui.click(screen.getByRole('button', { name: 'Theme: system' }))
  await ui.click(screen.getByRole('menuitemradio', { name: 'Dark' }))
  expect(useUiStore.getState().theme).toBe('dark')
  expect(JSON.parse(localStorage.getItem('quantum-chat-ui')!).state.theme).toBe('dark')
  expect(screen.getByRole('button', { name: 'Theme: dark' })).toBeInTheDocument()
})
