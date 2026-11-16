import { isValidRoomId } from '@/lib/ids'
import { isP2P } from '@/lib/mode'
import { DEFAULT_CAPACITY, normalizeCapacity } from '@/lib/capacity'

export function buildRoomUrl(roomId: string, capacity?: number): string {
  const base = import.meta.env.BASE_URL || '/'
  const prefix = base.endsWith('/') ? base : `${base}/`
  // Sunucusuz modda yönlendirme hash üzerinden yapılır; GitHub Pages bilinmeyen
  // yollar için 404 döndürdüğünde bile bağlantı çalışır.
  if (isP2P) {
    // Kapasite davet bağlantısıyla taşınır: katılan herkes aynı sınırla bağlanır.
    const suffix = capacity ? `?k=${normalizeCapacity(capacity)}` : ''
    return `${window.location.origin}${prefix}#/room/${roomId}${suffix}`
  }
  return `${window.location.origin}${prefix}room/${roomId}`
}

/**
 * Sunucusuz modda kapasiteyi adresin `#/room/<id>?k=<sayı>` kısmından okur.
 * Bilgi yoksa varsayılana düşer.
 */
export function readRoomCapacityFromLocation(fallback = DEFAULT_CAPACITY): number {
  if (typeof window === 'undefined') return fallback
  const hash = window.location.hash
  const queryIndex = hash.indexOf('?')
  if (queryIndex === -1) return fallback
  try {
    const params = new URLSearchParams(hash.slice(queryIndex + 1))
    return normalizeCapacity(params.get('k'), fallback)
  } catch {
    return fallback
  }
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
