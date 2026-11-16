import type { AppUser, VideoSource } from '@/types'
import { api } from '@/lib/api'
import { isP2P } from '@/lib/mode'

/**
 * Oda oluşturur ve yeni oda kimliğini döner.
 *
 * - Sunucu modunda oda sunucuda doğrulanarak açılır.
 * - Sunucusuz (P2P) modda kimlik tarayıcıda üretilir; seçilen kaynak, oda
 *   sayfası açılana kadar oturum deposunda tutulur.
 */
export async function createRoom(
  _user: AppUser | null,
  source: VideoSource | null,
  capacity?: number,
): Promise<string> {
  if (isP2P) {
    const { createRoomId, stashInitialSource } = await import('@/lib/p2p/room')
    const roomId = createRoomId()
    if (source) {
      stashInitialSource(roomId, {
        provider: source.provider,
        url: source.url,
        videoId: source.videoId,
        startAt: source.startAt,
      })
    }
    return roomId
  }

  const { roomId } = await api.createRoom(source, capacity)
  return roomId
}

export async function sendChatMessage(
  roomId: string,
  user: AppUser | null,
  rawText: string,
): Promise<void> {
  const text = sanitizeMessage(rawText)
  if (!text) throw new Error('Boş mesaj gönderilemez.')
  if (text.length > 2000) throw new Error('Mesaj en fazla 2000 karakter olabilir.')

  if (isP2P) {
    const { getP2PRoom } = await import('@/lib/p2p/room')
    getP2PRoom(roomId).sendChat({
      id: createMessageId(),
      senderId: user?.uid ?? 'yerel',
      senderName: user?.displayName?.trim() || 'Kullanıcı',
      photoURL: null,
      text,
      createdAt: Date.now(),
    })
    return
  }

  await api.sendMessage(roomId, text)
}

function createMessageId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function sanitizeMessage(rawText: string): string {
  return rawText
    .replace(/\r\n/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim()
}