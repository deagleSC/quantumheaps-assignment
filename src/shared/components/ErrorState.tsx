import { AlertTriangle, RotateCw } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { EmptyState } from './EmptyState'

export interface ErrorStateProps {
  title?: string
  description?: string
  onRetry?: () => void
  className?: string
}

export function ErrorState({
  title = 'Something went wrong',
  description = 'Please try again.',
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div role="alert" className={className}>
      <EmptyState
        icon={AlertTriangle}
        title={title}
        description={description}
        action={
          onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry}>
              <RotateCw /> Retry
            </Button>
          )
        }
      />
    </div>
  )
}
