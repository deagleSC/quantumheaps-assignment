import { handleError } from './handle-error'

describe('handleError', () => {
  it('uses the Error message', () => {
    expect(handleError(new Error('Network down'))).toBe('Network down')
  })
  it('accepts a thrown string', () => {
    expect(handleError('Nope')).toBe('Nope')
  })
  it('falls back for unknown values', () => {
    expect(handleError({ weird: true })).toBe('An unexpected error occurred')
    expect(handleError(new Error(''), 'Send failed')).toBe('Send failed')
  })
})
