import { Loader2 } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

export function Spinner({ className, label = 'Loading' }: { className?: string; label?: string }) {
  return (
    <span role="status" aria-label={label} className="inline-flex">
      <Loader2 className={cn('text-muted-foreground size-5 animate-spin', className)} />
    </span>
  )
}
