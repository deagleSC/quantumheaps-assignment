import { renderHook } from '@testing-library/react'
import { realtimeActions } from '@/store'
import { useRealtimeBridge } from '../use-realtime-bridge'

it('connects on mount and disconnects on unmount', () => {
  const disconnect = vi.fn()
  const connect = vi.spyOn(realtimeActions, 'connect').mockReturnValue(disconnect)
  const { unmount, rerender } = renderHook(({ on }) => useRealtimeBridge(on), {
    initialProps: { on: true },
  })
  expect(connect).toHaveBeenCalledOnce()
  rerender({ on: true })
  expect(connect).toHaveBeenCalledOnce()
  unmount()
  expect(disconnect).toHaveBeenCalledOnce()
  connect.mockRestore()
})

it('does nothing when disabled', () => {
  const connect = vi.spyOn(realtimeActions, 'connect')
  renderHook(() => useRealtimeBridge(false))
  expect(connect).not.toHaveBeenCalled()
  connect.mockRestore()
})
