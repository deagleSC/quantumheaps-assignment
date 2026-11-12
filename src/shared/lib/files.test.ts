import { readAsDataUrl, shrinkImage } from './files'

const file = (type: string, size: number) => new File([new Uint8Array(size)], 'x', { type })

describe('shrinkImage', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('leaves small images, GIFs and non-images alone', async () => {
    const small = file('image/png', 1000)
    const gif = file('image/gif', 900_000)
    const pdf = file('application/pdf', 900_000)
    expect(await shrinkImage(small)).toBe(small)
    expect(await shrinkImage(gif)).toBe(gif)
    expect(await shrinkImage(pdf)).toBe(pdf)
  })

  it('returns the original when the browser cannot decode it', async () => {
    const big = file('image/jpeg', 900_000)
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('bad image')))
    expect(await shrinkImage(big)).toBe(big)
  })

  it('scales the longest side down and keeps the smaller JPEG', async () => {
    const big = file('image/png', 900_000)
    const close = vi.fn()
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn().mockResolvedValue({ width: 4000, height: 2000, close }),
    )
    const drawImage = vi.fn()
    const smaller = new Blob([new Uint8Array(100)], { type: 'image/jpeg' })
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage }),
      toBlob: (cb: (b: Blob) => void, type: string) => {
        expect(type).toBe('image/jpeg')
        cb(smaller)
      },
    }
    const create = vi.spyOn(document, 'createElement').mockReturnValueOnce(canvas as never)
    expect(await shrinkImage(big, 1600)).toBe(smaller)
    expect([canvas.width, canvas.height]).toEqual([1600, 800])
    expect(drawImage).toHaveBeenCalled()
    expect(close).toHaveBeenCalled()
    create.mockRestore()
  })

  it('keeps the original if re-encoding would be bigger', async () => {
    const big = file('image/webp', 500_000)
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn().mockResolvedValue({ width: 100, height: 100, close() {} }),
    )
    const canvas = {
      getContext: () => ({ drawImage() {} }),
      toBlob: (cb: (b: Blob) => void) => cb(new Blob([new Uint8Array(600_000)])),
    }
    const create = vi.spyOn(document, 'createElement').mockReturnValueOnce(canvas as never)
    expect(await shrinkImage(big)).toBe(big)
    create.mockRestore()
  })
})

it('readAsDataUrl encodes blobs', async () => {
  expect(await readAsDataUrl(new Blob(['hi'], { type: 'text/plain' }))).toBe(
    'data:text/plain;base64,aGk=',
  )
})
