import { MessageSquareDashed } from 'lucide-react'
import { EmptyState } from '@/shared/components/empty-state'
import type { ConversationId } from '@/types/common.types'
import { ChatHeader } from './chat-header'

/** The open conversation. The message list and composer arrive in Phase 5. */
export function ChatView({ conversationId }: { conversationId: ConversationId }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <ChatHeader conversationId={conversationId} />
      <div className="bg-chat-bg flex flex-1 items-center justify-center">
        <EmptyState icon={MessageSquareDashed} title="Messages are coming soon" />
      </div>
    </div>
  )
}
