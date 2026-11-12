import type { User } from '@/types/user.types'

export const CURRENT_USER_ID = 'u-me'

const avatar = (n: number) => `https://i.pravatar.cc/150?img=${n}`

/** Seed users. Presence and `lastSeen` are set at DB creation time. */
export const seedUsers: Omit<User, 'isOnline' | 'lastSeen'>[] = [
  { id: CURRENT_USER_ID, name: 'Alex Morgan', avatarUrl: avatar(12), about: 'Building things.' },
  { id: 'u-priya', name: 'Priya Sharma', avatarUrl: avatar(47), about: 'Frontend lead' },
  { id: 'u-daniel', name: 'Daniel Kim', avatarUrl: avatar(53), about: 'Shipping on Fridays' },
  { id: 'u-sofia', name: 'Sofia Rossi', avatarUrl: avatar(45), about: 'Product designer' },
  { id: 'u-marcus', name: 'Marcus Johnson', avatarUrl: avatar(59), about: 'Out hiking 🏔️' },
  { id: 'u-aisha', name: 'Aisha Bello', avatarUrl: avatar(44), about: 'UX research' },
  { id: 'u-liam', name: "Liam O'Connor", avatarUrl: avatar(68), about: 'Coffee first' },
  { id: 'u-mei', name: 'Mei Chen', avatarUrl: avatar(32), about: 'Accessibility nerd' },
  { id: 'u-noah', name: 'Noah Fischer', avatarUrl: avatar(60), about: 'Platform team' },
  { id: 'u-elena', name: 'Elena Petrova', avatarUrl: avatar(36), about: 'Illustrator' },
  { id: 'u-omar', name: 'Omar Haddad', avatarUrl: avatar(57), about: 'Weekend climber' },
]

/** Users that start online (the rest show "last seen"). */
export const initiallyOnline = new Set([
  'u-priya',
  'u-sofia',
  'u-aisha',
  'u-mei',
  'u-noah',
  'u-omar',
])
