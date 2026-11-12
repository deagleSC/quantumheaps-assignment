import { act, render, screen, within } from '@/test/render'
import userEvent from '@testing-library/user-event'
import {
  messageActions,
  useConversationStore,
  useMessageStore,
  useTypingStore,
  useUiStore,
  useUserStore,
} from '@/store'
import { direct, group, message, user } from '@/test/fixtures'
import { resetStores } from '@/test/reset-stores'
import { MessageBubble } from '../components/message-bubble'
import { MessageComposer } from '../components/message-composer'
import { MessageList } from '../components/message-list'
import { MessageStatusIcon } from '../components/message-status-icon'

const NOW = new Date('2026-11-12T12:00:00Z')

beforeEach(() => {
  resetStores()
  vi.restoreAllMocks()
  useUserStore.getState().setCurrentUserId('me')
  useUserStore
    .getState()
    .setUsers([user('me', 'Alex Morgan'), user('u1', 'Ada Lovelace'), user('u2', 'Bob Stone')])
})

describe('MessageStatusIcon', () => {
  it.each(['sending', 'sent', 'delivered', 'read', 'failed'] as const)('labels %s', (status) => {
    render(<MessageStatusIcon status={status} />)
    expect(screen.getByRole('img')).toHaveAccessibleName(
      {
        sending: 'Sending',
        sent: 'Sent',
        delivered: 'Delivered',
        read: 'Read',
        failed: 'Failed to send',
      }[status],
    )
  })
})

describe('MessageBubble', () => {
  const props = { isOwn: true, isGroup: false, isFirstInCluster: true, isLastInCluster: true }

  it('shows content, time, edited label and status for own messages', () => {
    render(
      <MessageBubble
        {...props}
        message={message('m1', { content: 'Hello', editedAt: NOW.toISOString(), status: 'read' })}
      />,
    )
    expect(screen.getByText('Hello')).toBeInTheDocument()
    expect(screen.getByText('edited')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Read' })).toBeInTheDocument()
  })

  it('shows the sender name in groups and no status for incoming', () => {
    render(
      <MessageBubble
        {...props}
        isOwn={false}
        isGroup
        message={message('m1', { senderId: 'u1', content: 'Hi all' })}
      />,
    )
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('renders deleted, system and reaction states', () => {
    const { rerender } = render(
      <MessageBubble {...props} message={message('m1', { isDeleted: true, content: '' })} />,
    )
    expect(screen.getByText('This message was deleted')).toBeInTheDocument()
    rerender(
      <MessageBubble
        {...props}
        message={message('m2', { kind: 'system', content: 'You added Bob' })}
      />,
    )
    expect(screen.getByText('You added Bob')).toBeInTheDocument()
    rerender(
      <MessageBubble
        {...props}
        message={message('m3', { reactions: [{ emoji: '👍', userIds: ['u1', 'u2'] }] })}
      />,
    )
    expect(screen.getByRole('button', { name: '👍 2: Ada, Bob' })).toBeInTheDocument()
  })

  it('offers retry for failed messages', async () => {
    const retry = vi.spyOn(messageActions, 'retry').mockResolvedValue()
    render(<MessageBubble {...props} message={message('tmp-1', { status: 'failed' })} />)
    await userEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(retry).toHaveBeenCalledWith('tmp-1')
  })

  it('quotes the replied-to message', () => {
    useMessageStore
      .getState()
      .upsertMessage(message('orig', { senderId: 'u1', content: 'Original text' }))
    render(
      <MessageBubble
        {...props}
        message={message('m1', { content: 'Answer', replyToId: 'orig' })}
      />,
    )
    const quote = screen.getByRole('button', { name: /Ada Lovelace/ })
    expect(quote).toHaveTextContent('Original text')
  })
})

describe('MessageList', () => {
  const t = (h: number, m = 0) => new Date(2026, 10, 12, h, m).toISOString()

  function seed(
    status: 'success' | 'loading' | 'error' = 'success',
    messages = [
      message('m1', { senderId: 'u1', content: 'Morning!', createdAt: t(9) }),
      message('m2', { content: 'Hey 👋', createdAt: t(9, 1) }),
    ],
  ) {
    useConversationStore.getState().setConversations([direct('c1', 'u1')])
    useMessageStore.getState().addPage('c1', { messages, hasMore: false })
    useMessageStore
      .getState()
      .setHistoryStatus('c1', status, status === 'error' ? 'Network error' : null)
  }

  it('renders messages under a day separator in a live log', () => {
    seed()
    render(<MessageList conversationId="c1" />)
    const log = screen.getByRole('log', { name: 'Messages' })
    expect(within(log).getByText('Morning!')).toBeInTheDocument()
    expect(within(log).getByText('Hey 👋')).toBeInTheDocument()
    expect(within(log).getAllByRole('separator')[0]).toHaveTextContent(/Today|Yesterday|day|\d/)
  })

  it('shows the unread divider for the marker captured on open', () => {
    seed()
    useUiStore.setState({ unreadMarker: { conversationId: 'c1', count: 1 } })
    render(<MessageList conversationId="c1" />)
    expect(screen.getByText('1 unread message')).toBeInTheDocument()
  })

  it('shows typing below the messages', () => {
    seed()
    render(<MessageList conversationId="c1" />)
    act(() => useTypingStore.getState().startTyping('c1', 'u1'))
    expect(screen.getByText('Ada is typing…')).toBeInTheDocument()
  })

  it('shows loading, error (with retry) and empty states', async () => {
    seed('loading', [])
    const { unmount } = render(<MessageList conversationId="c1" />)
    expect(screen.getByLabelText('Loading messages')).toBeInTheDocument()
    unmount()

    resetStores()
    seed('error', [])
    const load = vi.spyOn(messageActions, 'loadHistory').mockResolvedValue()
    const second = render(<MessageList conversationId="c1" />)
    await userEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(load).toHaveBeenCalledWith('c1')
    second.unmount()

    resetStores()
    seed('success', [])
    render(<MessageList conversationId="c1" />)
    expect(screen.getByText('No messages yet')).toBeInTheDocument()
  })

  it('renders group sender names', () => {
    useConversationStore
      .getState()
      .setConversations([group('g1', { memberIds: ['me', 'u1', 'u2'] })])
    useMessageStore.getState().addPage('g1', {
      messages: [message('m1', { conversationId: 'g1', senderId: 'u2', content: 'Yo' })],
      hasMore: false,
    })
    useMessageStore.getState().setHistoryStatus('g1', 'success')
    render(<MessageList conversationId="g1" />)
    expect(screen.getByText('Bob Stone')).toBeInTheDocument()
  })
})

describe('MessageComposer', () => {
  it('sends on Enter, keeps Shift+Enter as a newline and clears the input', async () => {
    const send = vi.spyOn(messageActions, 'send').mockResolvedValue('tmp-1')
    const ui = userEvent.setup()
    render(<MessageComposer conversationId="c1" />)
    const input = screen.getByRole('textbox', { name: 'Message' })
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled()

    await ui.type(input, 'Line one{Shift>}{Enter}{/Shift}Line two')
    expect(input).toHaveValue('Line one\nLine two')
    expect(send).not.toHaveBeenCalled()

    await ui.keyboard('{Enter}')
    expect(send).toHaveBeenCalledWith({
      conversationId: 'c1',
      content: 'Line one\nLine two',
      replyToId: undefined,
    })
    expect(input).toHaveValue('')
  })

  it('does not send whitespace', async () => {
    const send = vi.spyOn(messageActions, 'send')
    const ui = userEvent.setup()
    render(<MessageComposer conversationId="c1" />)
    await ui.type(screen.getByRole('textbox'), '   {Enter}')
    expect(send).not.toHaveBeenCalled()
  })

  it('sends with the send button', async () => {
    const send = vi.spyOn(messageActions, 'send').mockResolvedValue('tmp-1')
    const ui = userEvent.setup()
    render(<MessageComposer conversationId="c1" />)
    await ui.type(screen.getByRole('textbox'), 'Hi')
    await ui.click(screen.getByRole('button', { name: 'Send message' }))
    expect(send).toHaveBeenCalledOnce()
  })

  it('shows the reply preview, sends the reply and cancels with Esc', async () => {
    const send = vi.spyOn(messageActions, 'send').mockResolvedValue('tmp-1')
    useMessageStore
      .getState()
      .upsertMessage(message('orig', { senderId: 'u1', content: 'Question?' }))
    useUiStore.getState().setReplyingTo('orig')
    const ui = userEvent.setup()
    render(<MessageComposer conversationId="c1" />)
    expect(screen.getByLabelText('Reply preview')).toHaveTextContent('Replying to Ada Lovelace')

    await ui.type(screen.getByRole('textbox'), 'Answer{Enter}')
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ replyToId: 'orig' }))

    act(() => useUiStore.getState().setReplyingTo('orig'))
    await ui.click(screen.getByRole('textbox'))
    await ui.keyboard('{Escape}')
    expect(useUiStore.getState().replyingToId).toBeNull()
  })
})
