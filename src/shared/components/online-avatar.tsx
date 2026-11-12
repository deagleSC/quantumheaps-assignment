import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar'
import { getInitials } from '@/shared/lib/initials'
import { cn } from '@/shared/lib/utils'

const sizes = {
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-12 text-base',
  xl: 'size-20 text-xl',
} as const

const dotSizes = {
  sm: 'size-2.5',
  md: 'size-3',
  lg: 'size-3.5',
  xl: 'size-4',
} as const

export interface OnlineAvatarProps {
  name: string
  src?: string
  /** `undefined` hides the presence dot (e.g. for groups). */
  isOnline?: boolean
  size?: keyof typeof sizes
  className?: string
}

/** shadcn Avatar with an initials fallback and an optional presence dot. */
export function OnlineAvatar({ name, src, isOnline, size = 'md', className }: OnlineAvatarProps) {
  return (
    <div className={cn('relative shrink-0', className)}>
      <Avatar className={sizes[size]}>
        {src ? <AvatarImage src={src} alt={name} /> : null}
        <AvatarFallback className="bg-primary/10 text-primary font-medium">
          {getInitials(name)}
        </AvatarFallback>
      </Avatar>
      {isOnline !== undefined && (
        <span
          role="status"
          aria-label={isOnline ? 'Online' : 'Offline'}
          className={cn(
            'ring-background absolute right-0 bottom-0 rounded-full ring-2',
            dotSizes[size],
            isOnline ? 'bg-online' : 'bg-muted-foreground/40',
          )}
        />
      )}
    </div>
  )
}
