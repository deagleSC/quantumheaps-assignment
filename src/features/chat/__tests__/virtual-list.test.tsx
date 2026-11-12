import userEvent from '@testing-library/user-event'
import { messageActions, useConversationStore, useMessageStore, useUserStore } from '@/store'
import { direct, message, user } from '@/test/fixtures'
import { act, render, screen } from '@/test/render'
import { resetStores } from '@/test/reset-stores'
import { ChatMenu } from '../components/chat-menu'
import { MessageList, VIRTUALIZE_AT } from '../components/message-list'
import { jumpToMessage } from '../utils/jump-to-message'
import { registerMessageScroller } from '../utils/message-scroller'

const base = Date.UTC(2026, 9, 1)
const msgs = (count: number, from = 0) =>
  Array.from({ length: count }, (_, i) =>
    message(`m${from + i}`, {
      content: `Message ${from + i}`,
      senderId: (from + i) % 3 ? 'u1' : 'me',
      createdAt: new Date(base + (from + i) * 60_000).toISOString(),
    }),
  )

function seed(messages: ReturnType<typeof msgs>, hasMore: boolean) {
  useUserStore.getState().setCurrentUserId('me')
  useUserStore.getState().setUsers([user('me', 'Me'), user('u1', 'Ada')])
  useConversationStore.getState().setConversations([direct('c1', 'u1')])
  useMessageStore.getState().addPage('c1', { messages, hasMore })
  useMessageStore.getState().setHistoryStatus('c1', 'success')
}

/** jsdom has no layout: give the scroll box and rows real-looking sizes. */
function fakeLayout({ viewport = 600, row = 60 } = {}) {
  const client = vi
    .spyOn(HTMLElement.prototype, 'clientHeight', 'get')
    .mockImplementation(function (this: HTMLElement) {
      return this.getAttribute('role') === 'log' ? viewport : 0
    })
  const offset = vi
    .spyOn(HTMLElement.prototype, 'offsetHeight', 'get')
    .mockImplementation(function (this: HTMLElement) {
      return this.hasAttribute('data-index') ? row : 0
    })
  return () => {
    client.mockRestore()
    offset.mockRestore()
  }
}

beforeEach(() => {
  vi.restoreAllMocks()
  resetStores()
})

describe('history row', () => {
  it('says "Start of conversation" once everything is loaded', () => {
    seed(msgs(5), false)
    render(<MessageList conversationId="c1" />)
    expect(screen.getByText('Start of conversation')).toBeInTheDocument()
    expect(screen.getByRole('log')).not.toHaveAttribute('data-virtualized')
  })

  it('offers a load-older button while more history exists', async () => {
    const older = vi.spyOn(messageActions, 'loadOlder').mockResolvedValue()
    seed(msgs(5), true)
    const ui = userEvent.setup()
    render(<MessageList conversationId="c1" />)
    await ui.click(screen.getByRole('button', { name: 'Load older messages' }))
    expect(older).toHaveBeenCalledWith('c1')
  })

  it('shows a spinner while older messages load', () => {
    seed(msgs(5), true)
    useMessageStore.getState().setOlderStatus('c1', 'loading')
    render(<MessageList conversationId="c1" />)
    expect(screen.getByRole('status', { name: 'Loading older messages' })).toBeInTheDocument()
  })
})

describe('infinite scroll', () => {
  it('loads older messages near the top, once at a time', () => {
    const older = vi.spyOn(messageActions, 'loadOlder').mockResolvedValue()
    seed(msgs(20), true)
    render(<MessageList conversationId="c1" />)
    const log = screen.getByRole('log')
    Object.defineProperty(log, 'scrollTop', { configurable: true, writable: true, value: 1000 })
    act(() => {
      log.dispatchEvent(new Event('scroll'))
    })
    expect(older).not.toHaveBeenCalled()
    log.scrollTop = 120
    act(() => {
      log.dispatchEvent(new Event('scroll'))
    })
    expect(older).toHaveBeenCalledOnce()

    act(() => useMessageStore.getState().setOlderStatus('c1', 'loading'))
    act(() => {
      log.dispatchEvent(new Event('scroll'))
    })
    expect(older).toHaveBeenCalledOnce()
  })

  it('keeps the same messages in view when an older page is prepended', () => {
    seed(msgs(10, 100), true)
    render(<MessageList conversationId="c1" />)
    const log = screen.getByRole('log')
    let top = 0
    Object.defineProperty(log, 'scrollHeight', {
      configurable: true,
      get: () => log.querySelectorAll('[data-message-id]').length * 50,
    })
    Object.defineProperty(log, 'scrollTop', {
      configurable: true,
      get: () => top,
      set: (v: number) => (top = v),
    })
    act(() => useMessageStore.getState().setOlderStatus('c1', 'idle')) // commit with fake metrics
    top = 40
    act(() => useMessageStore.getState().setOlderStatus('c1', 'loading')) // snapshot at top = 40

    act(() => useMessageStore.getState().addPage('c1', { messages: msgs(10, 90), hasMore: true }))
    expect(top).toBe(40 + 10 * 50)
  })
})

describe('virtualisation', () => {
  it('renders only a window of rows for a 10,000-message history', () => {
    const restore = fakeLayout()
    seed(msgs(10_000), false)
    render(<MessageList conversationId="c1" />)
    const log = screen.getByRole('log')
    expect(log).toHaveAttribute('data-virtualized')
    const rendered = log.querySelectorAll('[data-message-id]').length
    expect(rendered).toBeGreaterThan(0)
    expect(rendered).toBeLessThan(60)
    restore()
  })

  it('switches on above the threshold', () => {
    const restore = fakeLayout()
    seed(msgs(VIRTUALIZE_AT - 30), false) // below: rows + date separators stay under the limit
    const { unmount } = render(<MessageList conversationId="c1" />)
    expect(screen.getByRole('log')).not.toHaveAttribute('data-virtualized')
    unmount()
    resetStores()
    seed(msgs(VIRTUALIZE_AT + 10), false)
    render(<MessageList conversationId="c1" />)
    expect(screen.getByRole('log')).toHaveAttribute('data-virtualized')
    restore()
  })
})

describe('chat menu', () => {
  it('loads the entire history, and disables itself when everything is loaded', async () => {
    const all = vi.spyOn(messageActions, 'loadAll').mockResolvedValue()
    seed(msgs(5), true)
    const ui = userEvent.setup()
    render(<ChatMenu conversationId="c1" />)
    await ui.click(screen.getByRole('button', { name: 'More chat options' }))
    await ui.click(screen.getByRole('menuitem', { name: 'Load entire history (5 loaded)' }))
    expect(all).toHaveBeenCalledWith('c1')

    act(() => useMessageStore.getState().addPage('c1', { messages: [], hasMore: false }))
    await ui.click(screen.getByRole('button', { name: 'More chat options' }))
    expect(screen.getByRole('menuitem', { name: 'Entire history loaded' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  })
})

describe('jumpToMessage', () => {
  it('scrolls to a rendered row directly', () => {
    document.body.innerHTML = '<div data-message-id="x1"></div>'
    const el = document.querySelector('[data-message-id="x1"]')!
    const spy = vi.spyOn(el, 'scrollIntoView')
    expect(jumpToMessage('x1')).toBe(true)
    expect(spy).toHaveBeenCalled()
  })

  it('asks the virtual list to scroll to rows not in the DOM', () => {
    document.body.innerHTML = ''
    const scroller = vi.fn().mockReturnValue(true)
    const unregister = registerMessageScroller(scroller)
    expect(jumpToMessage('far-away')).toBe(true)
    expect(scroller).toHaveBeenCalledWith('far-away')
    unregister()
    expect(jumpToMessage('far-away')).toBe(false)
  })
})
