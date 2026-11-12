/**
 * Up to two initials from a display name: "Ada Lovelace" → "AL".
 * Words that don't start with a letter (once punctuation is stripped) are
 * skipped, so "Load test (10k)" → "LT".
 */
export function getInitials(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter((w) => /^\p{L}/u.test(w))
  if (words.length === 0) return name.trim()[0]?.toUpperCase() ?? '?'
  const first = words[0]![0]!
  const last = words.length > 1 ? words[words.length - 1]![0]! : ''
  return (first + last).toUpperCase()
}
