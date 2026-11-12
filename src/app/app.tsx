import { Keyboard } from 'lucide-react'
import { useEffect } from 'react'
import { ThemeToggle } from '@/features/theme/components/theme-toggle'
import { useApplyTheme } from '@/features/theme/hooks/use-theme'
import { Button } from '@/shared/components/ui/button'
import { Toaster } from '@/shared/components/ui/sonner'
import { TooltipProvider } from '@/shared/components/ui/tooltip'
import { conversationActions, useUiStore } from '@/store'
import { AppLayout } from './app-layout'
import { useUnreadDocumentTitle } from './hooks/use-document-title'
import { useGlobalShortcuts } from './hooks/use-global-shortcuts'
import { useRealtimeBridge } from './hooks/use-realtime-bridge'
import { ShortcutsDialog } from './shortcuts-dialog'

function SidebarActions() {
  const setShortcutsOpen = useUiStore((s) => s.setShortcutsOpen)
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Keyboard shortcuts"
        className="hidden md:inline-flex"
        onClick={() => setShortcutsOpen(true)}
      >
        <Keyboard />
      </Button>
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
  const theme = useApplyTheme()

  return (
    <TooltipProvider delayDuration={300}>
      <AppLayout sidebarActions={<SidebarActions />} />
      <ShortcutsDialog />
      <Toaster theme={theme} position="bottom-right" />
    </TooltipProvider>
  )
}
