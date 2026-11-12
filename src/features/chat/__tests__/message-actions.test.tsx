import { fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { notify } from '@/shared/lib/notify'
import {
  messageActions,
  useConversationStore,
  useMessageStore,
  useUiStore,
  useUserStore,
} from '@/store'
import { direct, message, user } from '@/test/fixtures'
import { act, render, screen, within } from '@/test/render'
import { resetStores } from '@/test/reset-stores'
import { MessageComposer } from '../components/message-composer'
import { MessageList } from '../components/message-list'
import { getMessagePermissions } from '../utils/message-permissions'

vi.mock('@/shared/lib/notify')

const t = (m: number) => new Date(2026, 10, 12, 9, m).toISOString()

function seed() {
  useUserStore.getState().setCurrentUserId('me')
  useUserStore.getState().setUsers([user('me', 'Alex Morgan'), user('u1', 'Ada Lovelace')])
  useConversationStore.getState().setConversations([direct('c1', 'u1')])
  useMessageStore.getState().addPage('c1', {
    hasMore: false,
    messages: [
      message('m2', {
        senderId: 'u1',
        content: 'Their message',
        createdAt: t(1),
        reactions: [{ emoji: '😂', userIds: ['u1'] }],
      }),
      message('m1', { content: 'My message', createdAt: t(20), status: 'read' }),
      message('m3', { content: '', isDeleted: true, createdAt: t(40) }),
      message('tmp-x', { content: 'Unsent', status: 'failed', createdAt: t(50) }),
    ],
  })
  useMessageStore.getState().setHistoryStatus('c1', 'success')
}

const bubble = (id: string) => document.querySelector<HTMLElement>(`[data-message-id="${id}"]`)!
const menuItems = () => screen.getAllByRole('menuitem').map((i) => i.textContent?.trim())

async function openMenu(ui: ReturnType<typeof userEvent.setup>, id: string) {
  await ui.click(within(bubble(id)).getByRole('button', { name: 'Message actions' }))
}

function renderChat() {
  return render(
    <>
      <MessageList conversationId="c1" />
      <MessageComposer conversationId="c1" />
    </>,
  )
}

beforeEach(() => {
  vi.restoreAllMocks()
  vi.mocked(notify.success).mockReset()
  resetStores()
  seed()
})

describe('menu contents', () => {
  it('offers reply, copy, edit and delete on own messages', async () => {
    const ui = userEvent.setup()
    renderChat()
    await openMenu(ui, 'm1')
    expect(menuItems()).toEqual(['Reply', 'Copy text', 'Edit', 'Delete'])
  })

  it('offers only reply and copy on other people’s messages', async () => {
    const ui = userEvent.setup()
    renderChat()
    await openMenu(ui, 'm2')
    expect(menuItems()).toEqual(['Reply', 'Copy text'])
  })

  it('offers copy and discard on a failed, unsent message, and nothing on deleted ones', async () => {
    const ui = userEvent.setup()
    renderChat()
    expect(
      within(bubble('m3')).queryByRole('button', { name: 'Message actions' }),
    ).not.toBeInTheDocument()
    expect(
      within(bubble('tmp-x')).queryByRole('button', { name: 'Add reaction' }),
    ).not.toBeInTheDocument()
    await openMenu(ui, 'tmp-x')
    expect(menuItems()).toEqual(['Copy text', 'Delete'])
  })

  it('opens on right-click', () => {
    renderChat()
    fireEvent.contextMenu(within(bubble('m2')).getByText('Their message'))
    expect(screen.getByRole('menu')).toBeInTheDocument()
  })

  it('opens on long-press but not when the finger moves (scrolling)', () => {
    vi.useFakeTimers()
    renderChat()
    const target = within(bubble('m2')).getByText('Their message').parentElement!
    fireEvent.touchStart(target, { touches: [{ clientX: 10, clientY: 10 }] })
    fireEvent.touchMove(target, { touches: [{ clientX: 10, clientY: 40 }] })
    act(() => vi.advanceTimersByTime(500))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()

    fireEvent.touchStart(target, { touches: [{ clientX: 10, clientY: 10 }] })
    act(() => vi.advanceTimersByTime(450))
    expect(screen.getByRole('menu')).toBeInTheDocument()
    vi.useRealTimers()
  })
})

describe('actions', () => {
  it('reply puts the message in the reply preview', async () => {
    const ui = userEvent.setup()
    renderChat()
    await openMenu(ui, 'm2')
    await ui.click(screen.getByRole('menuitem', { name: 'Reply' }))
    expect(useUiStore.getState().replyingToId).toBe('m2')
    expect(screen.getByLabelText('Reply preview')).toHaveTextContent('Their message')
  })

  it('copy writes the text to the clipboard and confirms', async () => {
    const ui = userEvent.setup()
    const write = vi.spyOn(navigator.clipboard, 'writeText')
    renderChat()
    await openMenu(ui, 'm2')
    await ui.click(screen.getByRole('menuitem', { name: 'Copy text' }))
    expect(write).toHaveBeenCalledWith('Their message')
    expect(notify.success).toHaveBeenCalledWith('Copied to clipboard')
  })

  it('edit pre-fills the composer, saves with Enter and cancels with Esc', async () => {
    const edit = vi.spyOn(messageActions, 'edit').mockImplementation(async () => {
      useUiStore.getState().setEditing(null)
    })
    const ui = userEvent.setup()
    renderChat()
    await openMenu(ui, 'm1')
    await ui.click(screen.getByRole('menuitem', { name: 'Edit' }))
    const input = screen.getByRole('textbox', { name: 'Message' })
    expect(input).toHaveValue('My message')
    expect(screen.getByLabelText('Edit preview')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save edit' })).toBeEnabled()

    await ui.click(input)
    await ui.keyboard('{End}, edited{Enter}')
    expect(edit).toHaveBeenCalledWith('m1', 'My message, edited')
    expect(input).toHaveValue('')

    act(() => useUiStore.getState().setEditing('m1'))
    expect(input).toHaveValue('My message')
    await ui.keyboard('{Escape}')
    expect(useUiStore.getState().editingId).toBeNull()
    expect(input).toHaveValue('')
  })

  it('moves focus to the composer after choosing Edit or Reply from the menu', async () => {
    const ui = userEvent.setup()
    renderChat()
    const input = screen.getByRole('textbox', { name: 'Message' })
    await openMenu(ui, 'm1')
    await ui.click(screen.getByRole('menuitem', { name: 'Edit' }))
    await act(() => new Promise((r) => requestAnimationFrame(() => r(null))))
    expect(input).toHaveFocus()

    await ui.keyboard('{Escape}')
    await openMenu(ui, 'm2')
    await ui.click(screen.getByRole('menuitem', { name: 'Reply' }))
    expect(input).toHaveFocus()
  })

  it('↑ in an empty composer edits the last own message', async () => {
    const ui = userEvent.setup()
    renderChat()
    await ui.click(screen.getByRole('textbox', { name: 'Message' }))
    await ui.keyboard('{ArrowUp}')
    expect(useUiStore.getState().editingId).toBe('m1')
  })

  it('delete asks for confirmation first', async () => {
    const remove = vi.spyOn(messageActions, 'remove').mockResolvedValue()
    const ui = userEvent.setup()
    renderChat()

    await openMenu(ui, 'm1')
    await ui.click(screen.getByRole('menuitem', { name: 'Delete' }))
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Delete this message?')
    await ui.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(remove).not.toHaveBeenCalled()

    await openMenu(ui, 'm1')
    await ui.click(screen.getByRole('menuitem', { name: 'Delete' }))
    await ui.click(screen.getByRole('button', { name: 'Delete' }))
    expect(remove).toHaveBeenCalledWith('m1')
  })

  it('reacts from the picker and toggles from a chip', async () => {
    const toggle = vi.spyOn(messageActions, 'toggleReaction').mockResolvedValue()
    const ui = userEvent.setup()
    renderChat()
    await ui.click(within(bubble('m2')).getByRole('button', { name: 'Add reaction' }))
    await ui.click(screen.getByRole('button', { name: 'React with 👍' }))
    expect(toggle).toHaveBeenCalledWith('m2', '👍')

    const chip = within(bubble('m2')).getByRole('button', { name: '😂 1: Ada' })
    expect(chip).toHaveAttribute('aria-pressed', 'false')
    await ui.click(chip)
    expect(toggle).toHaveBeenCalledWith('m2', '😂')
  })
})

describe('getMessagePermissions', () => {
  it.each([
    [
      'own sent',
      message('a'),
      true,
      { canReply: true, canReact: true, canCopy: true, canEdit: true, canDelete: true },
    ],
    [
      'theirs',
      message('a', { senderId: 'u1' }),
      false,
      { canReply: true, canReact: true, canCopy: true, canEdit: false, canDelete: false },
    ],
    [
      'own sending',
      message('tmp-a', { status: 'sending' }),
      true,
      { canReply: false, canReact: false, canCopy: true, canEdit: false, canDelete: false },
    ],
    [
      'deleted',
      message('a', { isDeleted: true, content: '' }),
      true,
      { canReply: false, canReact: false, canCopy: false, canEdit: false, canDelete: false },
    ],
  ] as const)('%s', (_, m, isOwn, expected) => {
    expect(getMessagePermissions(m, isOwn)).toEqual(expected)
  })
})
