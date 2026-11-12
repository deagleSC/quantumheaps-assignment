import { AlertCircle, Check, CheckCheck, Clock, CloudOff } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import type { MessageStatus } from '@/types/message.types'

const CONFIG: Record<MessageStatus, { Icon: typeof Check; label: string; className?: string }> = {
  queued: { Icon: CloudOff, label: 'Queued: sends when you are back online' },
  sending: { Icon: Clock, label: 'Sending' },
  sent: { Icon: Check, label: 'Sent' },
  delivered: { Icon: CheckCheck, label: 'Delivered' },
  read: { Icon: CheckCheck, label: 'Read', className: 'text-status-read' },
  failed: { Icon: AlertCircle, label: 'Failed to send', className: 'text-destructive' },
}

/** Delivery ticks: clock → ✓ → ✓✓ → blue ✓✓, or a red alert when failed. */
export function MessageStatusIcon({
  status,
  className,
}: {
  status: MessageStatus
  className?: string
}) {
  const { Icon, label, className: tone } = CONFIG[status]
  return (
    <span role="img" aria-label={label} title={label} className="inline-flex">
      <Icon className={cn('size-3.5', tone, className)} aria-hidden />
    </span>
  )
}
