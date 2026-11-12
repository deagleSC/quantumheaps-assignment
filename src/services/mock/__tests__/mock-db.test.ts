import { CURRENT_USER_ID } from '../data/users'
import { MockDb, MockDbError } from '../mock-db'

const NOW = Date.parse('2026-11-12T12:00:00Z')
let db: MockDb
beforeEach(() => {
  db = new MockDb({ now: NOW })
})

describe('MockDb seed', () => {
  it('has users, direct chats and 4 groups', () => {
    expect(db.getUsers()).toHaveLength(11)
    const convs = db.getConversations()
    expect(convs).toHaveLength(11)
    expect(convs.filter((c) => c.type === 'group')).toHaveLength(4)
  })

  it('sorts conversations newest first and links the last message', () => {
    const convs = db.getConversations()
    for (let i = 1; i < convs.length; i++) {
      expect(convs[i - 1]!.updatedAt >= convs[i]!.updatedAt).toBe(true)
    }
    const priya = db.getConversation('c-priya')
    const { messages } = db.getMessages('c-priya', { limit: 1 })
    expect(priya.lastMessageId).toBe(messages[0]!.id)
    expect(priya.unreadCount).toBe(2)
  })

  it('includes the current user in every group and an empty chat', () => {
    const group = db.getConversation('g-frontend')
    expect(group.type === 'group' && group.memberIds).toContain(CURRENT_USER_ID)
    expect(db.getMessages('c-mei')).toEqual({ messages: [], hasMore: false })
  })

  it('returns copies, so callers cannot mutate stored data', () => {
    const [first] = db.getMessages('c-priya').messages
    first!.content = 'hacked'
    expect(db.getMessage(first!.id).content).not.toBe('hacked')
  })
})

describe('MockDb pagination', () => {
  it('pages backwards with `before` until hasMore is false', () => {
    const ids: string[] = []
    let page = db.getMessages('g-hikers', { limit: 50 })
    ids.unshift(...page.messages.map((m) => m.id))
    while (page.hasMore) {
      page = db.getMessages('g-hikers', { limit: 50, before: page.messages[0]!.id })
      ids.unshift(...page.messages.map((m) => m.id))
    }
    expect(ids).toHaveLength(120)
    expect(new Set(ids).size).toBe(120)
  })

  it('rejects an unknown cursor', () => {
    expect(() => db.getMessages('c-priya', { before: 'nope' })).toThrow(MockDbError)
  })
})

describe('MockDb writes', () => {
  it('inserts own messages as sent and updates the conversation', () => {
    const m = db.insertOwnMessage(
      { conversationId: 'c-daniel', content: '  hi  ', clientId: 'tmp1' },
      NOW + 1000,
    )
    expect(m).toMatchObject({
      content: 'hi',
      status: 'sent',
      senderId: CURRENT_USER_ID,
      clientId: 'tmp1',
    })
    const c = db.getConversation('c-daniel')
    expect(c.lastMessageId).toBe(m.id)
    expect(db.getConversations()[0]!.id).toBe('c-daniel')
  })

  it('rejects empty messages and unknown reply targets', () => {
    expect(() =>
      db.insertOwnMessage({ conversationId: 'c-daniel', content: '   ', clientId: 'x' }),
    ).toThrow('Message is empty')
    expect(() =>
      db.insertOwnMessage({
        conversationId: 'c-daniel',
        content: 'hi',
        clientId: 'x',
        replyToId: 'nope',
      }),
    ).toThrow(MockDbError)
  })

  it('increments unread for incoming messages and resets on read', () => {
    db.insertIncomingMessage('c-daniel', 'u-daniel', 'yo')
    expect(db.getConversation('c-daniel').unreadCount).toBe(1)
    expect(db.markConversationRead('c-daniel').unreadCount).toBe(0)
  })

  it('edits and soft-deletes only own messages', () => {
    const own = db.insertOwnMessage({ conversationId: 'c-daniel', content: 'first', clientId: 'x' })
    expect(db.editMessage(own.id, 'second')).toMatchObject({
      content: 'second',
      editedAt: expect.any(String),
    })
    const deleted = db.deleteMessage(own.id)
    expect(deleted).toMatchObject({ isDeleted: true, content: '' })
    expect(() => db.editMessage(own.id, 'again')).toThrow('deleted')

    const theirs = db.insertIncomingMessage('c-daniel', 'u-daniel', 'mine')
    expect(() => db.editMessage(theirs.id, 'x')).toThrow('only change your own')
    expect(() => db.deleteMessage(theirs.id)).toThrow(MockDbError)
  })

  it('toggles reactions per user', () => {
    const m = db.insertIncomingMessage('c-daniel', 'u-daniel', 'react to me')
    expect(db.toggleReaction(m.id, '👍').reactions).toEqual([
      { emoji: '👍', userIds: [CURRENT_USER_ID] },
    ])
    expect(db.toggleReaction(m.id, '👍', 'u-daniel').reactions[0]!.userIds).toEqual([
      CURRENT_USER_ID,
      'u-daniel',
    ])
    expect(db.toggleReaction(m.id, '👍').reactions[0]!.userIds).toEqual(['u-daniel'])
    expect(db.toggleReaction(m.id, '👍', 'u-daniel').reactions).toEqual([])
  })

  it('adds and removes group members with system messages', () => {
    const added = db.addMembers('g-design', ['u-omar', 'u-mei'])
    expect(added.conversation.memberIds).toEqual(expect.arrayContaining(['u-omar', 'u-mei']))
    expect(added.systemMessage).toMatchObject({
      kind: 'system',
      content: 'You added Omar Haddad, Mei Chen',
    })

    const removed = db.removeMember('g-design', 'u-omar')
    expect(removed.conversation.memberIds).not.toContain('u-omar')
    expect(removed.systemMessage.content).toBe('You removed Omar Haddad')

    expect(() => db.addMembers('g-design', ['u-mei'])).toThrow('No new members')
    expect(() => db.removeMember('g-design', CURRENT_USER_ID)).toThrow(MockDbError)
    expect(() => db.addMembers('c-priya', ['u-omar'])).toThrow('not a group')
  })

  it('updates presence and last seen', () => {
    const u = db.setPresence('u-priya', false, NOW)
    expect(u).toMatchObject({ isOnline: false, lastSeen: new Date(NOW).toISOString() })
    expect(db.setPresence('u-priya', true).lastSeen).toBeUndefined()
  })
})
