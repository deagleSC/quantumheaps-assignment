import type { ReactNode } from 'react'
import { OnlineAvatar } from '@/shared/components/online-avatar'
import { useUserStore } from '@/store'
import { ConversationList } from './conversation-list'
import { FilterTabs } from './filter-tabs'
import { SidebarSearch } from './sidebar-search'

export interface ConversationSidebarProps {
  /** Header actions (theme toggle etc.). */
  actions?: ReactNode
}

export function ConversationSidebar({ actions }: ConversationSidebarProps) {
  const me = useUserStore((s) => (s.currentUserId ? s.byId[s.currentUserId] : undefined))

  return (
    <div className="bg-background flex h-full flex-col">
      <header className="flex items-center gap-3 px-4 pt-4 pb-3">
        {me && <OnlineAvatar name={me.name} src={me.avatarUrl} size="sm" />}
        <h2 className="flex-1 text-xl font-semibold tracking-tight">Chats</h2>
        {actions}
      </header>
      <FilterTabs header={<SidebarSearch />}>
        <nav aria-label="Conversations">
          <ConversationList />
        </nav>
      </FilterTabs>
    </div>
  )
}
