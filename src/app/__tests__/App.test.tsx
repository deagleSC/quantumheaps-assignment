import { render, screen } from '@testing-library/react'
import { App } from '../App'

it('renders the app shell', () => {
  render(<App />)
  expect(screen.getByRole('main')).toBeInTheDocument()
  expect(screen.getByText('Quantum Chat')).toBeInTheDocument()
})
