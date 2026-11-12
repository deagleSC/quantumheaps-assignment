import { ChatView } from '@/features/chat/components/chat-view'
import { WelcomePane } from '@/features/chat/components/welcome-pane'
import { ConversationSidebar } from '@/features/conversations/components/conversation-sidebar'
import { cn } from '@/shared/lib/utils'
import { useUiStore } from '@/store'

/**
 * Responsive shell, driven by CSS breakpoints (no JS measuring):
 * - mobile (<768px): one pane at a time; opening a chat replaces the list
 * - tablet (768px+): sidebar (320px) + chat
 * - desktop (1024px+): wider sidebar (384px) + chat
 */
export function AppLayout() {
  const activeId = useUiStore((s) => s.activeConversationId)

  return (
    <div className="flex h-dvh overflow-hidden">
      <aside
        aria-label="Chat list"
        className={cn(
          'w-full shrink-0 flex-col border-r md:flex md:w-80 lg:w-96',
          activeId ? 'hidden' : 'flex',
        )}
      >
        <ConversationSidebar />
      </aside>
      <main className={cn('min-w-0 flex-1 flex-col md:flex', activeId ? 'flex' : 'hidden')}>
        {activeId ? <ChatView key={activeId} conversationId={activeId} /> : <WelcomePane />}
      </main>
    </div>
  )
}
