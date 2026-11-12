import { toast } from 'sonner'

/** Thin wrapper so actions don't depend on the toast library directly. */
export const notify = {
  error: (message: string) => toast.error(message),
  success: (message: string) => toast.success(message),
  info: (message: string) => toast(message),
}
