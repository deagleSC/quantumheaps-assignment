import { configureMockApi, mockApi, resetMockApi } from '@/services/mock/mock-api'
import { notify } from '@/shared/lib/notify'
import { appActions } from '@/store'
import { appServices } from '../services/app-services'
import { conversationServices } from '../services/conversation-services'
import { groupServices } from '../services/group-services'
import { messageServices } from '../services/message-services'
import { userServices } from '../services/user-services'

beforeEach(() => {
  resetMockApi({ now: Date.parse('2026-11-12T12:00:00Z') })
  configureMockApi({ latency: { min: 0, max: 0 }, readFailureRate: 0, writeFailureRate: 0 })
})

vi.mock('@/shared/lib/notify')

describe('services against the mock API', () => {
  it('loads the inbox with previews for every chat that has messages', async () => {
    const inbox = await conversationServices.getInbox()
    const withMessages = inbox.conversations.filter((c) => c.lastMessageId)
    expect(inbox.lastMessages.map((m) => m.id).sort()).toEqual(
      withMessages.map((c) => c.lastMessageId).sort(),
    )
  })

  it('loads users and the current user', async () => {
    expect(await userServices.getCurrentUserId()).toBe('u-me')
    expect(await userServices.getAll()).toHaveLength(11)
  })

  it('pages history', async () => {
    const first = await messageServices.getPage('g-hikers')
    expect(first.messages).toHaveLength(30)
    expect(first.hasMore).toBe(true)
    const older = await messageServices.getPage('g-hikers', first.messages[0]!.id)
    expect(older.messages.at(-1)!.createdAt < first.messages[0]!.createdAt).toBe(true)
  })

  it('sends, edits, reacts and deletes', async () => {
    const sent = await messageServices.send({
      conversationId: 'c-liam',
      content: 'hey',
      clientId: 'tmp-1',
    })
    expect((await messageServices.edit(sent.id, 'hey!')).content).toBe('hey!')
    expect((await messageServices.toggleReaction(sent.id, '👍')).reactions).toHaveLength(1)
    expect((await messageServices.remove(sent.id)).isDeleted).toBe(true)
  })

  it('changes group membership', async () => {
    const { conversation } = await groupServices.addMembers('g-design', ['u-omar'])
    expect(conversation.memberIds).toContain('u-omar')
    await groupServices.removeMember('g-design', 'u-omar')
  })

  it('rethrows failures as readable Errors', async () => {
    configureMockApi({ writeFailureRate: 1, readFailureRate: 1 })
    await expect(
      messageServices.send({ conversationId: 'c-liam', content: 'x', clientId: 't' }),
    ).rejects.toThrow('Network error while trying to send the message')
    await expect(conversationServices.getInbox()).rejects.toThrow(
      'Network error while trying to load conversations',
    )
  })

  it('surfaces validation errors from the backend', async () => {
    await expect(groupServices.removeMember('c-priya', 'u-priya')).rejects.toThrow('is not a group')
  })
})

describe('services wrap every failure in a readable Error', () => {
  beforeEach(() => configureMockApi({ readFailureRate: 1, writeFailureRate: 1 }))

  it.each([
    ['userServices.getCurrentUserId', () => userServices.getCurrentUserId(), 'load your profile'],
    ['userServices.getAll', () => userServices.getAll(), 'load contacts'],
    [
      'conversationServices.markRead',
      () => conversationServices.markRead('c-liam'),
      'mark the chat as read',
    ],
    ['messageServices.getPage', () => messageServices.getPage('c-liam'), 'load messages'],
    ['messageServices.edit', () => messageServices.edit('x', 'y'), 'edit the message'],
    ['messageServices.remove', () => messageServices.remove('x'), 'delete the message'],
    [
      'messageServices.toggleReaction',
      () => messageServices.toggleReaction('x', '👍'),
      'react to the message',
    ],
    [
      'groupServices.addMembers',
      () => groupServices.addMembers('g-design', ['u-omar']),
      'add members',
    ],
  ] as const)('%s', async (_, call, label) => {
    await expect(call()).rejects.toThrow(`Network error while trying to ${label}`)
  })

  it('appServices.resetDemoData', async () => {
    const spy = vi.spyOn(mockApi, 'resetDemoData').mockRejectedValue('boom')
    await expect(appServices.resetDemoData()).rejects.toThrow('boom')
    spy.mockRejectedValue({})
    await expect(appServices.resetDemoData()).rejects.toThrow('Could not reset the demo data')
  })
})

describe('appActions.resetDemoData', () => {
  it('reports failures instead of reloading', async () => {
    vi.spyOn(appServices, 'resetDemoData').mockRejectedValue(
      new Error('Could not reset the demo data'),
    )
    const reload = vi.fn()
    await appActions.resetDemoData(reload)
    expect(reload).not.toHaveBeenCalled()
    expect(notify.error).toHaveBeenCalledWith('Could not reset the demo data')
  })
})
