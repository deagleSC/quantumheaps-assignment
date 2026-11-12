import { configureMockApi, resetMockApi } from '@/services/mock/mock-api'
import { realtimeSimulator } from '@/services/mock/realtime-simulator'
import {
  conversationActions,
  messageActions,
  realtimeActions,
  useConversationStore,
  useMessageStore,
  useTypingStore,
} from '@/store'
import { resetStores } from '@/test/reset-stores'

vi.mock('@/shared/lib/notify')

/** Every layer is real here: stores → actions → services → mock API → simulator. */
beforeEach(() => {
  vi.useFakeTimers()
  resetStores()
  resetMockApi({ now: Date.now() })
  configureMockApi({
    latency: { min: 50, max: 50 },
    readFailureRate: 0,
    writeFailureRate: 0,
    random: () => 0,
  })
  // Deterministic simulator: always reply, pick the first participant, and
  // keep background chatter (12 s+) outside this test's time window.
  realtimeSimulator.configure({ random: () => 0 })
})
afterEach(() => {
  realtimeSimulator.stop()
  vi.useRealTimers()
})

it('loads the inbox, opens a chat and runs the full send → read → reply cycle', async () => {
  const disconnect = realtimeActions.connect()

  const inbox = conversationActions.loadInbox()
  await vi.advanceTimersByTimeAsync(50)
  await inbox
  expect(useConversationStore.getState().order).toHaveLength(10)

  const open = conversationActions.open('c-daniel')
  await vi.advanceTimersByTimeAsync(50)
  await open
  const before = useMessageStore.getState().byConversation['c-daniel']!.ids.length

  const send = messageActions.send({ conversationId: 'c-daniel', content: 'Ping?' })
  const tempId = useMessageStore.getState().byConversation['c-daniel']!.ids.at(-1)!
  expect(useMessageStore.getState().byId[tempId]?.status).toBe('sending')
  await vi.advanceTimersByTimeAsync(50)
  await send

  const ids = () => useMessageStore.getState().byConversation['c-daniel']!.ids
  const sentId = ids().at(-1)!
  expect(sentId).not.toBe(tempId)
  expect(useMessageStore.getState().byId[sentId]?.status).toBe('sent')
  expect(useConversationStore.getState().order[0]).toBe('c-daniel')

  await vi.advanceTimersByTimeAsync(600)
  expect(useMessageStore.getState().byId[sentId]?.status).toBe('delivered')
  await vi.advanceTimersByTimeAsync(1200)
  expect(useMessageStore.getState().byId[sentId]?.status).toBe('read')
  await vi.advanceTimersByTimeAsync(700)
  expect(useTypingStore.getState().byConversation['c-daniel']).toEqual(['u-daniel'])
  await vi.advanceTimersByTimeAsync(2200)
  expect(useTypingStore.getState().byConversation['c-daniel']).toEqual([])
  expect(ids()).toHaveLength(before + 2)
  expect(useMessageStore.getState().byId[ids().at(-1)!]?.senderId).toBe('u-daniel')
  // The chat is open, so the reply does not count as unread.
  expect(useConversationStore.getState().byId['c-daniel']?.unreadCount).toBe(0)

  disconnect()
  expect(realtimeSimulator.isRunning).toBe(false)
})
