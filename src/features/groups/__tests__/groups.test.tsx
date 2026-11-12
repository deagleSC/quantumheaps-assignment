import userEvent from '@testing-library/user-event'
import { AppLayout } from '@/app/app-layout'
import { MessageList } from '@/features/chat/components/message-list'
import { configureMockApi, resetMockApi } from '@/services/mock/mock-api'
import { notify } from '@/shared/lib/notify'
import {
  conversationActions,
  groupActions,
  useConversationStore,
  useUiStore,
  useUserStore,
} from '@/store'
import { direct, group, user } from '@/test/fixtures'
import { act, render, screen, waitFor, within } from '@/test/render'
import { resetStores } from '@/test/reset-stores'
import { InfoPanel } from '../components/info-panel'
import { sortMembers } from '../utils/sort-members'

vi.mock('@/shared/lib/notify')

const users = [
  user('me', 'Alex Morgan'),
  user('u1', 'Ada Lovelace'),
  user('u2', 'Bob Stone', false),
  user('u3', 'Cy Young'),
  user('u4', 'Dee Dee', false),
]

function seed() {
  useUserStore.getState().setCurrentUserId('me')
  useUserStore.getState().setUsers(users)
  useConversationStore.getState().setConversations([
    group('g1', {
      name: 'Design Team',
      description: 'Weekly critique',
      memberIds: ['me', 'u2', 'u1'],
      adminIds: ['u1'],
    }),
    direct('c1', 'u2'),
  ])
}

beforeEach(() => {
  vi.restoreAllMocks()
  vi.mocked(notify.success).mockReset()
  vi.mocked(notify.error).mockReset()
  resetStores()
  seed()
})

describe('sortMembers', () => {
  it('puts you first, then online, then offline, alphabetically', () => {
    const byId = Object.fromEntries(users.map((u) => [u.id, u]))
    const sorted = sortMembers(['u4', 'u2', 'me', 'u3', 'u1', 'ghost'], ['u3'], byId, 'me')
    expect(sorted.map((m) => m.user.id)).toEqual(['me', 'u1', 'u3', 'u2', 'u4'])
    expect(sorted.find((m) => m.user.id === 'u3')?.isAdmin).toBe(true)
  })
})

describe('InfoPanel', () => {
  it('shows group details and members with presence, admin and you tags', () => {
    render(<InfoPanel conversationId="g1" />)
    expect(screen.getByRole('heading', { name: 'Design Team' })).toBeInTheDocument()
    expect(screen.getByText('Group · 3 members, 1 online')).toBeInTheDocument()
    expect(screen.getByText('Weekly critique')).toBeInTheDocument()
    const rows = within(screen.getByRole('list', { name: 'Members' })).getAllByRole('listitem')
    expect(rows.map((r) => r.querySelector('p')?.textContent)).toEqual([
      'You',
      'Ada LovelaceAdmin',
      'Bob Stone',
    ])
    expect(within(rows[1]!).getByLabelText('Online')).toBeInTheDocument()
    expect(within(rows[2]!).getByLabelText('Offline')).toBeInTheDocument()
    expect(within(rows[0]!).queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument()
  })

  it('shows the contact profile for direct chats', () => {
    render(<InfoPanel conversationId="c1" />)
    expect(screen.getByRole('heading', { name: 'Contact info' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Bob Stone' })).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Members' })).not.toBeInTheDocument()
  })

  it('removes a member after confirmation, and reports failures', async () => {
    const remove = vi.spyOn(groupActions, 'removeMember').mockResolvedValueOnce()
    const ui = userEvent.setup()
    render(<InfoPanel conversationId="g1" />)
    await ui.click(screen.getByRole('button', { name: 'Remove Bob Stone' }))
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Remove Bob Stone?')
    await ui.click(screen.getByRole('button', { name: 'Remove' }))
    expect(remove).toHaveBeenCalledWith('g1', 'u2')
    await waitFor(() => expect(notify.success).toHaveBeenCalledWith('Removed Bob Stone'))

    remove.mockRejectedValueOnce(new Error('Could not remove the member'))
    await ui.click(screen.getByRole('button', { name: 'Remove Bob Stone' }))
    await ui.click(screen.getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(notify.error).toHaveBeenCalledWith('Could not remove the member'))
  })
})

describe('AddMembersDialog', () => {
  it('lists only non-members and requires a selection', async () => {
    const add = vi.spyOn(groupActions, 'addMembers')
    const ui = userEvent.setup()
    render(<InfoPanel conversationId="g1" />)
    await ui.click(screen.getByRole('button', { name: 'Add members' }))
    const dialog = screen.getByRole('dialog', { name: 'Add members' })
    const options = within(dialog)
      .getAllByRole('option')
      .map((o) => o.textContent?.trim())
    expect(options).toEqual(['CYCy Young', 'DDDee Dee'])

    await ui.click(within(dialog).getByRole('button', { name: 'Add' }))
    expect(await within(dialog).findByText('Pick at least one person to add')).toBeInTheDocument()
    expect(add).not.toHaveBeenCalled()
  })

  it('filters by search, adds the selected people and closes', async () => {
    const add = vi.spyOn(groupActions, 'addMembers').mockResolvedValue()
    const ui = userEvent.setup()
    render(<InfoPanel conversationId="g1" />)
    await ui.click(screen.getByRole('button', { name: 'Add members' }))
    const dialog = screen.getByRole('dialog')

    await ui.type(within(dialog).getByPlaceholderText('Search people'), 'dee')
    expect(within(dialog).getAllByRole('option')).toHaveLength(1)
    await ui.click(within(dialog).getByRole('option', { name: /Dee Dee/ }))
    await ui.clear(within(dialog).getByPlaceholderText('Search people'))
    await ui.click(within(dialog).getByRole('option', { name: /Cy Young/ }))
    expect(dialog).toHaveTextContent('Selected: Cy, Dee')

    await ui.click(within(dialog).getByRole('button', { name: 'Add (2)' }))
    expect(add).toHaveBeenCalledWith('g1', ['u4', 'u3'])
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(notify.success).toHaveBeenCalledWith('2 members added')
  })

  it('keeps the dialog open and shows the error when adding fails', async () => {
    vi.spyOn(groupActions, 'addMembers').mockRejectedValue(
      new Error('Network error while trying to add members'),
    )
    const ui = userEvent.setup()
    render(<InfoPanel conversationId="g1" />)
    await ui.click(screen.getByRole('button', { name: 'Add members' }))
    await ui.click(screen.getByRole('option', { name: /Cy Young/ }))
    await ui.click(screen.getByRole('button', { name: 'Add (1)' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Network error while trying to add members',
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})

describe('add and remove end to end (real store + mock API)', () => {
  beforeEach(() => {
    resetStores()
    resetMockApi()
    configureMockApi({ latency: { min: 0, max: 0 }, readFailureRate: 0, writeFailureRate: 0 })
  })

  it('updates the member list and posts system messages', async () => {
    await conversationActions.loadInbox()
    await conversationActions.open('g-design')
    const ui = userEvent.setup()
    render(
      <>
        <InfoPanel conversationId="g-design" />
        <MessageList conversationId="g-design" />
      </>,
    )
    const members = () =>
      within(screen.getByRole('list', { name: 'Members' }))
        .getAllByRole('listitem')
        .map((r) => r.querySelector('p')?.textContent)
    expect(members()).not.toContain('Omar Haddad')

    await ui.click(screen.getByRole('button', { name: 'Add members' }))
    await ui.click(screen.getByRole('option', { name: /Omar Haddad/ }))
    await ui.click(screen.getByRole('button', { name: 'Add (1)' }))
    await waitFor(() => expect(members()).toContain('Omar Haddad'))
    expect(within(screen.getByRole('log')).getByText('You added Omar Haddad')).toBeInTheDocument()
    expect(useConversationStore.getState().order[0]).toBe('g-design')

    await ui.click(screen.getByRole('button', { name: 'Remove Omar Haddad' }))
    await ui.click(screen.getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(members()).not.toContain('Omar Haddad'))
    expect(within(screen.getByRole('log')).getByText('You removed Omar Haddad')).toBeInTheDocument()
  })
})

describe('layout', () => {
  const realMatchMedia = window.matchMedia
  const setDesktop = (matches: boolean) => {
    window.matchMedia = (query: string) => ({ ...realMatchMedia(query), matches })
  }
  afterEach(() => {
    window.matchMedia = realMatchMedia
  })

  it('shows info as a third column on desktop, toggled from the header', async () => {
    setDesktop(true)
    useUiStore.getState().setActiveConversation('g1')
    const ui = userEvent.setup()
    render(<AppLayout />)
    expect(screen.queryByRole('complementary', { name: 'Info' })).not.toBeInTheDocument()
    await ui.click(screen.getByRole('button', { name: 'Toggle info panel' }))
    expect(screen.getByRole('complementary', { name: 'Info' })).toHaveTextContent('Group info')
    await ui.click(screen.getByRole('button', { name: 'Close info' }))
    expect(screen.queryByRole('complementary', { name: 'Info' })).not.toBeInTheDocument()
  })

  it('uses a drawer below desktop width, opened by clicking the chat name', async () => {
    setDesktop(false)
    useUiStore.getState().setActiveConversation('c1')
    const ui = userEvent.setup()
    render(<AppLayout />)
    await ui.click(screen.getByRole('button', { name: 'Show contact info' }))
    const sheet = screen.getByRole('dialog', { name: 'Contact info' })
    expect(within(sheet).getByRole('heading', { name: 'Bob Stone' })).toBeInTheDocument()
    await act(async () => useUiStore.getState().setInfoPanelOpen(false))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})
