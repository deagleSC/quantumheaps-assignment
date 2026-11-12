import { groupActions, useConversationStore, useMessageStore } from '@/store'
import { resetStores } from '@/test/reset-stores'
import { groupServices } from '../services/group-services'
import { at, group, message } from './fixtures'

vi.mock('../services/group-services')

beforeEach(() => {
  vi.resetAllMocks()
  resetStores()
  useConversationStore
    .getState()
    .setConversations([group('g1', { unreadCount: 4, updatedAt: at(0) })])
  useMessageStore.getState().addPage('g1', { messages: [], hasMore: false })
})

it('applies added members and the system message, keeping local unread', async () => {
  vi.mocked(groupServices.addMembers).mockResolvedValue({
    conversation: group('g1', { memberIds: ['me', 'u1', 'u2'], unreadCount: 0, updatedAt: at(5) }),
    systemMessage: message('sys', {
      conversationId: 'g1',
      kind: 'system',
      content: 'You added Bo',
      createdAt: at(5),
    }),
  })
  await groupActions.addMembers('g1', ['u2'])
  const conv = useConversationStore.getState().byId.g1!
  expect(conv.type === 'group' && conv.memberIds).toEqual(['me', 'u1', 'u2'])
  expect(conv.unreadCount).toBe(4)
  expect(conv.lastMessageId).toBe('sys')
  expect(useMessageStore.getState().byConversation.g1!.ids).toEqual(['sys'])
})

it('rethrows errors for the form to show', async () => {
  vi.mocked(groupServices.removeMember).mockRejectedValue(new Error('Could not remove the member'))
  await expect(groupActions.removeMember('g1', 'u1')).rejects.toThrow('Could not remove the member')
})
