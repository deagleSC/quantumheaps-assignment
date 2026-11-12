import { format } from 'date-fns'
import { Info, X } from 'lucide-react'
import { OnlineAvatar } from '@/shared/components/online-avatar'
import { Button } from '@/shared/components/ui/button'
import { Separator } from '@/shared/components/ui/separator'
import { formatLastSeen } from '@/shared/lib/format-time'
import { useConversationStore, useUiStore, useUserStore } from '@/store'
import type { ConversationId } from '@/types/common.types'
import type { DirectConversation, GroupConversation } from '@/types/conversation.types'
import { AddMembersDialog } from './add-members-dialog'
import { MemberList } from './member-list'

function GroupInfo({ group }: { group: GroupConversation }) {
  const online = useUserStore(
    (s) => group.memberIds.filter((id) => id !== s.currentUserId && s.byId[id]?.isOnline).length,
  )
  return (
    <>
      <div className="flex flex-col items-center gap-2 px-6 py-6 text-center">
        <OnlineAvatar name={group.name} src={group.avatarUrl} size="xl" />
        <h3 className="text-lg font-semibold">{group.name}</h3>
        <p className="text-muted-foreground text-sm">
          Group · {group.memberIds.length} members{online > 0 ? `, ${online} online` : ''}
        </p>
      </div>
      {group.description && (
        <>
          <Separator />
          <section className="px-6 py-4">
            <h4 className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">
              About
            </h4>
            <p className="text-sm">{group.description}</p>
            <p className="text-muted-foreground mt-2 text-xs">
              Created {format(new Date(group.createdAt), 'd MMM yyyy')}
            </p>
          </section>
        </>
      )}
      <Separator />
      <section className="space-y-3 px-4 py-4">
        <h4 className="text-muted-foreground px-2 text-xs font-medium tracking-wide uppercase">
          {group.memberIds.length} members
        </h4>
        <div className="px-2">
          <AddMembersDialog group={group} />
        </div>
        <MemberList group={group} />
      </section>
    </>
  )
}

function ContactInfo({ conversation }: { conversation: DirectConversation }) {
  const peer = useUserStore((s) => s.byId[conversation.participantId])
  if (!peer) return null
  return (
    <>
      <div className="flex flex-col items-center gap-2 px-6 py-6 text-center">
        <OnlineAvatar name={peer.name} src={peer.avatarUrl} isOnline={peer.isOnline} size="xl" />
        <h3 className="text-lg font-semibold">{peer.name}</h3>
        <p className="text-muted-foreground text-sm">
          {peer.isOnline ? 'online' : formatLastSeen(peer.lastSeen)}
        </p>
      </div>
      {peer.about && (
        <>
          <Separator />
          <section className="px-6 py-4">
            <h4 className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">
              About
            </h4>
            <p className="text-sm">{peer.about}</p>
          </section>
        </>
      )}
    </>
  )
}

/** Panel body: group details and members, or the contact's profile. */
export function InfoPanelBody({ conversationId }: { conversationId: ConversationId }) {
  const conversation = useConversationStore((s) => s.byId[conversationId])
  if (!conversation) return null
  return conversation.type === 'group' ? (
    <GroupInfo group={conversation} />
  ) : (
    <ContactInfo conversation={conversation} />
  )
}

/** Desktop column version, with its own header and close button. */
export function InfoPanel({ conversationId }: { conversationId: ConversationId }) {
  const setOpen = useUiStore((s) => s.setInfoPanelOpen)
  const isGroup = useConversationStore((s) => s.byId[conversationId]?.type === 'group')
  return (
    <div className="bg-background flex h-full flex-col">
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <Info className="text-muted-foreground size-4" aria-hidden />
        <h2 className="flex-1 font-semibold">{isGroup ? 'Group info' : 'Contact info'}</h2>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Close info"
          onClick={() => setOpen(false)}
        >
          <X />
        </Button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <InfoPanelBody conversationId={conversationId} />
      </div>
    </div>
  )
}
