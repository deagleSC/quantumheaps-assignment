import { useEffect } from 'react'
import { connectionActions } from '@/store'

/** Follows the browser's online/offline events; listeners removed on unmount. */
export function useNetworkStatus() {
  useEffect(() => {
    connectionActions.init()
    const online = () => connectionActions.setBrowserOnline(true)
    const offline = () => connectionActions.setBrowserOnline(false)
    window.addEventListener('online', online)
    window.addEventListener('offline', offline)
    return () => {
      window.removeEventListener('online', online)
      window.removeEventListener('offline', offline)
    }
  }, [])
}
