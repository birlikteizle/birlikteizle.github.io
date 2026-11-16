import type { AppUser } from '@/types'

export interface StoredSession {
  user: AppUser
  token: string
}

const STORAGE_KEY = 'birlikte-izle:session:v2'

function isAppUser(value: unknown): value is AppUser {
  if (!value || typeof value !== 'object') return false
  const user = value as Partial<AppUser>
  return typeof user.uid === 'string' && typeof user.displayName === 'string'
}

export function readSession(): StoredSession | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredSession>
    if (!parsed || typeof parsed.token !== 'string' || !isAppUser(parsed.user)) return null
    return { user: parsed.user, token: parsed.token }
  } catch {
    return null
  }
}

export function writeSession(session: StoredSession): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  } catch {
    /* Depolama kapalıysa oturum yalnızca bu sekmede yaşar. */
  }
}

export function clearSession(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* yoksay */
  }
}

export function currentToken(): string {
  return readSession()?.token ?? ''
}
