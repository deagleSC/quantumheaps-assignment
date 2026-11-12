/**
 * Runs `fn` only if no other tab currently holds the named Web Lock (it's
 * skipped otherwise). Without Web Locks support, just runs it.
 */
export async function withTabLock(name: string, fn: () => Promise<void>): Promise<void> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined
  if (!locks?.request) return fn()
  await locks.request(name, { ifAvailable: true }, async (lock) => {
    if (lock) await fn()
  })
}
