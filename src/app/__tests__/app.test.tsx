import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { configureMockApi, resetMockApi } from '@/services/mock/mock-api'
import { realtimeSimulator } from '@/services/mock/realtime-simulator'
import { resetStores } from '@/test/reset-stores'
import { App } from '../app'

beforeEach(() => {
  resetStores()
  resetMockApi()
  configureMockApi({ latency: { min: 0, max: 0 }, readFailureRate: 0, writeFailureRate: 0 })
})
afterEach(() => realtimeSimulator.stop())

it('loads the inbox and opens a chat, with a back button for mobile', async () => {
  const ui = userEvent.setup()
  render(<App />)
  expect(screen.getByText('Pick a conversation to start messaging.')).toBeInTheDocument()

  const row = await screen.findByRole('button', { name: /Priya Sharma/ })
  expect(within(row).getByLabelText('2 unread messages')).toBeInTheDocument()

  await ui.click(row)
  const header = await screen.findByRole('heading', { level: 2, name: 'Priya Sharma' })
  expect(header).toBeInTheDocument()
  expect(within(row).queryByLabelText(/unread/)).not.toBeInTheDocument()

  // Send a message with Enter; it appears in the open chat and moves the chat to the top.
  expect(await screen.findByRole('log', { name: 'Messages' })).toBeInTheDocument()
  await screen.findByText(/unread message/)
  await ui.type(screen.getByRole('textbox', { name: 'Message' }), 'Hello from the test{Enter}')
  expect(
    await within(screen.getByRole('log')).findByText('Hello from the test'),
  ).toBeInTheDocument()
  const firstRow = within(screen.getByRole('list', { name: 'Chats' })).getAllByRole('button')[0]
  expect(firstRow).toHaveTextContent('You: Hello from the test')

  await ui.click(screen.getByRole('button', { name: 'Back to chats' }))
  expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument()
})
