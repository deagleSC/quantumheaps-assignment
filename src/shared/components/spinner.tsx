import { Spinner as BaseSpinner } from '@/shared/components/ui/spinner'
import { cn } from '@/shared/lib/utils'

/** shadcn Spinner with a screen-reader label. */
export function Spinner({ className, label = 'Loading' }: { className?: string; label?: string }) {
  return (
    <BaseSpinner aria-label={label} className={cn('text-muted-foreground size-5', className)} />
  )
}
