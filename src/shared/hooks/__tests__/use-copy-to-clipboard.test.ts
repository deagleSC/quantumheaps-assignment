import { copyText } from '../use-copy-to-clipboard'

it('uses the async clipboard API', async () => {
  const write = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
  expect(await copyText('hi')).toBe(true)
  expect(write).toHaveBeenCalledWith('hi')
})

it('falls back to execCommand when the clipboard API rejects', async () => {
  vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'))
  const exec = vi.fn().mockReturnValue(true)
  Object.defineProperty(document, 'execCommand', { configurable: true, value: exec })
  expect(await copyText('fallback')).toBe(true)
  expect(exec).toHaveBeenCalledWith('copy')
  expect(document.querySelector('textarea')).toBeNull()
})
