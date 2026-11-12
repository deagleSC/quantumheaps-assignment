import { zodResolver } from '@hookform/resolvers/zod'
import { Check, UserPlus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { useShallow } from 'zustand/react/shallow'
import { OnlineAvatar } from '@/shared/components/online-avatar'
import { Spinner } from '@/shared/components/spinner'
import { Button } from '@/shared/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/shared/components/ui/command'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/shared/components/ui/form'
import { handleError } from '@/shared/lib/handle-error'
import { notify } from '@/shared/lib/notify'
import { cn } from '@/shared/lib/utils'
import { groupActions, useUserStore } from '@/store'
import type { GroupConversation } from '@/types/conversation.types'

const schema = z.object({
  userIds: z.array(z.string()).min(1, 'Pick at least one person to add'),
})
type AddMembersValues = z.infer<typeof schema>

/** Searchable multi-select of people who aren't in the group yet. */
export function AddMembersDialog({ group }: { group: GroupConversation }) {
  const [open, setOpen] = useState(false)
  const candidates = useUserStore(
    useShallow((s) =>
      Object.values(s.byId)
        .filter((u) => u.id !== s.currentUserId && !group.memberIds.includes(u.id))
        .sort((a, b) => a.name.localeCompare(b.name)),
    ),
  )

  const form = useForm<AddMembersValues>({
    resolver: zodResolver(schema),
    defaultValues: { userIds: [] },
  })
  const selected = form.watch('userIds')
  const names = useMemo(
    () => candidates.filter((u) => selected.includes(u.id)).map((u) => u.name.split(' ')[0]),
    [candidates, selected],
  )

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) form.reset()
  }

  const onSubmit = form.handleSubmit(async ({ userIds }) => {
    try {
      await groupActions.addMembers(group.id, userIds)
      notify.success(userIds.length === 1 ? 'Member added' : `${userIds.length} members added`)
      onOpenChange(false)
    } catch (error) {
      form.setError('root', { message: handleError(error) })
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full">
          <UserPlus /> Add members
        </Button>
      </DialogTrigger>
      <DialogContent className="gap-4 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add members</DialogTitle>
          <DialogDescription>Add people to {group.name}.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="userIds"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Command className="rounded-lg border">
                      <CommandInput placeholder="Search people" aria-label="Search people" />
                      <CommandList className="max-h-64">
                        <CommandEmpty>
                          {candidates.length === 0
                            ? 'Everyone is already in this group.'
                            : 'No one found.'}
                        </CommandEmpty>
                        <CommandGroup>
                          {candidates.map((user) => {
                            const isSelected = field.value.includes(user.id)
                            return (
                              <CommandItem
                                key={user.id}
                                value={`${user.name} ${user.id}`}
                                aria-selected={isSelected}
                                data-checked={isSelected}
                                onSelect={() =>
                                  field.onChange(
                                    isSelected
                                      ? field.value.filter((id) => id !== user.id)
                                      : [...field.value, user.id],
                                  )
                                }
                              >
                                <OnlineAvatar
                                  name={user.name}
                                  src={user.avatarUrl}
                                  isOnline={user.isOnline}
                                  size="sm"
                                />
                                <span className="flex-1">{user.name}</span>
                                <span
                                  className={cn(
                                    'flex size-5 items-center justify-center rounded-full border',
                                    isSelected &&
                                      'bg-primary border-primary text-primary-foreground',
                                  )}
                                  aria-hidden
                                >
                                  {isSelected && <Check className="size-3.5" />}
                                </span>
                              </CommandItem>
                            )
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {form.formState.errors.root && (
              <p role="alert" className="text-destructive text-sm">
                {form.formState.errors.root.message}
              </p>
            )}
            <DialogFooter className="items-center sm:justify-between">
              <p className="text-muted-foreground truncate text-sm" aria-live="polite">
                {names.length > 0 ? `Selected: ${names.join(', ')}` : 'No one selected'}
              </p>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && (
                  <Spinner className="text-primary-foreground size-4" />
                )}
                Add{selected.length > 0 ? ` (${selected.length})` : ''}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
