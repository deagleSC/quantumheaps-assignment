import type { ConversationId } from '@/types/common.types'
import { ChatHeader } from './chat-header'
import { MessageComposer } from './message-composer'
import { MessageList } from './message-list'

/** The open conversation: header, scrolling messages and composer. */
export function ChatView({ conversationId }: { conversationId: ConversationId }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <ChatHeader conversationId={conversationId} />
      <MessageList conversationId={conversationId} />
      <MessageComposer conversationId={conversationId} />
    </div>
  )
}
