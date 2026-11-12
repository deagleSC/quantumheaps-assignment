import { ChatView } from '@/features/chat/components/chat-view'
import { WelcomePane } from '@/features/chat/components/welcome-pane'
import { ConversationSidebar } from '@/features/conversations/components/conversation-sidebar'
import { InfoPanel } from '@/features/groups/components/info-panel'
import { InfoSheet } from '@/features/groups/components/info-sheet'
import { DESKTOP_QUERY, useMediaQuery } from '@/shared/hooks/use-media-query'
import { cn } from '@/shared/lib/utils'
import { useUiStore } from '@/store'

/**
 * Responsive shell:
 * - mobile (<768px): one pane at a time; opening a chat replaces the list
 * - tablet (768px+): sidebar (320px) + chat; info opens as a drawer
 * - desktop (1024px+): wider sidebar (384px) + chat + info as a third column
 */
export function AppLayout() {
  const activeId = useUiStore((s) => s.activeConversationId)
  const isInfoOpen = useUiStore((s) => s.isInfoPanelOpen)
  const isDesktop = useMediaQuery(DESKTOP_QUERY)

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
      {activeId &&
        (isDesktop ? (
          isInfoOpen && (
            <aside aria-label="Info" className="w-80 shrink-0 border-l xl:w-96">
              <InfoPanel conversationId={activeId} />
            </aside>
          )
        ) : (
          <InfoSheet conversationId={activeId} />
        ))}
    </div>
  )
}
