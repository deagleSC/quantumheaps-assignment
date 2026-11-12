import { message } from '@/test/fixtures'
import { buildRows, groupIntoSections, type MessageRow } from '../utils/build-rows'
import { formatDateSeparator } from '../utils/date-label'

const NOW = new Date(2026, 10, 12, 18, 0)
const t = (day: number, h: number, m: number) => new Date(2026, 10, day, h, m).toISOString()
const kinds = (rows: MessageRow[]) =>
  rows.map((r) =>
    r.type === 'message' ? r.message.id : r.type === 'date' ? `[${r.label}]` : '--unread--',
  )

describe('formatDateSeparator', () => {
  it.each([
    [new Date(2026, 10, 12, 9), 'Today'],
    [new Date(2026, 10, 11, 9), 'Yesterday'],
    [new Date(2026, 10, 9, 9), 'Monday'],
    [new Date(2026, 10, 2, 9), 'Mon, 2 Nov'],
    [new Date(2025, 11, 31, 9), '31 Dec 2025'],
  ])('%s → %s', (date, label) => {
    expect(formatDateSeparator(date, NOW)).toBe(label)
  })
})

describe('buildRows', () => {
  const msgs = [
    message('a', { senderId: 'u1', createdAt: t(11, 9, 0) }),
    message('b', { senderId: 'u1', createdAt: t(11, 9, 2) }),
    message('c', { senderId: 'me', createdAt: t(12, 8, 0) }),
    message('d', { senderId: 'u1', createdAt: t(12, 8, 1) }),
    message('e', { senderId: 'u1', createdAt: t(12, 8, 30) }), // > 5 min gap
    message('f', { senderId: 'u1', createdAt: t(12, 8, 31) }),
  ]

  it('inserts a separator per day', () => {
    expect(kinds(buildRows(msgs, { currentUserId: 'me', now: NOW }))).toEqual([
      '[Yesterday]',
      'a',
      'b',
      '[Today]',
      'c',
      'd',
      'e',
      'f',
    ])
  })

  it('clusters same-sender messages within 5 minutes on the same day', () => {
    const rows = buildRows(msgs, { currentUserId: 'me', now: NOW }).filter(
      (r) => r.type === 'message',
    )
    const flags = rows.map(
      (r) => r.type === 'message' && [r.message.id, r.isFirstInCluster, r.isLastInCluster],
    )
    expect(flags).toEqual([
      ['a', true, false],
      ['b', false, true],
      ['c', true, true],
      ['d', true, true],
      ['e', true, false],
      ['f', false, true],
    ])
  })

  it('puts the unread divider above the last N incoming messages and breaks the cluster', () => {
    const rows = buildRows(msgs, { currentUserId: 'me', unreadCount: 2, now: NOW })
    expect(kinds(rows)).toEqual([
      '[Yesterday]',
      'a',
      'b',
      '[Today]',
      'c',
      'd',
      '--unread--',
      'e',
      'f',
    ])
    const d = rows.find((r) => r.type === 'message' && r.message.id === 'd')
    expect(d?.type === 'message' && d.isLastInCluster).toBe(true)
  })

  it('never clusters system messages', () => {
    const rows = buildRows(
      [
        message('s1', { kind: 'system', createdAt: t(12, 8, 0) }),
        message('s2', { kind: 'system', createdAt: t(12, 8, 1) }),
      ],
      { currentUserId: 'me', now: NOW },
    )
    expect(
      rows
        .filter((r) => r.type === 'message')
        .every((r) => r.type === 'message' && r.isFirstInCluster),
    ).toBe(true)
  })

  it('groups rows into day sections', () => {
    const sections = groupIntoSections(
      buildRows(msgs, { currentUserId: 'me', unreadCount: 2, now: NOW }),
    )
    expect(sections.map((s) => [s.date.label, s.rows.length])).toEqual([
      ['Yesterday', 2],
      ['Today', 5],
    ])
  })

  it('handles no messages', () => {
    expect(buildRows([], { currentUserId: 'me' })).toEqual([])
  })
})
