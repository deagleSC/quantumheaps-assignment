import { useEffect } from 'react'
import { realtimeActions } from '@/store'

/** Mount once at the app root: connects realtime events and disconnects on unmount. */
export function useRealtimeBridge(enabled = true) {
  useEffect(() => {
    if (!enabled) return
    return realtimeActions.connect()
  }, [enabled])
}
