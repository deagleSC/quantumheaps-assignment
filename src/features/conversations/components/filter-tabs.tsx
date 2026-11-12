import type { ReactNode } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { cn } from '@/shared/lib/utils'
import { useConversationStore, useUiStore } from '@/store'
import type { ConversationFilter } from '@/types/conversation.types'

const FILTERS: { value: ConversationFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'groups', label: 'Groups' },
]

export interface FilterTabsProps {
  /** Rendered above the tab list (the search box). */
  header?: ReactNode
  /** The tab panel: the filtered chat list. */
  children: ReactNode
  className?: string
}

/**
 * All / Unread / Groups. The chat list is the tab panel, so each tab's
 * `aria-controls` points at a real element. The Unread tab shows how many
 * chats have unread messages.
 */
export function FilterTabs({ header, children, className }: FilterTabsProps) {
  const filter = useUiStore((s) => s.filter)
  const setFilter = useUiStore((s) => s.setFilter)
  const unreadChats = useConversationStore(
    (s) => Object.values(s.byId).filter((c) => c.unreadCount > 0).length,
  )

  return (
    <Tabs
      value={filter}
      onValueChange={(v) => setFilter(v as ConversationFilter)}
      className={cn('min-h-0 flex-1 gap-0', className)}
    >
      <div className="space-y-3 px-4 pb-3">
        {header}
        <TabsList className="w-full" aria-label="Filter chats">
          {/* No focus ring: tabs select on focus, so the active pill already marks focus. */}
          {FILTERS.map(({ value, label }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="text-muted-foreground gap-1.5 focus-visible:border-transparent focus-visible:ring-0 focus-visible:outline-none"
            >
              {label}
              {value === 'unread' && unreadChats > 0 && (
                <span className="bg-primary text-primary-foreground rounded-full px-1.5 text-[10px] leading-4 font-semibold">
                  {unreadChats}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      <TabsContent value={filter} className="min-h-0 flex-1 overflow-y-auto">
        {children}
      </TabsContent>
    </Tabs>
  )
}
