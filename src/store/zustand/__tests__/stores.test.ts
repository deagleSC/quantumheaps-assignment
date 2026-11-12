import {
  useConversationStore,
  useMessageStore,
  useTypingStore,
  useUiStore,
  useUserStore,
} from '@/store'
import { resetStores } from '@/test/reset-stores'
import { at, direct, message, user } from '@/test/fixtures'

beforeEach(resetStores)

describe('user-store', () => {
  it('indexes users and patches one', () => {
    const s = useUserStore.getState()
    s.setUsers([user('a', 'Ada'), user('b', 'Bob')])
    s.patchUser('a', { isOnline: false })
    s.patchUser('missing', { isOnline: false })
    expect(useUserStore.getState().byId.a?.isOnline).toBe(false)
    expect(Object.keys(useUserStore.getState().byId)).toEqual(['a', 'b'])
  })
})

describe('conversation-store', () => {
  it('orders by recent activity and moves touched chats to the top', () => {
    const s = useConversationStore.getState()
    s.setConversations([
      direct('old', 'a', { updatedAt: at(1) }),
      direct('new', 'b', { updatedAt: at(5) }),
    ])
    expect(useConversationStore.getState().order).toEqual(['new', 'old'])
    s.touchConversation('old', 'm9', at(9))
    expect(useConversationStore.getState().order).toEqual(['old', 'new'])
    expect(useConversationStore.getState().byId.old?.lastMessageId).toBe('m9')
  })

  it('ignores stale activity', () => {
    const s = useConversationStore.getState()
    s.setConversations([direct('c', 'a', { updatedAt: at(5), lastMessageId: 'm5' })])
    s.touchConversation('c', 'm1', at(1))
    expect(useConversationStore.getState().byId.c?.lastMessageId).toBe('m5')
  })

  it('tracks unread counts', () => {
    const s = useConversationStore.getState()
    s.setConversations([direct('c', 'a')])
    s.incrementUnread('c')
    s.incrementUnread('c')
    expect(useConversationStore.getState().byId.c?.unreadCount).toBe(2)
    s.setUnreadCount('c', 0)
    expect(useConversationStore.getState().byId.c?.unreadCount).toBe(0)
  })
})

describe('message-store', () => {
  const page = (ids: number[], hasMore: boolean) => ({
    messages: ids.map((n) => message(`m${n}`, { createdAt: at(n) })),
    hasMore,
  })

  it('merges pages in chronological order and tracks hasMore from the oldest page', () => {
    const s = useMessageStore.getState()
    s.addPage('c1', page([5, 6, 7], true))
    s.setHistoryStatus('c1', 'success')
    s.addPage('c1', page([2, 3, 4], false))
    const timeline = useMessageStore.getState().byConversation.c1!
    expect(timeline.ids).toEqual(['m2', 'm3', 'm4', 'm5', 'm6', 'm7'])
    expect(timeline.hasMore).toBe(false)
  })

  it('keeps realtime messages that arrived while history was loading', () => {
    const s = useMessageStore.getState()
    s.setHistoryStatus('c1', 'loading')
    s.upsertMessage(message('live', { createdAt: at(30) }))
    s.addPage('c1', page([1, 2], false))
    expect(useMessageStore.getState().byConversation.c1!.ids).toEqual(['m1', 'm2', 'live'])
  })

  it('caches preview messages without creating a timeline', () => {
    useMessageStore.getState().cacheMessages([message('p1')])
    expect(useMessageStore.getState().byId.p1).toBeDefined()
    expect(useMessageStore.getState().byConversation.c1).toBeUndefined()
  })

  it('replaces an optimistic message in place', () => {
    const s = useMessageStore.getState()
    s.addPage('c1', page([1], false))
    s.upsertMessage(message('tmp-1', { createdAt: at(2), status: 'sending' }))
    s.upsertMessage(message('m3', { createdAt: at(3) }))
    s.replaceMessage('tmp-1', message('real', { createdAt: at(2), status: 'sent' }))
    const state = useMessageStore.getState()
    expect(state.byConversation.c1!.ids).toEqual(['m1', 'real', 'm3'])
    expect(state.byId['tmp-1']).toBeUndefined()
  })

  it('does not duplicate when the server copy is already present', () => {
    const s = useMessageStore.getState()
    s.addPage('c1', page([1], false))
    s.upsertMessage(message('tmp-1', { createdAt: at(2) }))
    s.upsertMessage(message('real', { createdAt: at(2) }))
    s.replaceMessage('tmp-1', message('real', { createdAt: at(2) }))
    expect(useMessageStore.getState().byConversation.c1!.ids).toEqual(['m1', 'real'])
  })

  it('patches and removes messages', () => {
    const s = useMessageStore.getState()
    s.addPage('c1', page([1, 2], false))
    s.patchMessage('m1', { status: 'failed' })
    s.removeMessage('m2')
    const state = useMessageStore.getState()
    expect(state.byId.m1?.status).toBe('failed')
    expect(state.byConversation.c1!.ids).toEqual(['m1'])
  })
})

describe('typing-store', () => {
  it('adds each typist once and removes them', () => {
    const s = useTypingStore.getState()
    s.startTyping('c1', 'a')
    s.startTyping('c1', 'a')
    s.startTyping('c1', 'b')
    s.stopTyping('c1', 'a')
    expect(useTypingStore.getState().byConversation.c1).toEqual(['b'])
  })
})

describe('ui-store', () => {
  it('keeps reply and edit mutually exclusive and resets both on chat change', () => {
    const s = useUiStore.getState()
    s.setReplyingTo('m1')
    s.setEditing('m2')
    expect(useUiStore.getState()).toMatchObject({ replyingToId: null, editingId: 'm2' })
    s.setReplyingTo('m3')
    expect(useUiStore.getState()).toMatchObject({ replyingToId: 'm3', editingId: null })
    s.setActiveConversation('c2')
    expect(useUiStore.getState()).toMatchObject({ activeConversationId: 'c2', replyingToId: null })
  })

  it('persists only theme and filter', () => {
    const s = useUiStore.getState()
    s.setTheme('dark')
    s.setFilter('groups')
    s.setActiveConversation('c9')
    const saved = JSON.parse(localStorage.getItem('quantum-chat-ui') ?? '{}')
    expect(saved.state).toEqual({ theme: 'dark', filter: 'groups' })
  })
})
