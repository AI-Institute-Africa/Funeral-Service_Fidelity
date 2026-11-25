import fs from 'node:fs'
import path from 'node:path'

export interface FallbackUserRecord {
  id: string
  name: string
  phone: string
  email?: string
  role: 'CUSTOMER' | 'ADMIN'
  language: 'en' | 'sn' | 'nd'
  createdAt: string
  lastLoginAt?: string
}

const DATA_DIR = path.resolve(process.cwd(), '.data')
const USERS_FILE = path.join(DATA_DIR, 'users.json')

const SEED_USERS: FallbackUserRecord[] = [
  {
    id: 'u-moyo',
    name: 'Rutendo Moyo',
    phone: '+263772123456',
    role: 'CUSTOMER',
    language: 'en',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
]

function readUsers(): FallbackUserRecord[] {
  try {
    if (!fs.existsSync(USERS_FILE)) return [...SEED_USERS]
    const raw = fs.readFileSync(USERS_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed as FallbackUserRecord[]
  } catch {
    // Corrupted or unreadable store: start from seed list.
  }
  return [...SEED_USERS]
}

function writeUsers(users: FallbackUserRecord[]): void {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8')
}

export function findFallbackUserByPhone(phone: string): FallbackUserRecord | undefined {
  return readUsers().find((u) => u.phone === phone)
}

export function findFallbackUserById(id: string): FallbackUserRecord | undefined {
  return readUsers().find((u) => u.id === id)
}

export function createFallbackUser(input: {
  id: string
  name: string
  phone: string
  email?: string
  role?: 'CUSTOMER' | 'ADMIN'
}): FallbackUserRecord {
  const users = readUsers()
  const record: FallbackUserRecord = {
    id: input.id,
    name: input.name,
    phone: input.phone,
    ...(input.email ? { email: input.email } : {}),
    role: input.role ?? 'CUSTOMER',
    language: 'en',
    createdAt: new Date().toISOString(),
  }
  users.push(record)
  writeUsers(users)
  return record
}

export function updateFallbackUser(
  id: string,
  patch: { name?: string; email?: string; language?: 'en' | 'sn' | 'nd'; lastLoginAt?: string },
): FallbackUserRecord | undefined {
  const users = readUsers()
  const idx = users.findIndex((u) => u.id === id)
  if (idx === -1) return undefined
  const current = users[idx]
  const updated: FallbackUserRecord = {
    ...current,
    ...(patch.name !== undefined ? { name: patch.name } : {}),
    ...(patch.email !== undefined ? (patch.email ? { email: patch.email } : { email: undefined }) : {}),
    ...(patch.language !== undefined ? { language: patch.language } : {}),
    ...(patch.lastLoginAt !== undefined ? { lastLoginAt: patch.lastLoginAt } : {}),
  }
  if (patch.email === '') delete updated.email
  users[idx] = updated
  writeUsers(users)
  return updated
}
