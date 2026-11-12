import { Info, Paperclip, Search } from 'lucide-react'
import { useRef, useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { notify } from '@/shared/lib/notify'
import { useUiStore } from '@/store'
import type { ConversationId } from '@/types/common.types'
import { useAttachment } from '../hooks/use-attachment'
import { ChatHeader } from './chat-header'
import { ChatMenu } from './chat-menu'
import { MessageComposer } from './message-composer'
import { MessageList } from './message-list'
import { MessageSearchBar } from './message-search-bar'

const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files')

/** The open conversation: header, scrolling messages and composer. Files can be dropped anywhere on it. */
export function ChatView({ conversationId }: { conversationId: ConversationId }) {
  const isInfoOpen = useUiStore((s) => s.isInfoPanelOpen)
  const setInfoOpen = useUiStore((s) => s.setInfoPanelOpen)
  const isSearchOpen = useUiStore((s) => !!s.messageSearch)
  const openSearch = useUiStore((s) => s.openMessageSearch)
  const closeSearch = useUiStore((s) => s.closeMessageSearch)
  const isEditing = useUiStore((s) => !!s.editingId)
  const attachment = useAttachment({ onError: notify.error })
  const [dragging, setDragging] = useState(false)
  // dragenter/dragleave fire for every child; count them to know when we really left.
  const dragDepth = useRef(0)

  return (
    <div
      className="relative flex h-full min-h-0 flex-col"
      onDragEnter={(e) => {
        if (!hasFiles(e) || isEditing) return
        e.preventDefault()
        dragDepth.current += 1
        setDragging(true)
      }}
      onDragOver={(e) => {
        if (hasFiles(e) && !isEditing) e.preventDefault()
      }}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1)
        if (dragDepth.current === 0) setDragging(false)
      }}
      onDrop={(e) => {
        if (!hasFiles(e) || isEditing) return
        e.preventDefault()
        dragDepth.current = 0
        setDragging(false)
        attachment.select(e.dataTransfer.files[0])
      }}
    >
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
            <ChatMenu conversationId={conversationId} />
          </>
        }
      />
      {isSearchOpen && <MessageSearchBar conversationId={conversationId} />}
      <MessageList conversationId={conversationId} />
      <MessageComposer conversationId={conversationId} attachment={attachment} />
      {dragging && (
        <div
          aria-hidden
          className="bg-background/80 border-primary text-primary pointer-events-none absolute inset-2 z-30 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed backdrop-blur-sm"
        >
          <Paperclip className="size-8" />
          <p className="font-medium">Drop to attach</p>
        </div>
      )}
    </div>
  )
}
