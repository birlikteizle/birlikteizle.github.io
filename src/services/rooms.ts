import type { AppUser, VideoSource } from '@/types'
import { api } from '@/lib/api'

/**
 * Oda oluşturur ve yeni oda kimliğini döner. Kaynak doğrulaması hem istemcide
 * hem sunucuda yapılır.
 */
export async function createRoom(_user: AppUser | null, source: VideoSource | null): Promise<string> {
  const { roomId } = await api.createRoom(source)
  return roomId
}

export async function sendChatMessage(roomId: string, _user: AppUser | null, rawText: string): Promise<void> {
  const text = sanitizeMessage(rawText)
  if (!text) throw new Error('Boş mesaj gönderilemez.')
  if (text.length > 2000) throw new Error('Mesaj en fazla 2000 karakter olabilir.')
  await api.sendMessage(roomId, text)
}

export function sanitizeMessage(rawText: string): string {
  return rawText
    .replace(/\r\n/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim()
}
