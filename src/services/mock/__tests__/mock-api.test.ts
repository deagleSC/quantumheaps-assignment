import { configureMockApi, getMockDb, mockApi, MockApiError, resetMockApi } from '../mock-api'

beforeEach(() => {
  vi.useFakeTimers()
  resetMockApi({ now: Date.parse('2026-11-12T12:00:00Z') })
})
afterEach(() => {
  vi.useRealTimers()
})

describe('mockApi', () => {
  it('resolves after the configured latency', async () => {
    configureMockApi({ latency: { min: 300, max: 300 }, readFailureRate: 0, writeFailureRate: 0 })
    let done = false
    const promise = mockApi.getConversations().then((c) => {
      done = true
      return c
    })
    await vi.advanceTimersByTimeAsync(299)
    expect(done).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(await promise).toHaveLength(10)
  })

  it('injects failures without changing data', async () => {
    configureMockApi({ latency: { min: 0, max: 0 }, writeFailureRate: 1 })
    const before = getMockDb().getMessages('c-daniel').messages.length
    const promise = mockApi.sendMessage({
      conversationId: 'c-daniel',
      content: 'hi',
      clientId: 't',
    })
    const assertion = expect(promise).rejects.toBeInstanceOf(MockApiError)
    await vi.runAllTimersAsync()
    await assertion
    expect(getMockDb().getMessages('c-daniel').messages).toHaveLength(before)
  })

  it('passes DB validation errors through as rejections', async () => {
    configureMockApi({ latency: { min: 0, max: 0 }, writeFailureRate: 0 })
    const promise = mockApi.editMessage('nope', 'x')
    const assertion = expect(promise).rejects.toThrow('Message nope not found')
    await vi.runAllTimersAsync()
    await assertion
  })

  it('round-trips a send, edit, react and delete', async () => {
    configureMockApi({ latency: { min: 0, max: 0 }, readFailureRate: 0, writeFailureRate: 0 })
    const run = async <T>(p: Promise<T>) => {
      await vi.runAllTimersAsync()
      return p
    }
    const sent = await run(
      mockApi.sendMessage({ conversationId: 'c-liam', content: 'hello', clientId: 't1' }),
    )
    expect(sent.status).toBe('sent')
    expect((await run(mockApi.editMessage(sent.id, 'hello!'))).content).toBe('hello!')
    expect((await run(mockApi.toggleReaction(sent.id, '🙏'))).reactions).toHaveLength(1)
    expect((await run(mockApi.deleteMessage(sent.id))).isDeleted).toBe(true)
    const page = await run(mockApi.getMessages('c-liam', { limit: 1 }))
    expect(page.messages[0]!.id).toBe(sent.id)
  })
})
