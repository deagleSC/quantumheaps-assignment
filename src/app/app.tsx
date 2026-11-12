import { useEffect } from 'react'
import { TooltipProvider } from '@/shared/components/ui/tooltip'
import { Toaster } from '@/shared/components/ui/sonner'
import { conversationActions } from '@/store'
import { AppLayout } from './app-layout'
import { useRealtimeBridge } from './hooks/use-realtime-bridge'

export function App() {
  useEffect(() => {
    void conversationActions.loadInbox()
  }, [])
  useRealtimeBridge()

  return (
    <TooltipProvider delayDuration={300}>
      <AppLayout />
      <Toaster />
    </TooltipProvider>
  )
}
