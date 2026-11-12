import { Info } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { useUiStore } from '@/store'
import type { ConversationId } from '@/types/common.types'
import { ChatHeader } from './chat-header'
import { MessageComposer } from './message-composer'
import { MessageList } from './message-list'

/** The open conversation: header, scrolling messages and composer. */
export function ChatView({ conversationId }: { conversationId: ConversationId }) {
  const isInfoOpen = useUiStore((s) => s.isInfoPanelOpen)
  const setInfoOpen = useUiStore((s) => s.setInfoPanelOpen)
  return (
    <div className="flex h-full min-h-0 flex-col">
      <ChatHeader
        conversationId={conversationId}
        actions={
          <Button
            variant={isInfoOpen ? 'secondary' : 'ghost'}
            size="icon"
            aria-label="Toggle info panel"
            aria-pressed={isInfoOpen}
            onClick={() => setInfoOpen(!isInfoOpen)}
          >
            <Info />
          </Button>
        }
      />
      <MessageList conversationId={conversationId} />
      <MessageComposer conversationId={conversationId} />
    </div>
  )
}
