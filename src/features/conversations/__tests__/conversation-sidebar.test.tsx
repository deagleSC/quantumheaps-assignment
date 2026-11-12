import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  conversationActions,
  useConversationStore,
  useMessageStore,
  useTypingStore,
  useUiStore,
  useUserStore,
} from '@/store'
import { direct, group, message, user } from '@/test/fixtures'
import { resetStores } from '@/test/reset-stores'
import { ConversationSidebar } from '../components/conversation-sidebar'

function seed() {
  useUserStore.getState().setCurrentUserId('me')
  useUserStore
    .getState()
    .setUsers([
      user('me', 'Alex Morgan'),
      user('u1', 'Ada Lovelace'),
      user('u2', 'Bob Stone', false),
    ])
  useMessageStore
    .getState()
    .cacheMessages([
      message('m1', { conversationId: 'c1', senderId: 'u1', content: 'Lunch tomorrow?' }),
      message('m2', { conversationId: 'c2', content: 'See you' }),
      message('m3', { conversationId: 'g1', senderId: 'u2', content: 'Standup moved' }),
    ])
  useConversationStore.getState().setConversations([
    direct('c1', 'u1', {
      unreadCount: 3,
      lastMessageId: 'm1',
      updatedAt: '2026-11-12T11:00:00Z',
    }),
    direct('c2', 'u2', { lastMessageId: 'm2', updatedAt: '2026-11-12T10:00:00Z' }),
    group('g1', {
      name: 'Design Team',
      memberIds: ['me', 'u1', 'u2'],
      unreadCount: 1,
      lastMessageId: 'm3',
      updatedAt: '2026-11-12T09:00:00Z',
    }),
  ])
  useConversationStore.getState().setStatus('success')
}

const rows = () => within(screen.getByRole('list', { name: 'Chats' })).getAllByRole('button')
const names = () =>
  rows().map((r) => r.querySelector('[data-slot="conversation-title"]')?.textContent)

beforeEach(() => {
  resetStores()
  localStorage.clear()
})

describe('ConversationSidebar', () => {
  beforeEach(seed)

  it('lists chats newest first with previews, presence and unread badges', () => {
    render(<ConversationSidebar />)
    expect(names()).toEqual(['Ada Lovelace', 'Bob Stone', 'Design Team'])
    const [ada, bob, team] = rows()
    expect(ada).toHaveTextContent('Lunch tomorrow?')
    expect(within(ada!).getByLabelText('3 unread messages')).toHaveTextContent('3')
    expect(within(ada!).getByLabelText('Online')).toBeInTheDocument()
    expect(bob).toHaveTextContent('You: See you')
    expect(within(bob!).getByLabelText('Offline')).toBeInTheDocument()
    expect(team).toHaveTextContent('Bob: Standup moved')
    expect(within(team!).queryByRole('status')).not.toBeInTheDocument()
    expect(within(team!).getByLabelText('1 unread message')).toBeInTheDocument()
  })

  it('shows typing instead of the preview', () => {
    render(<ConversationSidebar />)
    act(() => {
      useTypingStore.getState().startTyping('c1', 'u1')
      useTypingStore.getState().startTyping('g1', 'u2')
    })
    expect(rows()[0]).toHaveTextContent('typing…')
    expect(rows()[2]).toHaveTextContent('Bob is typing…')
  })

  it('filters by Unread and Groups, with an unread count on the tab', async () => {
    const ui = userEvent.setup()
    render(<ConversationSidebar />)
    const unreadTab = screen.getByRole('tab', { name: /unread/i })
    expect(unreadTab).toHaveTextContent('2')
    await ui.click(unreadTab)
    expect(names()).toEqual(['Ada Lovelace', 'Design Team'])
    await ui.click(screen.getByRole('tab', { name: 'Groups' }))
    expect(names()).toEqual(['Design Team'])
  })

  it('debounces search over names and message text', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const ui = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<ConversationSidebar />)
    await ui.type(screen.getByRole('searchbox', { name: 'Search chats' }), 'lunch')
    expect(rows()).toHaveLength(3) // not yet applied
    act(() => vi.advanceTimersByTime(300))
    expect(names()).toEqual(['Ada Lovelace'])

    await ui.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(rows()).toHaveLength(3)
    vi.useRealTimers()
  })

  it('shows an empty state when nothing matches', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const ui = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<ConversationSidebar />)
    await ui.type(screen.getByRole('searchbox'), 'zzz')
    act(() => vi.advanceTimersByTime(300))
    expect(screen.getByText('No chats match')).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('opens a chat on click and marks the row active', async () => {
    const open = vi.spyOn(conversationActions, 'open').mockImplementation(async (id) => {
      useUiStore.getState().setActiveConversation(id)
    })
    render(<ConversationSidebar />)
    await userEvent.click(screen.getByRole('button', { name: /Bob Stone/ }))
    expect(open).toHaveBeenCalledWith('c2')
    expect(screen.getByRole('button', { name: /Bob Stone/ })).toHaveAttribute(
      'aria-current',
      'true',
    )
    open.mockRestore()
  })
})

describe('ConversationSidebar states', () => {
  it('shows a skeleton while loading', () => {
    useConversationStore.getState().setStatus('loading')
    render(<ConversationSidebar />)
    expect(screen.getByLabelText('Loading chats')).toHaveAttribute('aria-busy', 'true')
  })

  it('shows the error with a working retry', async () => {
    const load = vi.spyOn(conversationActions, 'loadInbox').mockResolvedValue()
    useConversationStore
      .getState()
      .setStatus('error', 'Network error while trying to load conversations')
    render(<ConversationSidebar />)
    expect(screen.getByRole('alert')).toHaveTextContent('Network error')
    await userEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(load).toHaveBeenCalledOnce()
    load.mockRestore()
  })

  it('shows filter-specific empty states', async () => {
    useConversationStore.getState().setConversations([direct('c2', 'u2')])
    useConversationStore.getState().setStatus('success')
    useUiStore.getState().setFilter('unread')
    render(<ConversationSidebar />)
    expect(screen.getByText('All caught up')).toBeInTheDocument()
  })
})
