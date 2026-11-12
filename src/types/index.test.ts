import { isGroup, type Conversation } from './index'

it('narrows conversations with isGroup', () => {
  const direct: Conversation = {
    id: 'c1',
    type: 'direct',
    participantId: 'u2',
    unreadCount: 0,
    updatedAt: '',
  }
  const group: Conversation = {
    id: 'c2',
    type: 'group',
    name: 'Team',
    memberIds: [],
    adminIds: [],
    unreadCount: 0,
    updatedAt: '',
    createdAt: '',
  }
  expect(isGroup(direct)).toBe(false)
  expect(isGroup(group)).toBe(true)
})
