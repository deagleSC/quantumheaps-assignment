import { CONVERSATION_SEARCH_ID } from '@/features/conversations/components/sidebar-search'
import { useHotkeys } from '@/shared/hooks/use-hotkeys'
import {
  conversationActions,
  filterConversations,
  useConversationStore,
  useMessageStore,
  useUiStore,
  useUserStore,
} from '@/store'

/** The sidebar's current order (respecting the tab and search), as Alt+↑/↓ sees it. */
function visibleConversationIds() {
  const { order, byId } = useConversationStore.getState()
  const { filter, search } = useUiStore.getState()
  return filterConversations({
    order,
    byId,
    usersById: useUserStore.getState().byId,
    messagesById: useMessageStore.getState().byId,
    filter,
    search,
  })
}

/** Moves to the previous (-1) or next (+1) chat in the sidebar. */
export function switchConversation(delta: -1 | 1) {
  const ids = visibleConversationIds()
  if (ids.length === 0) return
  const active = useUiStore.getState().activeConversationId
  const index = active ? ids.indexOf(active) : -1
  const target =
    index === -1
      ? ids[delta === 1 ? 0 : ids.length - 1]
      : ids[Math.min(Math.max(index + delta, 0), ids.length - 1)]
  if (target && target !== active) void conversationActions.open(target)
}

export function focusConversationSearch() {
  const focus = () => {
    const input = document.getElementById(CONVERSATION_SEARCH_ID) as HTMLInputElement | null
    input?.focus()
    input?.select()
  }
  // On mobile the list is hidden while a chat is open: go back to it first.
  if (
    window.matchMedia('(max-width: 767px)').matches &&
    useUiStore.getState().activeConversationId
  ) {
    conversationActions.close()
    requestAnimationFrame(focus)
  } else {
    focus()
  }
}

/**
 * App-wide shortcuts (composer-level ones live in the composer):
 * Ctrl/⌘+K search chats · Ctrl/⌘+F search in chat · Alt+↑/↓ switch chats ·
 * ? shortcut help · Esc close search, then the info panel
 */
export function useGlobalShortcuts() {
  useHotkeys([
    { key: 'k', mod: true, allowInInputs: true, handler: focusConversationSearch },
    {
      key: 'f',
      mod: true,
      allowInInputs: true,
      handler: () => {
        if (useUiStore.getState().activeConversationId) useUiStore.getState().openMessageSearch()
      },
    },
    { key: 'ArrowUp', alt: true, allowInInputs: true, handler: () => switchConversation(-1) },
    { key: 'ArrowDown', alt: true, allowInInputs: true, handler: () => switchConversation(1) },
    { key: '?', handler: () => useUiStore.getState().setShortcutsOpen(true) },
    {
      key: 'Escape',
      allowInInputs: true,
      handler: () => {
        // A dialog, sheet or menu handles its own Esc; don't also close panels behind it.
        if (document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"]')) return
        const ui = useUiStore.getState()
        if (ui.messageSearch) ui.closeMessageSearch()
        else if (ui.isInfoPanelOpen) ui.setInfoPanelOpen(false)
      },
    },
  ])
}
