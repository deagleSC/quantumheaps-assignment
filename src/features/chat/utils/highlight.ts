import type { Message } from '@/types/message.types'

export interface TextPart {
  text: string
  match: boolean
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Splits text into matching / non-matching parts (case-insensitive). */
export function splitHighlight(text: string, query: string): TextPart[] {
  const q = query.trim()
  if (!q) return [{ text, match: false }]
  const re = new RegExp(`(${escapeRegExp(q)})`, 'gi')
  return text
    .split(re)
    .filter((part) => part !== '')
    .map((part) => ({ text: part, match: part.toLowerCase() === q.toLowerCase() }))
}

/** Whether a message should count as a search hit. */
export const messageMatches = (message: Message, query: string) => {
  const q = query.trim().toLowerCase()
  return (
    q.length > 0 &&
    message.kind === 'text' &&
    !message.isDeleted &&
    message.content.toLowerCase().includes(q)
  )
}
