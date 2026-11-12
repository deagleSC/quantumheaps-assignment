import { Copy, MoreHorizontal, Pencil, Reply, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import { useCopyToClipboard } from '@/shared/hooks/use-copy-to-clipboard'
import { cn } from '@/shared/lib/utils'
import { messageActions, useUiStore } from '@/store'
import type { Message } from '@/types/message.types'
import { getMessagePermissions } from '../utils/message-permissions'
import { DeleteMessageDialog } from './delete-message-dialog'
import { ReactionPicker } from './reaction-picker'

export interface MessageActionsProps {
  message: Message
  isOwn: boolean
  currentUserId: string | null
  /** Controlled by the bubble so long-press / right-click can open it. */
  menuOpen: boolean
  onMenuOpenChange: (open: boolean) => void
}

/**
 * Hover toolbar (react + more) next to a bubble. Visible on hover/focus for
 * mouse users; on touch the menu opens via long-press instead.
 */
export function MessageActions({
  message,
  isOwn,
  currentUserId,
  menuOpen,
  onMenuOpenChange,
}: MessageActionsProps) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const setReplyingTo = useUiStore((s) => s.setReplyingTo)
  const setEditing = useUiStore((s) => s.setEditing)
  const copy = useCopyToClipboard()
  // Reply/Edit move focus to the composer; stop the menu from pulling it back
  // to its trigger when it closes.
  const focusMovesToComposer = useRef(false)
  const can = getMessagePermissions(message, isOwn)

  if (message.kind === 'system' || !Object.values(can).some(Boolean)) return null

  const myReactions = currentUserId
    ? message.reactions.filter((r) => r.userIds.includes(currentUserId)).map((r) => r.emoji)
    : []

  return (
    <div
      className={cn(
        'flex shrink-0 items-center self-center opacity-0 transition-opacity',
        'group-hover/message:opacity-100 focus-within:opacity-100',
        menuOpen && 'opacity-100',
        // Touch devices: keep it out of the way (long-press opens the menu).
        '[@media(hover:none)]:pointer-events-none [@media(hover:none)]:w-0 [@media(hover:none)]:overflow-hidden',
        isOwn ? 'order-first flex-row-reverse' : '',
      )}
    >
      {can.canReact && (
        <ReactionPicker
          selected={myReactions}
          onPick={(emoji) => void messageActions.toggleReaction(message.id, emoji)}
          align={isOwn ? 'end' : 'start'}
          triggerClassName="text-muted-foreground size-7"
        />
      )}
      <DropdownMenu open={menuOpen} onOpenChange={onMenuOpenChange} modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Message actions"
            className="text-muted-foreground size-7"
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align={isOwn ? 'end' : 'start'}
          className="min-w-40"
          onCloseAutoFocus={(e) => {
            if (focusMovesToComposer.current) e.preventDefault()
            focusMovesToComposer.current = false
          }}
        >
          {can.canReply && (
            <DropdownMenuItem
              onSelect={() => {
                focusMovesToComposer.current = true
                setReplyingTo(message.id)
              }}
            >
              <Reply /> Reply
            </DropdownMenuItem>
          )}
          {can.canCopy && (
            <DropdownMenuItem onSelect={() => void copy(message.content)}>
              <Copy /> Copy text
            </DropdownMenuItem>
          )}
          {can.canEdit && (
            <DropdownMenuItem
              onSelect={() => {
                focusMovesToComposer.current = true
                setEditing(message.id)
              }}
            >
              <Pencil /> Edit
            </DropdownMenuItem>
          )}
          {can.canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)}>
                <Trash2 /> Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {confirmDelete && (
        <DeleteMessageDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          onConfirm={() => void messageActions.remove(message.id)}
        />
      )}
    </div>
  )
}
