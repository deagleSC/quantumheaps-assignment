import { CloudOff, Keyboard, RotateCcw, Settings } from 'lucide-react'
import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog'
import { Button, buttonVariants } from '@/shared/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import {
  appActions,
  connectionActions,
  realtimeActions,
  useConnectionStore,
  useUiStore,
} from '@/store'

/** Sidebar settings: shortcuts help and demo controls. */
export function SettingsMenu() {
  const setShortcutsOpen = useUiStore((s) => s.setShortcutsOpen)
  const [confirmReset, setConfirmReset] = useState(false)
  const simulatedOffline = useConnectionStore((s) => s.isSimulatedOffline)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Settings">
            <Settings />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56">
          <DropdownMenuItem onSelect={() => setShortcutsOpen(true)}>
            <Keyboard /> Keyboard shortcuts
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
            Demo
          </DropdownMenuLabel>
          <DropdownMenuCheckboxItem
            checked={simulatedOffline}
            onCheckedChange={(checked) => connectionActions.setSimulatedOffline(checked === true)}
          >
            <CloudOff /> Simulate offline
          </DropdownMenuCheckboxItem>
          <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
            Realtime:{' '}
            {realtimeActions.transportKind() === 'websocket' ? 'WebSocket' : 'in-memory simulator'}
          </DropdownMenuLabel>
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirmReset(true)}>
            <RotateCcw /> Reset demo data…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset demo data?</AlertDialogTitle>
            <AlertDialogDescription>
              Messages you sent, edits, reactions and member changes are saved in this browser.
              Resetting deletes them and reloads the app with fresh sample chats.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: 'destructive' })}
              onClick={() => void appActions.resetDemoData()}
            >
              Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
