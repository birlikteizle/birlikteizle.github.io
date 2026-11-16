import type { PlaybackState, RoomMember, RoomMembers } from '@/types'

/**
 * P2P modunun sunucudan bağımsız yardımcıları. Trystero'ya bağımlı değildir;
 * bu sayede birim testleriyle doğrulanabilir.
 */

const INITIAL_KEY = 'birlikte-izle:p2p-initial'
const ID_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

export const ROOM_ID_LENGTH = 22

/** Yeni oda kimliği üretir (sunucuya sormadan). */
export function createRoomId(randomBytes?: (target: Uint8Array) => Uint8Array): string {
  const bytes = new Uint8Array(ROOM_ID_LENGTH)
  if (randomBytes) {
    randomBytes(bytes)
  } else if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes)
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256)
    }
  }

  let id = ''
  for (const byte of bytes) id += ID_ALPHABET[byte % ID_ALPHABET.length]
  return id
}

export interface InitialSource {
  provider: string
  url: string
  videoId: string
  startAt: number
}

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null
  } catch {
    return null
  }
}

/** Oda kurulurken seçilen kaynağı, oda sayfası açılana kadar saklar. */
export function stashInitialSource(roomId: string, source: InitialSource): void {
  const store = storage()
  if (!store) return
  try {
    const raw = store.getItem(INITIAL_KEY)
    const map = raw ? (JSON.parse(raw) as Record<string, InitialSource>) : {}
    map[roomId] = source
    store.setItem(INITIAL_KEY, JSON.stringify(map))
  } catch {
    /* depolama kapalıysa kaynak kaybolur; kullanıcı oda içinden ekleyebilir */
  }
}

export function takeInitialSource(roomId: string): InitialSource | null {
  const store = storage()
  if (!store) return null
  try {
    const raw = store.getItem(INITIAL_KEY)
    if (!raw) return null
    const map = JSON.parse(raw) as Record<string, InitialSource>
    const source = map[roomId] ?? null
    if (source) {
      delete map[roomId]
      store.setItem(INITIAL_KEY, JSON.stringify(map))
    }
    return source
  } catch {
    return null
  }
}

export function selfMember(uid: string, displayName: string, now = Date.now()): RoomMember {
  return { uid, displayName, photoURL: null, joinedAt: now }
}

export function withMember(members: RoomMembers, member: RoomMember): RoomMembers {
  if (members[member.uid]) return members
  return { ...members, [member.uid]: member }
}

/** Sunucusuz modda odanın ilk oynatma durumunu üretir. */
export function buildInitialPlayback(
  source: InitialSource,
  uid: string,
  commandId = `init-${Math.random().toString(36).slice(2, 10)}`,
  now = Date.now(),
): PlaybackState {
  return {
    sourceUrl: source.url,
    provider: source.provider as PlaybackState['provider'],
    videoId: source.videoId,
    status: 'paused',
    currentTime: Math.max(0, Number(source.startAt) || 0),
    playbackRate: 1,
    updatedAt: now,
    updatedBy: uid,
    commandId,
  }
}

/**
 * Gelen oynatma komutu uygulanmalı mı?
 *
 * - Kaynağı olmayan bir durum, mevcut videoyu ezmez.
 * - Daha eski komutlar yok sayılır (gönderen saatine göre).
 */
export function shouldApplyPlayback(
  incoming: PlaybackState,
  current: PlaybackState | null,
  lastAppliedAt: number,
): boolean {
  if (!incoming.sourceUrl && current?.sourceUrl) return false
  const sentAt = Number(incoming.updatedAt) || 0
  if (current?.sourceUrl && sentAt < lastAppliedAt) return false
  return true
}