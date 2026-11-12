import { MessagesSquare } from 'lucide-react'
import { EmptyState } from '@/shared/components/empty-state'

/** Shown on tablet and desktop when no chat is selected. */
export function WelcomePane() {
  return (
    <div className="bg-chat-bg flex h-full items-center justify-center">
      <EmptyState
        icon={MessagesSquare}
        title="Quantum Chat"
        description="Pick a conversation to start messaging."
      />
    </div>
  )
}
