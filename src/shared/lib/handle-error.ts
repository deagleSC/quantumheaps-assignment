/**
 * Turns any thrown value into a user-facing message.
 * Services wrap every call with `throw new Error(handleError(error))`, so the
 * actions layer only ever deals with `Error` instances with readable messages.
 */
export const handleError = (error: unknown, fallback = 'An unexpected error occurred'): string => {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'string' && error) return error
  return fallback
}
