import userEvent from '@testing-library/user-event'
import { OfflineBanner } from '@/app/offline-banner'
import { SettingsMenu } from '@/app/settings-menu'
import {
  configureMockApi,
  getMockDb,
  mockApi,
  resetMockApi,
  setMockNetworkOnline,
} from '@/services/mock/mock-api'
import { realtimeSimulator } from '@/services/mock/realtime-simulator'
import { notify } from '@/shared/lib/notify'
import { OFFLINE_MESSAGE } from '@/shared/lib/network'
import {
  connectionActions,
  conversationActions,
  messageActions,
  useMessageStore,
  useOutboxStore,
} from '@/store'
import { act, render, screen } from '@/test/render'
import { resetStores } from '@/test/reset-stores'

vi.mock('@/shared/lib/notify')

const LATENCY = 50
/** Advance in small steps so chained async work can schedule its timers in between. */
const tick = async (ms: number) => {
  for (let t = 0; t < ms; t += 10) await vi.advanceTimersByTimeAsync(10)
}
beforeEach(async () => {
  vi.useFakeTimers()
  localStorage.clear()
  resetStores()
  resetMockApi({ now: Date.now() })
  configureMockApi({
    latency: { min: LATENCY, max: LATENCY },
    readFailureRate: 0,
    writeFailureRate: 0,
  })
  realtimeSimulator.configure({ random: () => 0.99 }) // no auto-replies in the way
  const inbox = conversationActions.loadInbox()
  await vi.advanceTimersByTimeAsync(LATENCY)
  await inbox
  const open = conversationActions.open('c-liam')
  await vi.advanceTimersByTimeAsync(LATENCY)
  await open
})
afterEach(() => {
  realtimeSimulator.stop()
  vi.useRealTimers()
})

const serverContents = () =>
  getMockDb()
    .getAllMessages('c-liam')
    .map((m) => m.content)
const timeline = () =>
  useMessageStore
    .getState()
    .byConversation['c-liam']!.ids.map((id) => useMessageStore.getState().byId[id]!)

describe('offline queue', () => {
  it('queues messages while offline without touching the server', async () => {
    connectionActions.setSimulatedOffline(true)
    const id = await messageActions.send({ conversationId: 'c-liam', content: 'written offline' })
    expect(useMessageStore.getState().byId[id!]?.status).toBe('queued')
    expect(useOutboxStore.getState().queue.map((m) => m.content)).toEqual(['written offline'])
    expect(serverContents()).not.toContain('written offline')
    expect(notify.info).toHaveBeenCalledWith(
      'You are offline. Messages will be sent when you reconnect.',
    )
  })

  it('sends the queue in order when back online', async () => {
    connectionActions.setSimulatedOffline(true)
    for (const content of ['one', 'two', 'three']) {
      await messageActions.send({ conversationId: 'c-liam', content })
    }
    connectionActions.setSimulatedOffline(false)
    expect(notify.success).toHaveBeenCalledWith('Back online, sending 3 queued')
    await tick(LATENCY * 3)
    await messageActions.flushOutbox()
    expect(serverContents().slice(-3)).toEqual(['one', 'two', 'three'])
    expect(useOutboxStore.getState().queue).toEqual([])
    expect(
      timeline()
        .slice(-3)
        .map((m) => [m.content, m.status]),
    ).toEqual([
      ['one', 'sent'],
      ['two', 'sent'],
      ['three', 'sent'],
    ])
  })

  it('keeps the rest queued if the connection drops during the flush', async () => {
    connectionActions.setSimulatedOffline(true)
    for (const content of ['a', 'b', 'c'])
      await messageActions.send({ conversationId: 'c-liam', content })
    connectionActions.setSimulatedOffline(false)
    // Advance until 'a' has reached the server ('b' is then in flight)…
    for (let i = 0; i < 20 && !serverContents().includes('a'); i++) await tick(10)
    expect(serverContents().slice(-1)).toEqual(['a'])
    // …then drop the connection: 'b' fails in flight and is re-queued.
    connectionActions.setSimulatedOffline(true)
    await tick(LATENCY * 3)
    expect(serverContents().slice(-1)).toEqual(['a'])
    expect(useOutboxStore.getState().queue.map((m) => m.content)).toEqual(['b', 'c'])
    expect(
      timeline()
        .slice(-2)
        .map((m) => m.status),
    ).toEqual(['queued', 'queued'])
  })

  it('queues instead of failing when the network drops mid-request', async () => {
    const pending = messageActions.send({ conversationId: 'c-liam', content: 'in flight' })
    connectionActions.setSimulatedOffline(true)
    await tick(LATENCY)
    const id = await pending
    expect(useMessageStore.getState().byId[id!]?.status).toBe('queued')
    expect(notify.error).not.toHaveBeenCalled()
  })

  it('persists the outbox and restores it on the next start', async () => {
    connectionActions.setSimulatedOffline(true)
    await messageActions.send({ conversationId: 'c-liam', content: 'survives reload' })
    expect(localStorage.getItem('quantum-chat-outbox')).toContain('survives reload')

    // "Reload": fresh client stores and network, same outbox in localStorage.
    const saved = useOutboxStore.getState().queue
    resetStores()
    setMockNetworkOnline(true)
    useOutboxStore.setState({ queue: saved })
    const inbox = conversationActions.loadInbox()
    await tick(LATENCY * 3)
    await inbox
    expect(serverContents()).toContain('survives reload')
    expect(useOutboxStore.getState().queue).toEqual([])
  })

  it('discarding a queued message removes it from the outbox', async () => {
    connectionActions.setSimulatedOffline(true)
    const id = await messageActions.send({ conversationId: 'c-liam', content: 'never mind' })
    await messageActions.remove(id!)
    expect(useOutboxStore.getState().queue).toEqual([])
    expect(useMessageStore.getState().byId[id!]).toBeUndefined()
  })

  it('the mock API refuses requests while offline', async () => {
    connectionActions.setSimulatedOffline(true)
    await expect(mockApi.getConversations()).rejects.toThrow(OFFLINE_MESSAGE)
    connectionActions.setSimulatedOffline(false)
    const ok = mockApi.getConversations()
    await tick(LATENCY)
    await expect(ok).resolves.toHaveLength(11)
  })
})

describe('offline UI', () => {
  it('settings toggle shows the banner with the queue size and can go back online', async () => {
    vi.useRealTimers()
    const ui = userEvent.setup()
    render(
      <>
        <OfflineBanner />
        <SettingsMenu />
      </>,
    )
    expect(screen.queryByText(/offline/)).not.toBeInTheDocument()
    await ui.click(screen.getByRole('button', { name: 'Settings' }))
    await ui.click(screen.getByRole('menuitemcheckbox', { name: 'Simulate offline' }))
    expect(screen.getByRole('status')).toHaveTextContent(
      "You're offline. Messages you send will be queued.",
    )

    await act(() =>
      messageActions.send({ conversationId: 'c-liam', content: 'queued 1' }).then(() => undefined),
    )
    expect(screen.getByRole('status')).toHaveTextContent(
      '1 message will be sent when you reconnect.',
    )

    await ui.click(screen.getByRole('button', { name: 'Go back online' }))
    expect(screen.queryByText(/You're offline/)).not.toBeInTheDocument()
  })
})

describe('flushOutbox regression', () => {
  it('still flushes after an earlier flush found the outbox empty', async () => {
    await messageActions.flushOutbox() // empty outbox: settles immediately
    connectionActions.setSimulatedOffline(true)
    await messageActions.send({ conversationId: 'c-liam', content: 'after an empty flush' })
    connectionActions.setSimulatedOffline(false)
    for (let i = 0; i < 20 && useOutboxStore.getState().queue.length > 0; i++) await tick(10)
    expect(useOutboxStore.getState().queue).toEqual([])
    expect(serverContents()).toContain('after an empty flush')
  })
})
