import { ChevronDown, ChevronUp, Search, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Button } from '@/shared/components/ui/button'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/shared/components/ui/input-group'
import { useUiStore } from '@/store'
import type { ConversationId } from '@/types/common.types'
import { useMessageSearch } from '../hooks/use-message-search'

/**
 * Find in this chat. Enter / ↓ = newer match, Shift+Enter / ↑ = older match,
 * Esc closes. Searches the history loaded so far.
 */
export function MessageSearchBar({ conversationId }: { conversationId: ConversationId }) {
  const query = useUiStore((s) => s.messageSearch?.query ?? '')
  const setQuery = useUiStore((s) => s.setMessageSearchQuery)
  const close = useUiStore((s) => s.closeMessageSearch)
  const { matches, position, prev, next, query: settled } = useMessageSearch(conversationId)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => inputRef.current?.focus(), [])

  const status = !settled.trim()
    ? ''
    : matches.length === 0
      ? 'No results'
      : `${position || matches.length} of ${matches.length}`

  return (
    <div role="search" className="bg-background flex items-center gap-2 border-b px-3 py-2">
      <InputGroup className="h-9 flex-1">
        <InputGroupAddon>
          <Search />
        </InputGroupAddon>
        <InputGroupInput
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search in this chat"
          aria-label="Search in this chat"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault()
              close()
            } else if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault()
              if (e.key === 'ArrowUp' || (e.key === 'Enter' && e.shiftKey)) prev()
              else next()
            }
          }}
        />
        <InputGroupAddon align="inline-end">
          <span aria-live="polite" className="text-muted-foreground text-xs tabular-nums">
            {status}
          </span>
        </InputGroupAddon>
      </InputGroup>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Previous (older) match"
        disabled={!matches.length}
        onClick={prev}
      >
        <ChevronUp />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Next (newer) match"
        disabled={!matches.length}
        onClick={next}
      >
        <ChevronDown />
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label="Close search" onClick={close}>
        <X />
      </Button>
    </div>
  )
}
