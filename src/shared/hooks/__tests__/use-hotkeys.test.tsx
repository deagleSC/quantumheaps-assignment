import { fireEvent, render, renderHook } from '@testing-library/react'
import { matchesHotkey, useHotkeys } from '../use-hotkeys'

const key = (init: KeyboardEventInit, target: EventTarget = document.body) => {
  const e = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })
  Object.defineProperty(e, 'target', { value: target })
  return e
}

describe('matchesHotkey', () => {
  it('matches modifiers exactly and ignores Shift unless specified', () => {
    const h = { key: 'k', mod: true, handler: () => {} }
    expect(matchesHotkey(key({ key: 'k', ctrlKey: true }), h)).toBe(true)
    expect(matchesHotkey(key({ key: 'K', metaKey: true }), h)).toBe(true)
    expect(matchesHotkey(key({ key: 'k' }), h)).toBe(false)
    expect(matchesHotkey(key({ key: 'k', ctrlKey: true, altKey: true }), h)).toBe(false)
    expect(matchesHotkey(key({ key: '?', shiftKey: true }), { key: '?', handler: () => {} })).toBe(
      true,
    )
  })

  it('skips typing targets unless allowed', () => {
    const input = document.createElement('input')
    expect(matchesHotkey(key({ key: '?' }, input), { key: '?', handler: () => {} })).toBe(false)
    expect(
      matchesHotkey(key({ key: 'k', ctrlKey: true }, input), {
        key: 'k',
        mod: true,
        allowInInputs: true,
        handler: () => {},
      }),
    ).toBe(true)
  })
})

describe('useHotkeys', () => {
  it('fires, prevents default, skips handled events and cleans up', () => {
    const handler = vi.fn()
    const { unmount } = renderHook(() => useHotkeys([{ key: 'k', mod: true, handler }]))
    const ev = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, cancelable: true })
    window.dispatchEvent(ev)
    expect(handler).toHaveBeenCalledOnce()
    expect(ev.defaultPrevented).toBe(true)

    const handled = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, cancelable: true })
    handled.preventDefault()
    window.dispatchEvent(handled)
    expect(handler).toHaveBeenCalledOnce()

    unmount()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))
    expect(handler).toHaveBeenCalledOnce()
  })

  it('ignores keys typed into inputs', () => {
    const handler = vi.fn()
    renderHook(() => useHotkeys([{ key: '?', handler }]))
    const { getByRole } = render(<input aria-label="x" />)
    fireEvent.keyDown(getByRole('textbox'), { key: '?' })
    expect(handler).not.toHaveBeenCalled()
  })
})
