/** Stable per-user colour for sender names in group chats. */
const COLORS = [
  'text-rose-700 dark:text-rose-400',
  'text-amber-700 dark:text-amber-400',
  'text-emerald-700 dark:text-emerald-400',
  'text-sky-700 dark:text-sky-400',
  'text-violet-700 dark:text-violet-400',
  'text-fuchsia-700 dark:text-fuchsia-400',
  'text-teal-700 dark:text-teal-400',
  'text-orange-700 dark:text-orange-400',
] as const

export function senderColor(userId: string): string {
  let hash = 0
  for (const ch of userId) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return COLORS[hash % COLORS.length]!
}
