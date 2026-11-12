import { formatConversationTime, formatLastSeen, formatMessageTime } from './format-time'

const NOW = new Date(2026, 10, 12, 15, 0) // Thu 12 Nov 2026, local time

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})
afterEach(() => vi.useRealTimers())

const local = (d: number, h = 9, m = 5) => new Date(2026, 10, d, h, m).toISOString()

describe('formatConversationTime', () => {
  it.each([
    [local(12, 14, 5), '14:05'],
    [local(11), 'Yesterday'],
    [local(9), 'Mon'],
    [local(1), '01/11/26'],
    ['not a date', ''],
  ])('%s → %s', (iso, expected) => {
    expect(formatConversationTime(iso, NOW)).toBe(expected)
  })
})

it('formats message times and last seen', () => {
  expect(formatMessageTime(local(12, 8, 7))).toBe('08:07')
  expect(formatLastSeen(local(12, 13, 30))).toBe('last seen today at 13:30')
  expect(formatLastSeen(local(11, 22, 0))).toBe('last seen yesterday at 22:00')
  expect(formatLastSeen(local(2))).toBe('last seen 02/11/26')
  expect(formatLastSeen(undefined)).toBe('offline')
})
