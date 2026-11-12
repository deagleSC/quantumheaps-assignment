import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Inbox } from 'lucide-react'
import { EmptyState } from '../EmptyState'
import { ErrorState } from '../ErrorState'
import { OnlineAvatar } from '../OnlineAvatar'
import { getInitials } from '@/shared/lib/initials'
import { Spinner } from '../Spinner'
import { cn } from '@/shared/lib/utils'

describe('getInitials', () => {
  it.each([
    ['Ada Lovelace', 'AL'],
    ['grace', 'G'],
    ['  Alan  Mathison   Turing ', 'AT'],
    ['', '?'],
  ])('%j → %s', (name, expected) => {
    expect(getInitials(name)).toBe(expected)
  })
})

describe('OnlineAvatar', () => {
  it('shows initials and an online dot', () => {
    render(<OnlineAvatar name="Ada Lovelace" isOnline />)
    expect(screen.getByText('AL')).toBeInTheDocument()
    expect(screen.getByLabelText('Online')).toBeInTheDocument()
  })

  it('shows an offline dot', () => {
    render(<OnlineAvatar name="Ada" isOnline={false} />)
    expect(screen.getByLabelText('Offline')).toBeInTheDocument()
  })

  it('hides the dot when presence is unknown', () => {
    render(<OnlineAvatar name="Team" />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})

describe('EmptyState / ErrorState / Spinner', () => {
  it('renders title, description and action', () => {
    render(
      <EmptyState
        icon={Inbox}
        title="Nothing here"
        description="Try later"
        action={<button>Go</button>}
      />,
    )
    expect(screen.getByText('Nothing here')).toBeInTheDocument()
    expect(screen.getByText('Try later')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Go' })).toBeInTheDocument()
  })

  it('calls onRetry from the error state', async () => {
    const onRetry = vi.fn()
    render(<ErrorState onRetry={onRetry} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong')
    await userEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('omits the retry button without a handler', () => {
    render(<ErrorState />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('labels the spinner for screen readers', () => {
    render(<Spinner label="Loading chats" />)
    expect(screen.getByRole('status', { name: 'Loading chats' })).toBeInTheDocument()
  })
})

describe('cn', () => {
  it('merges conflicting Tailwind classes', () => {
    const hidden = false as boolean
    expect(cn('p-2 text-sm', hidden && 'hidden', 'p-4')).toBe('text-sm p-4')
  })
})
