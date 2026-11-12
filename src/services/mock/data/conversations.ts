import type { UserId } from '@/types/common.types'

interface BaseSeed {
  id: string
  /** Messages to generate for this conversation. */
  messageCount: number
  /** Trailing incoming messages the current user has not read. */
  unread: number
  /** How many days back the history goes. */
  days: number
}

export interface DirectSeed extends BaseSeed {
  type: 'direct'
  participantId: UserId
}

export interface GroupSeed extends BaseSeed {
  type: 'group'
  name: string
  description: string
  memberIds: UserId[]
  adminIds: UserId[]
}

export type ConversationSeed = DirectSeed | GroupSeed

/** The current user is added to every group's members at DB creation time. */
export const seedConversations: ConversationSeed[] = [
  { id: 'c-priya', type: 'direct', participantId: 'u-priya', messageCount: 40, unread: 2, days: 6 },
  { id: 'c-sofia', type: 'direct', participantId: 'u-sofia', messageCount: 60, unread: 5, days: 9 },
  {
    id: 'c-daniel',
    type: 'direct',
    participantId: 'u-daniel',
    messageCount: 25,
    unread: 0,
    days: 4,
  },
  { id: 'c-aisha', type: 'direct', participantId: 'u-aisha', messageCount: 30, unread: 1, days: 3 },
  {
    id: 'c-marcus',
    type: 'direct',
    participantId: 'u-marcus',
    messageCount: 12,
    unread: 0,
    days: 12,
  },
  { id: 'c-liam', type: 'direct', participantId: 'u-liam', messageCount: 8, unread: 0, days: 20 },
  // No history: exercises the empty-conversation state.
  { id: 'c-mei', type: 'direct', participantId: 'u-mei', messageCount: 0, unread: 0, days: 0 },
  {
    id: 'g-frontend',
    type: 'group',
    name: 'Frontend Guild',
    description: 'Patterns, reviews and the occasional CSS rant.',
    memberIds: ['u-priya', 'u-daniel', 'u-mei', 'u-noah'],
    adminIds: ['u-priya'],
    messageCount: 80,
    unread: 3,
    days: 7,
  },
  {
    id: 'g-design',
    type: 'group',
    name: 'Design Review',
    description: 'Weekly critique of in-flight design work.',
    memberIds: ['u-sofia', 'u-aisha', 'u-elena'],
    adminIds: ['u-me'],
    messageCount: 45,
    unread: 0,
    days: 10,
  },
  {
    id: 'g-hikers',
    type: 'group',
    name: 'Weekend Hikers',
    description: 'Trails, weather and who is bringing snacks.',
    memberIds: ['u-liam', 'u-marcus', 'u-omar', 'u-elena', 'u-priya'],
    adminIds: ['u-marcus'],
    messageCount: 120,
    unread: 12,
    days: 14,
  },
]
