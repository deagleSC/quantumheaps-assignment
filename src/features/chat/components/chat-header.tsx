import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { OnlineAvatar } from '@/shared/components/online-avatar'
import { Button } from '@/shared/components/ui/button'
import { formatLastSeen } from '@/shared/lib/format-time'
import {
  conversationActions,
  getConversationDisplay,
  getTypingLabel,
  useConversationStore,
  useTypingStore,
  useUiStore,
  useUserStore,
} from '@/store'
import type { ConversationId } from '@/types/common.types'

export interface ChatHeaderProps {
  conversationId: ConversationId
  /** Right-hand actions (search, info). */
  actions?: ReactNode
}

const EMPTY: string[] = []

export function ChatHeader({ conversationId, actions }: ChatHeaderProps) {
  const conversation = useConversationStore((s) => s.byId[conversationId])
  const typingIds = useTypingStore((s) => s.byConversation[conversationId] ?? EMPTY)
  // Only the users this header shows: the peer, group members and typists.
  const relevantIds = conversation
    ? conversation.type === 'direct'
      ? [conversation.participantId]
      : conversation.memberIds
    : EMPTY
  const users = useUserStore(
    useShallow((s) =>
      Object.fromEntries([...relevantIds, ...typingIds].map((id) => [id, s.byId[id]])),
    ),
  )
  const currentUserId = useUserStore((s) => s.currentUserId)
  const setInfoPanelOpen = useUiStore((s) => s.setInfoPanelOpen)

  if (!conversation) return null
  const usersById = Object.fromEntries(Object.entries(users).filter(([, u]) => u)) as Record<
    string,
    NonNullable<(typeof users)[string]>
  >
  const { title, avatarUrl, isOnline, peer } = getConversationDisplay(conversation, usersById)

  let subtitle: string
  const typing = getTypingLabel(typingIds, usersById)
  if (typing) {
    subtitle = conversation.type === 'direct' ? 'typing…' : typing
  } else if (conversation.type === 'direct') {
    subtitle = peer?.isOnline ? 'online' : formatLastSeen(peer?.lastSeen)
  } else {
    const online = conversation.memberIds.filter(
      (id) => id !== currentUserId && usersById[id]?.isOnline,
    ).length
    subtitle = `${conversation.memberIds.length} members${online ? `, ${online} online` : ''}`
  }

  return (
    <header className="bg-background/95 flex h-16 shrink-0 items-center gap-3 border-b px-3 backdrop-blur md:px-4">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        aria-label="Back to chats"
        onClick={conversationActions.close}
      >
        <ArrowLeft />
      </Button>
      <button
        type="button"
        onClick={() => setInfoPanelOpen(true)}
        aria-label={`Show ${conversation.type === 'group' ? 'group' : 'contact'} info`}
        className="hover:bg-accent/60 -mx-1 flex min-w-0 flex-1 items-center gap-3 rounded-lg px-1 py-1 text-left"
      >
        <OnlineAvatar name={title} src={avatarUrl} isOnline={isOnline} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate leading-tight font-semibold">{title}</h2>
          <p
            aria-live="polite"
            className={
              typing ? 'text-primary truncate text-xs' : 'text-muted-foreground truncate text-xs'
            }
          >
            {subtitle}
          </p>
        </div>
      </button>
      {actions}
    </header>
  )
}
