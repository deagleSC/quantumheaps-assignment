import {
  conversationActions,
  useConversationStore,
  useMessageStore,
  useUiStore,
  useUserStore,
} from '@/store'
import { resetStores } from '@/test/reset-stores'
import { conversationServices } from '../services/conversation-services'
import { messageServices } from '../services/message-services'
import { userServices } from '../services/user-services'
import { direct, message, user } from '@/test/fixtures'

vi.mock('../services/conversation-services')
vi.mock('../services/message-services')
vi.mock('../services/user-services')

beforeEach(() => {
  vi.resetAllMocks()
  resetStores()
})

describe('loadInbox', () => {
  it('loads users, conversations and previews', async () => {
    vi.mocked(userServices.getCurrentUserId).mockResolvedValue('me')
    vi.mocked(userServices.getAll).mockResolvedValue([user('me', 'Me'), user('u1', 'Ada')])
    vi.mocked(conversationServices.getInbox).mockResolvedValue({
      conversations: [direct('c1', 'u1', { lastMessageId: 'm1' })],
      lastMessages: [message('m1')],
    })
    const pending = conversationActions.loadInbox()
    expect(useConversationStore.getState().status).toBe('loading')
    await pending
    expect(useConversationStore.getState()).toMatchObject({ status: 'success', order: ['c1'] })
    expect(useUserStore.getState().currentUserId).toBe('me')
    expect(useMessageStore.getState().byId.m1).toBeDefined()
  })

  it('records the error', async () => {
    vi.mocked(userServices.getCurrentUserId).mockResolvedValue('me')
    vi.mocked(userServices.getAll).mockResolvedValue([])
    vi.mocked(conversationServices.getInbox).mockRejectedValue(
      new Error('Could not load conversations'),
    )
    await conversationActions.loadInbox()
    expect(useConversationStore.getState()).toMatchObject({
      status: 'error',
      error: 'Could not load conversations',
    })
  })
})

describe('open / markRead', () => {
  beforeEach(() => {
    useConversationStore.getState().setConversations([direct('c1', 'u1', { unreadCount: 3 })])
    vi.mocked(messageServices.getPage).mockResolvedValue({
      messages: [message('m1')],
      hasMore: false,
    })
    vi.mocked(conversationServices.markRead).mockResolvedValue(direct('c1', 'u1'))
  })

  it('activates the chat, loads history once and clears unread', async () => {
    await conversationActions.open('c1')
    expect(useUiStore.getState().activeConversationId).toBe('c1')
    expect(useConversationStore.getState().byId.c1?.unreadCount).toBe(0)
    expect(conversationServices.markRead).toHaveBeenCalledWith('c1')
    expect(useUiStore.getState().unreadMarker).toEqual({ conversationId: 'c1', count: 3 })
    conversationActions.close()
    await conversationActions.open('c1')
    expect(messageServices.getPage).toHaveBeenCalledOnce()
  })

  it('does nothing when the chat is already open', async () => {
    await conversationActions.open('c1')
    useConversationStore.getState().setUnreadCount('c1', 2)
    await conversationActions.open('c1')
    expect(conversationServices.markRead).toHaveBeenCalledOnce()
  })

  it('retries history that failed before', async () => {
    useMessageStore.getState().setHistoryStatus('c1', 'error', 'x')
    await conversationActions.open('c1')
    expect(messageServices.getPage).toHaveBeenCalledOnce()
  })

  it('keeps the local read state when the server call fails', async () => {
    vi.mocked(conversationServices.markRead).mockRejectedValue(new Error('x'))
    await conversationActions.markRead('c1')
    expect(useConversationStore.getState().byId.c1?.unreadCount).toBe(0)
  })

  it('skips the server when nothing is unread', async () => {
    useConversationStore.getState().setUnreadCount('c1', 0)
    await conversationActions.markRead('c1')
    expect(conversationServices.markRead).not.toHaveBeenCalled()
  })

  it('close clears the active chat', () => {
    useUiStore.getState().setActiveConversation('c1')
    conversationActions.close()
    expect(useUiStore.getState().activeConversationId).toBeNull()
  })
})

it('does not start a second inbox load while one is in flight', async () => {
  vi.mocked(userServices.getCurrentUserId).mockResolvedValue('me')
  vi.mocked(userServices.getAll).mockResolvedValue([])
  vi.mocked(conversationServices.getInbox).mockResolvedValue({
    conversations: [],
    lastMessages: [],
  })
  await Promise.all([conversationActions.loadInbox(), conversationActions.loadInbox()])
  expect(conversationServices.getInbox).toHaveBeenCalledOnce()
})
