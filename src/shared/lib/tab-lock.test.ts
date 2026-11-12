import { withTabLock } from './tab-lock'

afterEach(() => vi.unstubAllGlobals())

it('runs directly without Web Locks', async () => {
  const fn = vi.fn(async () => {})
  await withTabLock('x', fn)
  expect(fn).toHaveBeenCalledOnce()
})

it('skips when another tab holds the lock, runs when free', async () => {
  const fn = vi.fn(async () => {})
  let available = false
  vi.stubGlobal('navigator', {
    ...navigator,
    locks: {
      request: (
        _n: string,
        opts: { ifAvailable: boolean },
        cb: (lock: object | null) => Promise<void>,
      ) => cb(opts.ifAvailable && !available ? null : {}),
    },
  })
  await withTabLock('outbox', fn)
  expect(fn).not.toHaveBeenCalled()
  available = true
  await withTabLock('outbox', fn)
  expect(fn).toHaveBeenCalledOnce()
})
