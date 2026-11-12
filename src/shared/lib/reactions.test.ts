import { toggleReaction } from './reactions'

it('adds, joins, leaves and removes reactions without mutating input', () => {
  const start = [{ emoji: '👍', userIds: ['a'] }]
  const joined = toggleReaction(start, '👍', 'b')
  expect(joined).toEqual([{ emoji: '👍', userIds: ['a', 'b'] }])
  expect(start).toEqual([{ emoji: '👍', userIds: ['a'] }])
  expect(toggleReaction(joined, '👍', 'a')).toEqual([{ emoji: '👍', userIds: ['b'] }])
  expect(toggleReaction(start, '👍', 'a')).toEqual([])
  expect(toggleReaction(start, '🎉', 'a')).toEqual([...start, { emoji: '🎉', userIds: ['a'] }])
})
