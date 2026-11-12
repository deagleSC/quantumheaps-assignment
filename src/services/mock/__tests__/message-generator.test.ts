import { generateMessages } from '../data/message-generator'
import { createRng } from '../data/random'

const NOW = Date.parse('2026-11-12T12:00:00Z')
const base = {
  conversationId: 'c-test',
  count: 50,
  currentUserId: 'me',
  participantIds: ['me', 'a', 'b'],
  unread: 4,
  days: 5,
  now: NOW,
}

describe('generateMessages', () => {
  it('is deterministic for the same seed', () => {
    const a = generateMessages({ ...base, rng: createRng(7) })
    const b = generateMessages({ ...base, rng: createRng(7) })
    expect(a).toEqual(b)
    expect(generateMessages({ ...base, rng: createRng(8) })).not.toEqual(a)
  })

  it('produces strictly ascending timestamps within the window', () => {
    const msgs = generateMessages({ ...base, rng: createRng(1) })
    expect(msgs).toHaveLength(50)
    const times = msgs.map((m) => Date.parse(m.createdAt))
    times.forEach((t, i) => {
      if (i > 0) expect(t).toBeGreaterThan(times[i - 1]!)
      expect(t).toBeGreaterThanOrEqual(NOW - 5 * 86_400_000)
      expect(t).toBeLessThanOrEqual(NOW)
    })
  })

  it('spreads messages across several days (for date grouping)', () => {
    const msgs = generateMessages({ ...base, rng: createRng(3) })
    const days = new Set(msgs.map((m) => m.createdAt.slice(0, 10)))
    expect(days.size).toBeGreaterThanOrEqual(3)
  })

  it('ends with an unread tail from other people, preceded by an own message', () => {
    const msgs = generateMessages({ ...base, rng: createRng(5) })
    const tail = msgs.slice(-4)
    expect(tail.every((m) => m.senderId !== 'me')).toBe(true)
    expect(msgs[msgs.length - 5]!.senderId).toBe('me')
  })

  it('only replies to earlier messages', () => {
    const msgs = generateMessages({ ...base, count: 300, rng: createRng(9) })
    const index = new Map(msgs.map((m, i) => [m.id, i]))
    const replies = msgs.filter((m) => m.replyToId)
    expect(replies.length).toBeGreaterThan(0)
    replies.forEach((m) => expect(index.get(m.replyToId!)!).toBeLessThan(index.get(m.id)!))
  })

  it('returns [] for an empty conversation', () => {
    expect(generateMessages({ ...base, count: 0, rng: createRng(1) })).toEqual([])
  })

  it('requires another participant', () => {
    expect(() => generateMessages({ ...base, participantIds: ['me'], rng: createRng(1) })).toThrow(
      /no other participants/,
    )
  })
})
