import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip'
import { cn } from '@/shared/lib/utils'
import { useUserStore } from '@/store'
import type { UserId } from '@/types/common.types'
import type { Reaction } from '@/types/message.types'

export interface ReactionChipsProps {
  reactions: Reaction[]
  onToggle: (emoji: string) => void
  align: 'start' | 'end'
  disabled?: boolean
}

function useReactorNames(userIds: UserId[]) {
  return useUserStore((s) =>
    userIds
      .map((id) => (id === s.currentUserId ? 'You' : (s.byId[id]?.name.split(' ')[0] ?? 'Someone')))
      .join(', '),
  )
}

function Chip({
  reaction,
  onToggle,
  disabled,
}: { reaction: Reaction } & Pick<ReactionChipsProps, 'onToggle' | 'disabled'>) {
  const names = useReactorNames(reaction.userIds)
  const mine = useUserStore((s) => !!s.currentUserId && reaction.userIds.includes(s.currentUserId))
  const count = reaction.userIds.length
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onToggle(reaction.emoji)}
          aria-pressed={mine}
          aria-label={`${reaction.emoji} ${count}: ${names}`}
          className={cn(
            'bg-background flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-xs shadow-(--bubble-shadow) transition-colors',
            'hover:bg-foreground/5 disabled:pointer-events-none',
            mine && 'border-primary/50 bg-primary/10',
          )}
        >
          {reaction.emoji}
          {count > 1 && <span className="text-muted-foreground font-medium">{count}</span>}
        </button>
      </TooltipTrigger>
      <TooltipContent>{names}</TooltipContent>
    </Tooltip>
  )
}

/** Reaction counts under a bubble. Click toggles your own; hover shows who reacted. */
export function ReactionChips({ reactions, onToggle, align, disabled }: ReactionChipsProps) {
  if (reactions.length === 0) return null
  return (
    <div
      className={cn(
        'relative z-[1] -mt-1.5 flex flex-wrap gap-1',
        align === 'end' ? 'justify-end pr-2' : 'pl-2',
      )}
    >
      {reactions.map((r) => (
        <Chip key={r.emoji} reaction={r} onToggle={onToggle} disabled={disabled} />
      ))}
    </div>
  )
}
