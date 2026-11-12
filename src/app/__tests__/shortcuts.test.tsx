import type { MockInstance } from 'vitest'
import { fireEvent, renderHook } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConversationSidebar } from '@/features/conversations/components/conversation-sidebar'
import { conversationActions, useConversationStore, useUiStore, useUserStore } from '@/store'
import { direct, group, user } from '@/test/fixtures'
import { render, screen } from '@/test/render'
import { resetStores } from '@/test/reset-stores'
import { useUnreadDocumentTitle } from '../hooks/use-document-title'
import { switchConversation, useGlobalShortcuts } from '../hooks/use-global-shortcuts'
import { ShortcutsDialog } from '../shortcuts-dialog'

function seed() {
  useUserStore.getState().setCurrentUserId('me')
  useUserStore.getState().setUsers([user('me', 'Me'), user('u1', 'Ada'), user('u2', 'Bob')])
  useConversationStore
    .getState()
    .setConversations([
      direct('c1', 'u1', { updatedAt: '2026-11-12T10:03:00Z', unreadCount: 2 }),
      direct('c2', 'u2', { updatedAt: '2026-11-12T10:02:00Z' }),
      group('g1', { updatedAt: '2026-11-12T10:01:00Z', unreadCount: 1 }),
    ])
  useConversationStore.getState().setStatus('success')
}

let open: MockInstance<typeof conversationActions.open>
beforeEach(() => {
  resetStores()
  seed()
  open = vi.spyOn(conversationActions, 'open').mockImplementation(async (id) => {
    useUiStore.getState().setActiveConversation(id)
  })
})
afterEach(() => open.mockRestore())

const press = (init: KeyboardEventInit) => fireEvent.keyDown(window, init)

describe('global shortcuts', () => {
  it('Alt+↓ / Alt+↑ walk the visible chat list', () => {
    renderHook(() => useGlobalShortcuts())
    press({ key: 'ArrowDown', altKey: true })
    expect(useUiStore.getState().activeConversationId).toBe('c1')
    press({ key: 'ArrowDown', altKey: true })
    expect(useUiStore.getState().activeConversationId).toBe('c2')
    press({ key: 'ArrowUp', altKey: true })
    expect(useUiStore.getState().activeConversationId).toBe('c1')
  })

  it('respects the active filter and stops at the ends', () => {
    useUiStore.getState().setFilter('unread')
    switchConversation(1)
    switchConversation(1)
    switchConversation(1)
    expect(useUiStore.getState().activeConversationId).toBe('g1')
  })

  it('Ctrl/⌘+K focuses the chat search', () => {
    renderHook(() => useGlobalShortcuts())
    render(<ConversationSidebar />)
    press({ key: 'k', metaKey: true })
    expect(screen.getByRole('searchbox', { name: 'Search chats' })).toHaveFocus()
  })

  it('Ctrl/⌘+F opens in-chat search only with a chat open', () => {
    renderHook(() => useGlobalShortcuts())
    press({ key: 'f', ctrlKey: true })
    expect(useUiStore.getState().messageSearch).toBeNull()
    useUiStore.getState().setActiveConversation('c1')
    press({ key: 'f', ctrlKey: true })
    expect(useUiStore.getState().messageSearch).toEqual({ query: '', activeMatchId: null })
  })

  it('Esc closes the search first, then the info panel', () => {
    renderHook(() => useGlobalShortcuts())
    useUiStore.getState().setActiveConversation('c1')
    useUiStore.getState().setInfoPanelOpen(true)
    useUiStore.getState().openMessageSearch()
    press({ key: 'Escape' })
    expect(useUiStore.getState().messageSearch).toBeNull()
    expect(useUiStore.getState().isInfoPanelOpen).toBe(true)
    press({ key: 'Escape' })
    expect(useUiStore.getState().isInfoPanelOpen).toBe(false)
  })

  it('? opens the shortcuts help, which closes with Esc', async () => {
    renderHook(() => useGlobalShortcuts())
    render(<ShortcutsDialog />)
    press({ key: '?', shiftKey: true })
    expect(await screen.findByRole('dialog', { name: 'Keyboard shortcuts' })).toHaveTextContent(
      'Search chats',
    )
    useUiStore.getState().setInfoPanelOpen(true)
    await userEvent.keyboard('{Escape}')
    expect(useUiStore.getState().isShortcutsOpen).toBe(false)
    // The dialog swallowed Esc: the panel behind it stays open.
    expect(useUiStore.getState().isInfoPanelOpen).toBe(true)
  })
})

it('shows the unread total in the tab title', () => {
  renderHook(() => useUnreadDocumentTitle())
  expect(document.title).toBe('(3) Quantum Chat')
  useConversationStore.getState().setUnreadCount('c1', 0)
  useConversationStore.getState().setUnreadCount('g1', 0)
  renderHook(() => useUnreadDocumentTitle())
  expect(document.title).toBe('Quantum Chat')
})
