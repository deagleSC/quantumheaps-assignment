import {
  messageActions,
  useConversationStore,
  useMessageStore,
  useUiStore,
  useUserStore,
} from '@/store'
import { notify } from '@/shared/lib/notify'
import { resetStores } from '@/test/reset-stores'
import { messageServices } from '../services/message-services'
import { realtimeServices } from '../services/realtime-services'
import { at, direct, message } from '@/test/fixtures'

vi.mock('../services/message-services')
vi.mock('../services/realtime-services')
vi.mock('@/shared/lib/notify')

const services = vi.mocked(messageServices)

beforeEach(() => {
  vi.resetAllMocks()
  // Fixtures are timestamped 10:00–10:59 UTC; "now" sits after them.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(at(30)))
  resetStores()
  useUserStore.getState().setCurrentUserId('me')
  useConversationStore.getState().setConversations([direct('c1', 'u1', { updatedAt: at(0) })])
  useMessageStore
    .getState()
    .addPage('c1', { messages: [message('m1', { createdAt: at(1) })], hasMore: true })
  useMessageStore.getState().setHistoryStatus('c1', 'success')
})

afterEach(() => {
  vi.useRealTimers()
})

const timeline = () => useMessageStore.getState().byConversation.c1!

describe('send', () => {
  it('shows the message immediately, then swaps in the server copy', async () => {
    let resolve!: (m: ReturnType<typeof message>) => void
    services.send.mockReturnValue(new Promise((r) => (resolve = r)))
    useUiStore.getState().setReplyingTo('m1')

    const pending = messageActions.send({
      conversationId: 'c1',
      content: '  hello ',
      replyToId: 'm1',
    })
    const tempId = timeline().ids.at(-1)!
    expect(useMessageStore.getState().byId[tempId]).toMatchObject({
      content: 'hello',
      status: 'sending',
      replyToId: 'm1',
    })
    expect(useConversationStore.getState().byId.c1?.lastMessageId).toBe(tempId)
    expect(useUiStore.getState().replyingToId).toBeNull()
    expect(services.send).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: tempId, content: 'hello' }),
    )

    const saved = message('srv-1', {
      content: 'hello',
      status: 'sent',
      createdAt: new Date(Date.now() + 1000).toISOString(),
    })
    resolve(saved)
    await pending
    expect(timeline().ids).toEqual(['m1', 'srv-1'])
    expect(useConversationStore.getState().byId.c1?.lastMessageId).toBe('srv-1')
    expect(realtimeServices.notifyOutgoing).toHaveBeenCalledWith(saved)
  })

  it('marks the message failed and notifies on error, then retries', async () => {
    services.send.mockRejectedValueOnce(new Error('Network down'))
    const tempId = (await messageActions.send({ conversationId: 'c1', content: 'hi' }))!
    expect(useMessageStore.getState().byId[tempId]?.status).toBe('failed')
    expect(notify.error).toHaveBeenCalledWith('Network down')

    services.send.mockResolvedValueOnce(
      message('srv-2', { content: 'hi', status: 'sent', createdAt: at(50) }),
    )
    await messageActions.retry(tempId)
    expect(timeline().ids).toEqual(['m1', 'srv-2'])
  })

  it('ignores blank messages', async () => {
    expect(await messageActions.send({ conversationId: 'c1', content: '   ' })).toBeNull()
    expect(services.send).not.toHaveBeenCalled()
  })
})

describe('edit / remove / react', () => {
  it('edits optimistically and rolls back on failure', async () => {
    services.edit.mockRejectedValueOnce(new Error('nope'))
    const pending = messageActions.edit('m1', 'changed')
    expect(useMessageStore.getState().byId.m1?.content).toBe('changed')
    await pending
    expect(useMessageStore.getState().byId.m1).toMatchObject({
      content: 'msg m1',
      editedAt: undefined,
    })
    expect(notify.error).toHaveBeenCalledWith('nope')
  })

  it('skips edits that change nothing and clears edit mode', async () => {
    useUiStore.getState().setEditing('m1')
    await messageActions.edit('m1', ' msg m1 ')
    expect(services.edit).not.toHaveBeenCalled()
    expect(useUiStore.getState().editingId).toBeNull()
  })

  it('soft-deletes optimistically and restores on failure', async () => {
    useMessageStore.getState().patchMessage('m1', { reactions: [{ emoji: '👍', userIds: ['u1'] }] })
    services.remove.mockRejectedValueOnce(new Error('fail'))
    const pending = messageActions.remove('m1')
    expect(useMessageStore.getState().byId.m1).toMatchObject({ isDeleted: true, content: '' })
    await pending
    expect(useMessageStore.getState().byId.m1).toMatchObject({
      content: 'msg m1',
      reactions: [{ emoji: '👍', userIds: ['u1'] }],
    })
  })

  it('discards a failed, never-sent message locally', async () => {
    services.send.mockRejectedValueOnce(new Error('x'))
    const tempId = (await messageActions.send({ conversationId: 'c1', content: 'oops' }))!
    await messageActions.remove(tempId)
    expect(services.remove).not.toHaveBeenCalled()
    expect(timeline().ids).toEqual(['m1'])
  })

  it('toggles reactions optimistically and reconciles with the server', async () => {
    services.toggleReaction.mockResolvedValueOnce(
      message('m1', { reactions: [{ emoji: '🎉', userIds: ['me', 'u1'] }] }),
    )
    const pending = messageActions.toggleReaction('m1', '🎉')
    expect(useMessageStore.getState().byId.m1?.reactions).toEqual([
      { emoji: '🎉', userIds: ['me'] },
    ])
    await pending
    expect(useMessageStore.getState().byId.m1?.reactions).toEqual([
      { emoji: '🎉', userIds: ['me', 'u1'] },
    ])
  })

  it('rolls back a failed reaction', async () => {
    services.toggleReaction.mockRejectedValueOnce(new Error('x'))
    await messageActions.toggleReaction('m1', '🎉')
    expect(useMessageStore.getState().byId.m1?.reactions).toEqual([])
  })
})

describe('history', () => {
  it('loads the first page and records errors', async () => {
    services.getPage.mockResolvedValueOnce({
      messages: [message('x1', { conversationId: 'c2' })],
      hasMore: false,
    })
    await messageActions.loadHistory('c2')
    expect(useMessageStore.getState().byConversation.c2).toMatchObject({
      ids: ['x1'],
      status: 'success',
    })

    services.getPage.mockRejectedValueOnce(new Error('offline'))
    await messageActions.loadHistory('c3')
    expect(useMessageStore.getState().byConversation.c3).toMatchObject({
      status: 'error',
      error: 'offline',
    })
  })

  it('loads older pages using the oldest id, once at a time', async () => {
    services.getPage.mockResolvedValue({
      messages: [message('m0', { createdAt: at(0) })],
      hasMore: false,
    })
    await Promise.all([messageActions.loadOlder('c1'), messageActions.loadOlder('c1')])
    expect(services.getPage).toHaveBeenCalledOnce()
    expect(services.getPage).toHaveBeenCalledWith('c1', 'm1')
    expect(timeline()).toMatchObject({ ids: ['m0', 'm1'], hasMore: false })
    await messageActions.loadOlder('c1')
    expect(services.getPage).toHaveBeenCalledOnce()
  })
})
