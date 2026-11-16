import type { VideoProvider } from '@/types'
import { isValidRoomId } from '@/lib/ids'
import { safeLocalStorageGet, safeLocalStorageRemove, safeLocalStorageSet } from '@/lib/utils'

export interface RecentRoom {
  id: string
  visitedAt: number
  provider: VideoProvider
  title: string
}

const STORAGE_KEY = 'birlikteizle:recent-rooms'
const MAX_ROOMS = 6
const EVENT_NAME = 'birlikteizle:recent-rooms-changed'

const VALID_PROVIDERS: VideoProvider[] = ['youtube', 'vimeo', 'html5', 'hls', 'none']

function isRecentRoom(value: unknown): value is RecentRoom {
  if (!value || typeof value !== 'object') return false
  const room = value as Partial<RecentRoom>
  return (
    typeof room.id === 'string' &&
    isValidRoomId(room.id) &&
    typeof room.visitedAt === 'number' &&
    typeof room.title === 'string' &&
    VALID_PROVIDERS.includes(room.provider as VideoProvider)
  )
}

export function readRecentRooms(): RecentRoom[] {
  const raw = safeLocalStorageGet(STORAGE_KEY)
  if (!raw) return []

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isRecentRoom).sort((a, b) => b.visitedAt - a.visitedAt).slice(0, MAX_ROOMS)
  } catch {
    return []
  }
}

export function saveRecentRoom(room: Omit<RecentRoom, 'visitedAt'>): void {
  const next: RecentRoom[] = [
    { ...room, visitedAt: Date.now() },
    ...readRecentRooms().filter((item) => item.id !== room.id),
  ].slice(0, MAX_ROOMS)

  safeLocalStorageSet(STORAGE_KEY, JSON.stringify(next))
  window.dispatchEvent(new Event(EVENT_NAME))
}

export function clearRecentRooms(): void {
  safeLocalStorageRemove(STORAGE_KEY)
  window.dispatchEvent(new Event(EVENT_NAME))
}

export function subscribeToRecentRooms(listener: () => void): () => void {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) listener()
  }
  window.addEventListener('storage', handleStorage)
  window.addEventListener(EVENT_NAME, listener)
  return () => {
    window.removeEventListener('storage', handleStorage)
    window.removeEventListener(EVENT_NAME, listener)
  }
}
