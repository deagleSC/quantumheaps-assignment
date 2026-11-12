import { Tabs, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { useConversationStore, useUiStore } from '@/store'
import type { ConversationFilter } from '@/types/conversation.types'

const FILTERS: { value: ConversationFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'groups', label: 'Groups' },
]

/** All / Unread / Groups. The Unread tab shows how many chats have unread messages. */
export function FilterTabs() {
  const filter = useUiStore((s) => s.filter)
  const setFilter = useUiStore((s) => s.setFilter)
  const unreadChats = useConversationStore(
    (s) => Object.values(s.byId).filter((c) => c.unreadCount > 0).length,
  )

  return (
    <Tabs value={filter} onValueChange={(v) => setFilter(v as ConversationFilter)}>
      <TabsList className="w-full" aria-label="Filter chats">
        {FILTERS.map(({ value, label }) => (
          <TabsTrigger key={value} value={value} className="gap-1.5">
            {label}
            {value === 'unread' && unreadChats > 0 && (
              <span className="bg-primary text-primary-foreground rounded-full px-1.5 text-[10px] leading-4 font-semibold">
                {unreadChats}
              </span>
            )}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
