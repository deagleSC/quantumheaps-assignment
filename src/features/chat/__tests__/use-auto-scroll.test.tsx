import { act, render } from '@testing-library/react'
import { useAutoScroll } from '../hooks/use-auto-scroll'

/** jsdom has no layout, so the scroll box metrics are faked per element. */
function fakeScrollBox(
  el: HTMLElement,
  { scrollHeight = 2000, clientHeight = 500, scrollTop = 1500 } = {},
) {
  let top = scrollTop
  Object.defineProperty(el, 'scrollHeight', { configurable: true, get: () => scrollHeight })
  Object.defineProperty(el, 'clientHeight', { configurable: true, get: () => clientHeight })
  Object.defineProperty(el, 'scrollTop', {
    configurable: true,
    get: () => top,
    set: (v: number) => (top = Math.min(v, scrollHeight - clientHeight)),
  })
}

let api: ReturnType<typeof useAutoScroll>
function Harness(props: Parameters<typeof useAutoScroll>[0] & { withDivider?: boolean }) {
  api = useAutoScroll(props)
  return (
    <div
      ref={(el) => {
        if (el && !el.dataset.faked) {
          el.dataset.faked = '1'
          fakeScrollBox(el, { scrollTop: 0 })
        }
        api.containerRef.current = el as HTMLDivElement
      }}
    >
      {props.withDivider && <div data-unread-divider />}
    </div>
  )
}

const base = { ready: true, lastMessageId: 'm1', lastMessageIsOwn: false }

it('jumps to the bottom on first load', () => {
  render(<Harness {...base} />)
  expect(api.containerRef.current!.scrollTop).toBe(1500)
})

it('scrolls the unread divider into view instead, when present', () => {
  const spy = vi.spyOn(Element.prototype, 'scrollIntoView')
  render(<Harness {...base} withDivider />)
  expect(spy).toHaveBeenCalledWith({ block: 'center' })
  spy.mockRestore()
})

it('follows new messages while at the bottom', () => {
  const { rerender } = render(<Harness {...base} />)
  rerender(<Harness {...base} lastMessageId="m2" />)
  expect(api.newCount).toBe(0)
  expect(api.containerRef.current!.scrollTop).toBe(1500)
})

it('counts new messages when scrolled up, and resets via scrollToBottom', () => {
  const { rerender } = render(<Harness {...base} />)
  const el = api.containerRef.current!
  act(() => {
    el.scrollTop = 200
    el.dispatchEvent(new Event('scroll'))
  })
  expect(api.isAtBottom).toBe(false)
  rerender(<Harness {...base} lastMessageId="m2" />)
  rerender(<Harness {...base} lastMessageId="m3" />)
  expect(api.newCount).toBe(2)
  expect(el.scrollTop).toBe(200)
  act(() => api.scrollToBottom())
  expect(api.newCount).toBe(0)
  expect(el.scrollTop).toBe(1500)
})

it('always follows the user’s own new message', () => {
  const { rerender } = render(<Harness {...base} />)
  const el = api.containerRef.current!
  act(() => {
    el.scrollTop = 0
    el.dispatchEvent(new Event('scroll'))
  })
  rerender(<Harness {...base} lastMessageId="mine" lastMessageIsOwn />)
  expect(el.scrollTop).toBe(1500)
})

it('removes its scroll listener on unmount', () => {
  const { unmount } = render(<Harness {...base} />)
  const el = api.containerRef.current!
  const remove = vi.spyOn(el, 'removeEventListener')
  unmount()
  expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function))
})
