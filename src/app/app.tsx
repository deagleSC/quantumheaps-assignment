import { useEffect } from 'react'
import { ThemeToggle } from '@/features/theme/components/theme-toggle'
import { useApplyTheme } from '@/features/theme/hooks/use-theme'
import { Toaster } from '@/shared/components/ui/sonner'
import { TooltipProvider } from '@/shared/components/ui/tooltip'
import { conversationActions } from '@/store'
import { AppLayout } from './app-layout'
import { useUnreadDocumentTitle } from './hooks/use-document-title'
import { useGlobalShortcuts } from './hooks/use-global-shortcuts'
import { useNetworkStatus } from './hooks/use-network-status'
import { useRealtimeBridge } from './hooks/use-realtime-bridge'
import { OfflineBanner } from './offline-banner'
import { SettingsMenu } from './settings-menu'
import { ShortcutsDialog } from './shortcuts-dialog'

function SidebarActions() {
  return (
    <>
      <SettingsMenu />
      <ThemeToggle />
    </>
  )
}

export function App() {
  useEffect(() => {
    void conversationActions.loadInbox()
  }, [])
  useRealtimeBridge()
  useGlobalShortcuts()
  useUnreadDocumentTitle()
  useNetworkStatus()
  const theme = useApplyTheme()

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-dvh flex-col">
        <OfflineBanner />
        <AppLayout sidebarActions={<SidebarActions />} />
      </div>
      <ShortcutsDialog />
      <Toaster theme={theme} position="bottom-right" />
    </TooltipProvider>
  )
}
