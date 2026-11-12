/** Message the mock API (and services) use when the network is unavailable. */
export const OFFLINE_MESSAGE = 'You are offline'

export const isOfflineError = (error: unknown) =>
  error instanceof Error && error.message === OFFLINE_MESSAGE
