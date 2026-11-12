import { History, MoreVertical } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import { messageActions, useMessageStore } from '@/store'
import type { ConversationId } from '@/types/common.types'

/** Chat header overflow menu. */
export function ChatMenu({ conversationId }: { conversationId: ConversationId }) {
  const hasMore = useMessageStore((s) => s.byConversation[conversationId]?.hasMore ?? false)
  const loaded = useMessageStore((s) => s.byConversation[conversationId]?.ids.length ?? 0)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="More chat options">
          <MoreVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        <DropdownMenuItem
          disabled={!hasMore}
          onSelect={() => void messageActions.loadAll(conversationId)}
        >
          <History />
          {hasMore
            ? `Load entire history (${loaded.toLocaleString()} loaded)`
            : 'Entire history loaded'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
