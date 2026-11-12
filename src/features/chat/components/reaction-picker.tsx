import { SmilePlus } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'
import { QUICK_REACTIONS } from '@/shared/lib/reactions'
import { cn } from '@/shared/lib/utils'

export interface ReactionPickerProps {
  /** Emojis the current user has already used on this message (highlighted). */
  selected: string[]
  onPick: (emoji: string) => void
  align?: 'start' | 'end'
  triggerClassName?: string
}

/** Smiley button that opens the six quick reactions. */
export function ReactionPicker({
  selected,
  onPick,
  align = 'end',
  triggerClassName,
}: ReactionPickerProps) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Add reaction"
          className={triggerClassName}
        >
          <SmilePlus />
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} side="top" className="w-auto rounded-full p-1">
        <div role="group" aria-label="Quick reactions" className="flex gap-0.5">
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              aria-label={`React with ${emoji}`}
              aria-pressed={selected.includes(emoji)}
              onClick={() => {
                onPick(emoji)
                setOpen(false)
              }}
              className={cn(
                'flex size-9 items-center justify-center rounded-full text-xl transition-transform hover:scale-125 focus-visible:scale-125 focus-visible:outline-none',
                selected.includes(emoji) && 'bg-primary/15',
              )}
            >
              {emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
