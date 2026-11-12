import { CloudOff } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { connectionActions, selectIsOnline, useConnectionStore, useOutboxStore } from '@/store'

/** App-wide strip shown while offline, with the outbox size. */
export function OfflineBanner() {
  const isOnline = useConnectionStore(selectIsOnline)
  const simulated = useConnectionStore((s) => s.isSimulatedOffline)
  const queued = useOutboxStore((s) => s.queue.length)
  if (isOnline) return null

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-amber-100 px-3 py-1.5 text-center text-sm text-amber-950 dark:bg-amber-950 dark:text-amber-100"
    >
      <CloudOff className="size-4 shrink-0" aria-hidden />
      <span>
        You&apos;re offline.{' '}
        {queued > 0
          ? `${queued} ${queued === 1 ? 'message' : 'messages'} will be sent when you reconnect.`
          : 'Messages you send will be queued.'}
      </span>
      {simulated && (
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0 text-current underline"
          onClick={() => connectionActions.setSimulatedOffline(false)}
        >
          Go back online
        </Button>
      )}
    </div>
  )
}
