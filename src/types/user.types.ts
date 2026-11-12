import type { ISODateString, UserId } from './common.types'

export interface User {
  id: UserId
  name: string
  avatarUrl: string
  isOnline: boolean
  lastSeen?: ISODateString
  /** Short status line shown in the profile panel. */
  about?: string
}
