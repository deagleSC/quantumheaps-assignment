import { MessagesSquare } from 'lucide-react'
import { EmptyState } from '@/shared/components/empty-state'
import { TooltipProvider } from '@/shared/components/ui/tooltip'
import { Toaster } from '@/shared/components/ui/sonner'

/** App shell. Layout, sidebar and chat window arrive in Phases 4–5. */
export function App() {
  return (
    <TooltipProvider delayDuration={300}>
      <main className="bg-chat-bg flex h-full items-center justify-center">
        <EmptyState
          icon={MessagesSquare}
          title="Quantum Chat"
          description="Project foundations are ready."
        />
      </main>
      <Toaster />
    </TooltipProvider>
  )
}
