import { fireEvent, renderHook } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { formatBytes } from '@/shared/lib/files'
import { notify } from '@/shared/lib/notify'
import { messageActions, useConversationStore, useMessageStore, useUserStore } from '@/store'
import { direct, message, user } from '@/test/fixtures'
import { act, render, screen, waitFor, within } from '@/test/render'
import { resetStores } from '@/test/reset-stores'
import { ChatView } from '../components/chat-view'
import { MessageBubble } from '../components/message-bubble'
import { MessageComposer } from '../components/message-composer'
import { MAX_ATTACHMENT_BYTES, useAttachment } from '../hooks/use-attachment'

vi.mock('@/shared/lib/notify')

const png = (name = 'photo.png', size = 1000) =>
  new File([new Uint8Array(size)], name, { type: 'image/png' })
const pdf = () => new File(['%PDF-1.4 hello'], 'spec.pdf', { type: 'application/pdf' })

let created: string[]
let revoked: string[]
beforeEach(() => {
  vi.restoreAllMocks()
  resetStores()
  created = []
  revoked = []
  let n = 0
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
    const url = `blob:mock-${++n}`
    created.push(url)
    return url
  })
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url) => void revoked.push(url))
  useUserStore.getState().setCurrentUserId('me')
  useUserStore.getState().setUsers([user('me', 'Me'), user('u1', 'Ada')])
  useConversationStore.getState().setConversations([direct('c1', 'u1')])
  useMessageStore.getState().addPage('c1', { messages: [], hasMore: false })
  useMessageStore.getState().setHistoryStatus('c1', 'success')
})

describe('useAttachment', () => {
  it('creates a preview URL and revokes it on replace, clear and unmount', () => {
    const { result, unmount } = renderHook(() => useAttachment({ onError: vi.fn() }))
    act(() => result.current.select(png('a.png')))
    expect(result.current.pending).toMatchObject({ previewUrl: 'blob:mock-1', isImage: true })
    act(() => result.current.select(pdf()))
    expect(revoked).toEqual(['blob:mock-1'])
    expect(result.current.pending).toMatchObject({ previewUrl: 'blob:mock-2', isImage: false })
    act(() => result.current.clear())
    expect(revoked).toEqual(['blob:mock-1', 'blob:mock-2'])
    act(() => result.current.select(png()))
    unmount()
    expect(revoked).toEqual(['blob:mock-1', 'blob:mock-2', 'blob:mock-3'])
  })

  it('rejects files over the limit', () => {
    const onError = vi.fn()
    const { result } = renderHook(() => useAttachment({ onError }))
    act(() => result.current.select(png('huge.png', MAX_ATTACHMENT_BYTES + 1)))
    expect(result.current.pending).toBeNull()
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('The limit is 2.0 MB'))
    expect(created).toEqual([])
  })

  it('take() returns a persistable data-URL attachment and releases the preview', async () => {
    const { result } = renderHook(() => useAttachment({ onError: vi.fn() }))
    act(() => result.current.select(pdf()))
    let taken: Awaited<ReturnType<typeof result.current.take>> = null
    await act(async () => {
      taken = await result.current.take()
    })
    expect(taken).toMatchObject({ name: 'spec.pdf', type: 'application/pdf', size: 14 })
    expect(taken!.previewUrl).toMatch(/^data:application\/pdf;base64,/)
    expect(revoked).toEqual(['blob:mock-1'])
    expect(result.current.pending).toBeNull()
  })
})

describe('composer attachments', () => {
  it('attaches via the file picker and sends an attachment-only message', async () => {
    const send = vi.spyOn(messageActions, 'send').mockResolvedValue('tmp-1')
    const ui = userEvent.setup()
    render(<MessageComposer conversationId="c1" />)
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled()
    await ui.upload(screen.getByLabelText('Attach a file', { selector: 'input' }), png())
    const preview = screen.getByLabelText('Attachment preview')
    expect(within(preview).getByRole('img', { name: 'photo.png' })).toHaveAttribute(
      'src',
      'blob:mock-1',
    )
    expect(preview).toHaveTextContent('1000 B')

    await ui.click(screen.getByRole('button', { name: 'Send message' }))
    await waitFor(() => expect(send).toHaveBeenCalledOnce())
    expect(send.mock.calls[0]![0]).toMatchObject({
      conversationId: 'c1',
      content: '',
      attachment: { name: 'photo.png', type: 'image/png', size: 1000 },
    })
    expect(send.mock.calls[0]![0].attachment!.previewUrl).toMatch(/^data:image\/png;base64,/)
    expect(screen.queryByLabelText('Attachment preview')).not.toBeInTheDocument()
    expect(revoked).toEqual(['blob:mock-1'])
  })

  it('removes the attachment and pastes images from the clipboard', async () => {
    const ui = userEvent.setup()
    render(<MessageComposer conversationId="c1" />)
    fireEvent.paste(screen.getByRole('textbox', { name: 'Message' }), {
      clipboardData: { files: [png('pasted.png')] },
    })
    expect(screen.getByLabelText('Attachment preview')).toHaveTextContent('pasted.png')
    await ui.click(screen.getByRole('button', { name: 'Remove attachment' }))
    expect(screen.queryByLabelText('Attachment preview')).not.toBeInTheDocument()
    expect(revoked).toEqual(['blob:mock-1'])
  })

  it('accepts a file dropped anywhere on the chat', () => {
    render(<ChatView conversationId="c1" />)
    const view = screen.getByRole('log').closest('.relative.flex')!
    const dataTransfer = { types: ['Files'], files: [pdf()] }
    fireEvent.dragEnter(view, { dataTransfer })
    expect(screen.getByText('Drop to attach')).toBeInTheDocument()
    fireEvent.drop(view, { dataTransfer })
    expect(screen.queryByText('Drop to attach')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Attachment preview')).toHaveTextContent('spec.pdf')
  })

  it('reports files that are too large', async () => {
    const ui = userEvent.setup()
    render(<MessageComposer conversationId="c1" />)
    await ui.upload(
      screen.getByLabelText('Attach a file', { selector: 'input' }),
      png('big.png', MAX_ATTACHMENT_BYTES + 10),
    )
    expect(notify.error).toHaveBeenCalledWith(expect.stringContaining('big.png'))
  })
})

describe('attachments in bubbles', () => {
  const props = { isOwn: false, isGroup: false, isFirstInCluster: true, isLastInCluster: true }

  it('shows images and opens them full size', async () => {
    const ui = userEvent.setup()
    render(
      <MessageBubble
        {...props}
        message={message('m1', {
          content: '',
          attachment: {
            name: 'cat.png',
            type: 'image/png',
            size: 2048,
            previewUrl: 'data:image/png;base64,AAA',
          },
        })}
      />,
    )
    await ui.click(screen.getByRole('button', { name: 'Open image cat.png' }))
    expect(
      within(screen.getByRole('dialog')).getByRole('img', { name: 'cat.png' }),
    ).toBeInTheDocument()
  })

  it('shows other files as a download link with the size', () => {
    render(
      <MessageBubble
        {...props}
        message={message('m1', {
          content: 'Spec attached',
          attachment: {
            name: 'spec.pdf',
            type: 'application/pdf',
            size: 1_572_864,
            previewUrl: 'data:application/pdf;base64,AAA',
          },
        })}
      />,
    )
    const link = screen.getByRole('link', { name: /spec\.pdf/ })
    expect(link).toHaveAttribute('download', 'spec.pdf')
    expect(link).toHaveTextContent('1.5 MB')
    expect(screen.getByText('Spec attached')).toBeInTheDocument()
  })
})

it('formatBytes', () => {
  expect([formatBytes(12), formatBytes(2048), formatBytes(1_572_864)]).toEqual([
    '12 B',
    '2 KB',
    '1.5 MB',
  ])
})
