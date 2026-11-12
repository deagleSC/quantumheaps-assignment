import userEvent from '@testing-library/user-event'
import { useConversationStore, useMessageStore, useUiStore, useUserStore } from '@/store'
import { direct, message, user } from '@/test/fixtures'
import { act, render, screen, within } from '@/test/render'
import { resetStores } from '@/test/reset-stores'
import { ChatView } from '../components/chat-view'
import { splitHighlight } from '../utils/highlight'

const t = (m: number) => new Date(2026, 10, 12, 9, m).toISOString()

beforeEach(() => {
  resetStores()
  useUserStore.getState().setCurrentUserId('me')
  useUserStore.getState().setUsers([user('me', 'Me'), user('u1', 'Ada Lovelace')])
  useConversationStore.getState().setConversations([direct('c1', 'u1')])
  useMessageStore.getState().addPage('c1', {
    hasMore: false,
    messages: [
      message('m1', { content: 'Lunch on Friday?', createdAt: t(1), senderId: 'u1' }),
      message('m2', { content: 'Sure', createdAt: t(2) }),
      message('m3', { content: 'Friday lunch at noon', createdAt: t(3), senderId: 'u1' }),
      message('m4', { content: 'lunch', createdAt: t(4), isDeleted: true }),
    ],
  })
  useMessageStore.getState().setHistoryStatus('c1', 'success')
  useUiStore.getState().setActiveConversation('c1')
})

describe('splitHighlight', () => {
  it('splits case-insensitively and escapes regex characters', () => {
    expect(splitHighlight('Lunch and lunch', 'LUNCH')).toEqual([
      { text: 'Lunch', match: true },
      { text: ' and ', match: false },
      { text: 'lunch', match: true },
    ])
    expect(splitHighlight('a+b (c)', '(c)')).toEqual([
      { text: 'a+b ', match: false },
      { text: '(c)', match: true },
    ])
    expect(splitHighlight('text', '  ')).toEqual([{ text: 'text', match: false }])
  })
})

describe('in-chat search', () => {
  it('finds, highlights and walks through matches, skipping deleted messages', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const ui = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<ChatView conversationId="c1" />)
    await ui.click(screen.getByRole('button', { name: 'Search in this chat' }))
    const input = screen.getByRole('textbox', { name: 'Search in this chat' })
    expect(input).toHaveFocus()

    await ui.type(input, 'lunch')
    act(() => vi.advanceTimersByTime(250))
    const search = screen.getByRole('search')
    expect(search).toHaveTextContent('2 of 2')
    const log = screen.getByRole('log')
    expect(within(log).getAllByText(/lunch/i, { selector: 'mark' })).toHaveLength(2)
    expect(useUiStore.getState().messageSearch?.activeMatchId).toBe('m3')

    await ui.keyboard('{ArrowUp}')
    expect(search).toHaveTextContent('1 of 2')
    expect(useUiStore.getState().messageSearch?.activeMatchId).toBe('m1')
    await ui.keyboard('{Enter}')
    expect(search).toHaveTextContent('2 of 2')
    await ui.keyboard('{Enter}') // wraps around
    expect(search).toHaveTextContent('1 of 2')

    await ui.clear(input)
    await ui.type(input, 'zebra')
    act(() => vi.advanceTimersByTime(250))
    expect(search).toHaveTextContent('No results')

    await ui.keyboard('{Escape}')
    expect(screen.queryByRole('search')).not.toBeInTheDocument()
    expect(within(log).queryByText('lunch', { selector: 'mark' })).not.toBeInTheDocument()
    vi.useRealTimers()
  })

  it('closes when switching chats', () => {
    useUiStore.getState().openMessageSearch()
    act(() => useUiStore.getState().setActiveConversation('c2'))
    expect(useUiStore.getState().messageSearch).toBeNull()
  })
})
