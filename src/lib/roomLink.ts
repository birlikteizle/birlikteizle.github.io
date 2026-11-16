import { isValidRoomId } from '@/lib/ids'
import { isP2P } from '@/lib/mode'
import { DEFAULT_CAPACITY, normalizeCapacity, normalizeVisibility } from '@/lib/capacity'
import type { RoomVisibility } from '@/types'

export interface RoomLinkOptions {
  capacity?: number
  /** Sunucusuz modda odanın yöneticisi bu kimlikle eşleşen kullanıcıdır. */
  adminUid?: string
  visibility?: RoomVisibility
}

export function buildRoomUrl(roomId: string, options: RoomLinkOptions = {}): string {
  const base = import.meta.env.BASE_URL || '/'
  const prefix = base.endsWith('/') ? base : `${base}/`
  // Sunucusuz modda yönlendirme hash üzerinden yapılır; GitHub Pages bilinmeyen
  // yollar için 404 döndürdüğünde bile bağlantı çalışır.
  if (isP2P) {
    // Oda ayarları davet bağlantısıyla taşınır: kapasite, yönetici ve görünürlük.
    const params = new URLSearchParams()
    if (options.capacity) params.set('k', String(normalizeCapacity(options.capacity)))
    if (options.adminUid) params.set('a', options.adminUid)
    if (options.visibility === 'private') params.set('priv', '1')
    const query = params.toString()
    return `${window.location.origin}${prefix}#/room/${roomId}${query ? `?${query}` : ''}`
  }
  return `${window.location.origin}${prefix}room/${roomId}`
}

export interface RoomLinkMeta {
  capacity: number
  adminUid: string
  visibility: RoomVisibility
}

/** Sunucusuz modda oda ayarlarını adresin `#/room/<id>?…` kısmından okur. */
export function readRoomMetaFromLocation(): RoomLinkMeta {
  const fallback: RoomLinkMeta = {
    capacity: DEFAULT_CAPACITY,
    adminUid: '',
    visibility: 'public',
  }
  if (typeof window === 'undefined') return fallback

  const hash = window.location.hash
  const queryIndex = hash.indexOf('?')
  if (queryIndex === -1) return fallback

  try {
    const params = new URLSearchParams(hash.slice(queryIndex + 1))
    return {
      capacity: normalizeCapacity(params.get('k'), fallback.capacity),
      adminUid: params.get('a') ?? '',
      visibility: params.get('priv') === '1' ? 'private' : normalizeVisibility('public'),
    }
  } catch {
    return fallback
  }
}

/**
 * Sunucusuz modda kapasiteyi adresten okur. Bilgi yoksa varsayılana düşer.
 */
export function readRoomCapacityFromLocation(fallback = DEFAULT_CAPACITY): number {
  return readRoomMetaFromLocation().capacity || fallback
}

/**
 * Bir davet bağlantısından, tam URL'den veya çıplak oda kimliğinden oda
 * kimliğini çıkarır. Geçersizse `null` döner; asla yeni kimlik üretmez.
 */
export function parseRoomReference(rawInput: string): string | null {
  const input = rawInput.trim()
  if (!input) return null
  if (isValidRoomId(input)) return input

  let candidate = input
  if (candidate.startsWith('//')) candidate = `https:${candidate}`
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(candidate)) candidate = `https://${candidate}`

  try {
    const url = new URL(candidate)
    // HashRouter bağlantıları: .../#/room/<id>?k=6 — sorgu kısmı atılır.
    const hashPath = url.hash.startsWith('#/') ? url.hash.slice(1).split('?')[0] : ''
    const segments = (hashPath || url.pathname).split('/').filter(Boolean)
    const roomIndex = segments.findIndex((segment) => ['room', 'join', 'oda'].includes(segment.toLowerCase()))
    if (roomIndex >= 0) {
      const candidateId = segments[roomIndex + 1]
      if (candidateId && isValidRoomId(candidateId)) return candidateId
    }
    const directMatch = segments.find((segment) => isValidRoomId(segment))
    return directMatch ?? null
  } catch {
    return null
  }
}

export function shortRoomCode(roomId: string): string {
  return roomId.slice(0, 8).toUpperCase()
}
