import { Info, Search } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { useUiStore } from '@/store'
import type { ConversationId } from '@/types/common.types'
import { ChatHeader } from './chat-header'
import { MessageComposer } from './message-composer'
import { MessageList } from './message-list'
import { MessageSearchBar } from './message-search-bar'

/** The open conversation: header, scrolling messages and composer. */
export function ChatView({ conversationId }: { conversationId: ConversationId }) {
  const isInfoOpen = useUiStore((s) => s.isInfoPanelOpen)
  const setInfoOpen = useUiStore((s) => s.setInfoPanelOpen)
  const isSearchOpen = useUiStore((s) => !!s.messageSearch)
  const openSearch = useUiStore((s) => s.openMessageSearch)
  const closeSearch = useUiStore((s) => s.closeMessageSearch)
  return (
    <div className="flex h-full min-h-0 flex-col">
      <ChatHeader
        conversationId={conversationId}
        actions={
          <>
            <Button
              variant={isSearchOpen ? 'secondary' : 'ghost'}
              size="icon"
              aria-label="Search in this chat"
              aria-pressed={isSearchOpen}
              onClick={() => (isSearchOpen ? closeSearch() : openSearch())}
            >
              <Search />
            </Button>
            <Button
              variant={isInfoOpen ? 'secondary' : 'ghost'}
              size="icon"
              aria-label="Toggle info panel"
              aria-pressed={isInfoOpen}
              onClick={() => setInfoOpen(!isInfoOpen)}
            >
              <Info />
            </Button>
          </>
        }
      />
      {isSearchOpen && <MessageSearchBar conversationId={conversationId} />}
      <MessageList conversationId={conversationId} />
      <MessageComposer conversationId={conversationId} />
    </div>
  )
}
