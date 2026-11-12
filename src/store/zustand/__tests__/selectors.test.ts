import {
  filterConversations,
  getConversationDisplay,
  getMessagePreview,
  getTotalUnread,
  getTypingLabel,
} from '@/store'
import { direct, group, message, user } from '@/test/fixtures'

const usersById = { u1: user('u1', 'Ada Lovelace'), u2: user('u2', 'Bob Stone', false) }
const byId = {
  c1: direct('c1', 'u1', { unreadCount: 2, lastMessageId: 'm1' }),
  c2: direct('c2', 'u2', { lastMessageId: 'm2' }),
  g1: group('g1', { name: 'Design Team', unreadCount: 1 }),
}
const messagesById = {
  m1: message('m1', { content: 'Lunch tomorrow?', senderId: 'u1' }),
  m2: message('m2', { content: 'secret plans', isDeleted: true }),
}
const base = {
  order: ['c1', 'c2', 'g1'],
  byId,
  usersById,
  messagesById,
  filter: 'all' as const,
  search: '',
}

describe('filterConversations', () => {
  it.each([
    ['all', '', ['c1', 'c2', 'g1']],
    ['unread', '', ['c1', 'g1']],
    ['groups', '', ['g1']],
    ['all', 'ada', ['c1']],
    ['all', 'LUNCH', ['c1']],
    ['all', 'secret', []],
    ['unread', 'design', ['g1']],
    ['groups', 'ada', []],
  ] as const)('filter=%s search=%j', (filter, search, expected) => {
    expect(filterConversations({ ...base, filter, search })).toEqual(expected)
  })
})

describe('display helpers', () => {
  it('derives titles and presence', () => {
    expect(getConversationDisplay(byId.c2, usersById)).toMatchObject({
      title: 'Bob Stone',
      isOnline: false,
    })
    expect(getConversationDisplay(byId.g1, usersById)).toEqual({
      title: 'Design Team',
      avatarUrl: undefined,
    })
    expect(getConversationDisplay(direct('x', 'ghost'), usersById).title).toBe('Unknown user')
  })

  it('builds preview lines', () => {
    expect(getMessagePreview(undefined, byId.c1, usersById, 'me')).toBe('No messages yet')
    expect(getMessagePreview(message('a', { content: 'hi' }), byId.c1, usersById, 'me')).toBe(
      'You: hi',
    )
    expect(
      getMessagePreview(message('a', { content: 'hi', senderId: 'u1' }), byId.g1, usersById, 'me'),
    ).toBe('Ada: hi')
    expect(
      getMessagePreview(
        message('a', { senderId: 'u1', isDeleted: true }),
        byId.c1,
        usersById,
        'me',
      ),
    ).toBe('This message was deleted')
    expect(
      getMessagePreview(
        message('a', { kind: 'system', content: 'You added Bob' }),
        byId.g1,
        usersById,
        'me',
      ),
    ).toBe('You added Bob')
  })

  it('sums unread and labels typing', () => {
    expect(getTotalUnread(byId)).toBe(3)
    expect(getTypingLabel([], usersById)).toBeNull()
    expect(getTypingLabel(['u1'], usersById)).toBe('Ada is typing…')
    expect(getTypingLabel(['u1', 'u2'], usersById)).toBe('Ada and Bob are typing…')
    expect(getTypingLabel(['u1', 'u2', 'x'], usersById)).toBe('3 people are typing…')
  })
})
