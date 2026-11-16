import { isValidRoomId } from '@/lib/ids'

export function buildRoomUrl(roomId: string): string {
  const base = import.meta.env.BASE_URL || '/'
  const prefix = base.endsWith('/') ? base : `${base}/`
  return `${window.location.origin}${prefix}room/${roomId}`
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
    const segments = url.pathname.split('/').filter(Boolean)
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
