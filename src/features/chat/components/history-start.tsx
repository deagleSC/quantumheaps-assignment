import { History } from 'lucide-react'
import { Spinner } from '@/shared/components/spinner'
import { Button } from '@/shared/components/ui/button'
import { messageActions } from '@/store'
import type { AsyncStatus, ConversationId } from '@/types/common.types'

export interface HistoryStartProps {
  conversationId: ConversationId
  hasMore: boolean
  status: AsyncStatus
}

/**
 * Top of the message list. Scrolling up loads older messages automatically;
 * this row shows the spinner, a button for keyboard users (or to retry), or
 * "Start of conversation". "Load entire history" lives in the chat menu,
 * because this row scrolls away as soon as a page is prepended.
 */
export function HistoryStart({ conversationId, hasMore, status }: HistoryStartProps) {
  if (status === 'loading') {
    return (
      <div className="flex justify-center py-3">
        <Spinner label="Loading older messages" />
      </div>
    )
  }
  if (!hasMore) {
    return (
      <p className="text-muted-foreground flex items-center justify-center gap-1.5 py-3 text-xs">
        <History className="size-3.5" aria-hidden /> Start of conversation
      </p>
    )
  }
  return (
    <div className="flex justify-center py-3">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-xs"
        onClick={() => void messageActions.loadOlder(conversationId)}
      >
        {status === 'error' ? 'Retry loading older messages' : 'Load older messages'}
      </Button>
    </div>
  )
}
