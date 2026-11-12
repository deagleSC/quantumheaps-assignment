import { UserMinus } from 'lucide-react'
import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { OnlineAvatar } from '@/shared/components/online-avatar'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog'
import { Badge } from '@/shared/components/ui/badge'
import { Button, buttonVariants } from '@/shared/components/ui/button'
import { formatLastSeen } from '@/shared/lib/format-time'
import { handleError } from '@/shared/lib/handle-error'
import { notify } from '@/shared/lib/notify'
import { groupActions, useUserStore } from '@/store'
import type { GroupConversation } from '@/types/conversation.types'
import type { User } from '@/types/user.types'
import { sortMembers } from '../utils/sort-members'

export function MemberList({ group }: { group: GroupConversation }) {
  const currentUserId = useUserStore((s) => s.currentUserId)
  const users = useUserStore(
    useShallow((s) => Object.fromEntries(group.memberIds.map((id) => [id, s.byId[id]]))),
  )
  const [removing, setRemoving] = useState<User | null>(null)

  const known = Object.fromEntries(Object.entries(users).filter(([, u]) => u)) as Record<
    string,
    User
  >
  const members = sortMembers(group.memberIds, group.adminIds, known, currentUserId)

  const confirmRemove = async () => {
    if (!removing) return
    try {
      await groupActions.removeMember(group.id, removing.id)
      notify.success(`Removed ${removing.name}`)
    } catch (error) {
      notify.error(handleError(error))
    }
  }

  return (
    <>
      <ul aria-label="Members" className="space-y-0.5">
        {members.map(({ user, isAdmin, isYou }) => (
          <li
            key={user.id}
            className="group/member hover:bg-accent flex items-center gap-3 rounded-lg px-2 py-2"
          >
            <OnlineAvatar
              name={user.name}
              src={user.avatarUrl}
              isOnline={user.isOnline}
              size="sm"
            />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                {isYou ? 'You' : user.name}
                {isAdmin && (
                  <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                    Admin
                  </Badge>
                )}
              </p>
              <p className="text-muted-foreground truncate text-xs">
                {user.isOnline ? 'online' : formatLastSeen(user.lastSeen)}
              </p>
            </div>
            {!isYou && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${user.name}`}
                className="text-muted-foreground opacity-0 group-hover/member:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
                onClick={() => setRemoving(user)}
              >
                <UserMinus />
              </Button>
            )}
          </li>
        ))}
      </ul>

      <AlertDialog open={!!removing} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removing?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              They will no longer see new messages in {group.name}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: 'destructive' })}
              onClick={() => void confirmRemove()}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
