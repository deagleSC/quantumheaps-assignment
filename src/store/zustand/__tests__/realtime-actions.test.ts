import {
  realtimeActions,
  useConversationStore,
  useMessageStore,
  useTypingStore,
  useUiStore,
  useUserStore,
} from '@/store'
import { resetStores } from '@/test/reset-stores'
import { conversationServices } from '../services/conversation-services'
import { realtimeServices, type RealtimeHandlers } from '../services/realtime-services'
import { at, direct, message, user } from '@/test/fixtures'

vi.mock('../services/realtime-services')
vi.mock('../services/conversation-services')

let handlers: Required<RealtimeHandlers>
const disconnect = vi.fn()

beforeEach(() => {
  vi.resetAllMocks()
  resetStores()
  vi.mocked(realtimeServices.connect).mockImplementation((h) => {
    handlers = h as Required<RealtimeHandlers>
    return disconnect
  })
  vi.mocked(conversationServices.markRead).mockResolvedValue(direct('c1', 'u1'))
  useUserStore.getState().setUsers([user('u1', 'Ada')])
  useConversationStore
    .getState()
    .setConversations([
      direct('c1', 'u1', { updatedAt: at(0) }),
      direct('c2', 'u2', { updatedAt: at(1) }),
    ])
})

it('returns the disconnect function', () => {
  const off = realtimeActions.connect()
  off()
  expect(disconnect).toHaveBeenCalledOnce()
})

describe('message:new', () => {
  it('bumps unread for chats not being viewed and stops typing', () => {
    realtimeActions.connect()
    useTypingStore.getState().startTyping('c1', 'u1')
    handlers['message:new']({ message: message('n1', { senderId: 'u1', createdAt: at(9) }) })
    const c1 = useConversationStore.getState().byId.c1!
    expect(c1).toMatchObject({ unreadCount: 1, lastMessageId: 'n1' })
    expect(useConversationStore.getState().order[0]).toBe('c1')
    expect(useTypingStore.getState().byConversation.c1).toEqual([])
  })

  it('marks it read on the server when the chat is open', () => {
    realtimeActions.connect()
    useUiStore.getState().setActiveConversation('c1')
    useMessageStore.getState().addPage('c1', { messages: [], hasMore: false })
    handlers['message:new']({ message: message('n1', { senderId: 'u1', createdAt: at(9) }) })
    expect(useConversationStore.getState().byId.c1?.unreadCount).toBe(0)
    expect(conversationServices.markRead).toHaveBeenCalledWith('c1')
    expect(useMessageStore.getState().byConversation.c1!.ids).toEqual(['n1'])
  })
})

it('only moves message status forward', () => {
  realtimeActions.connect()
  useMessageStore.getState().upsertMessage(message('m1', { status: 'sent' }))
  handlers['message:status']({ conversationId: 'c1', messageId: 'm1', status: 'read' })
  handlers['message:status']({ conversationId: 'c1', messageId: 'm1', status: 'delivered' })
  expect(useMessageStore.getState().byId.m1?.status).toBe('read')
})

it('tracks typing and presence', () => {
  realtimeActions.connect()
  handlers['typing:start']({ conversationId: 'c1', userId: 'u1' })
  expect(useTypingStore.getState().byConversation.c1).toEqual(['u1'])
  handlers['typing:stop']({ conversationId: 'c1', userId: 'u1' })
  expect(useTypingStore.getState().byConversation.c1).toEqual([])
  handlers['presence:change']({ userId: 'u1', isOnline: false, lastSeen: at(3) })
  expect(useUserStore.getState().byId.u1).toMatchObject({ isOnline: false, lastSeen: at(3) })
})
