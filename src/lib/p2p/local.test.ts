import { beforeEach, describe, expect, it } from 'vitest'
import {
  buildInitialPlayback,
  createRoomId,
  ROOM_ID_LENGTH,
  selfMember,
  stashInitialSource,
  takeInitialSource,
  shouldApplyPlayback,
  withMember,
} from '@/lib/p2p/local'
import { isValidRoomId } from '@/lib/ids'
import type { PlaybackState } from '@/types'

/** Node ortamında `window.sessionStorage` yerine basit bir taklit. */
class MemoryStorage {
  private data = new Map<string, string>()
  getItem(key: string): string | null {
    return this.data.has(key) ? (this.data.get(key) as string) : null
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value)
  }
  removeItem(key: string): void {
    this.data.delete(key)
  }
  clear(): void {
    this.data.clear()
  }
}

beforeEach(() => {
  const storage = new MemoryStorage()
  ;(globalThis as unknown as { window: unknown }).window = { sessionStorage: storage }
})

describe('createRoomId', () => {
  it('geçerli uzunlukta ve alfabeye uygun kimlik üretir', () => {
    const id = createRoomId()
    expect(id).toHaveLength(ROOM_ID_LENGTH)
    expect(isValidRoomId(id)).toBe(true)
    expect(/^[A-Za-z0-9]+$/.test(id)).toBe(true)
  })

  it('artan kimlikler üretir', () => {
    const ids = new Set(Array.from({ length: 30 }, () => createRoomId()))
    expect(ids.size).toBe(30)
  })

  it('verilen rastgele baytları kullanır', () => {
    const id = createRoomId((target) => {
      target.fill(65)
      return target
    })
    // 65 % 62 = 3 → alfabedeki 4. karakter
    expect(new Set(id.split('')).size).toBe(1)
    expect(id).toHaveLength(ROOM_ID_LENGTH)
  })
})

describe('ilk kaynak saklama', () => {
  it('kaynağı oda kimliğiyle saklar ve bir kez tüketir', () => {
    const roomId = createRoomId()
    stashInitialSource(roomId, {
      provider: 'youtube',
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      videoId: 'dQw4w9WgXcQ',
      startAt: 0,
    })

    const first = takeInitialSource(roomId)
    expect(first?.provider).toBe('youtube')
    expect(first?.videoId).toBe('dQw4w9WgXcQ')

    // İkinci okuma boş dönmeli: kaynak yalnızca bir kez uygulanır.
    expect(takeInitialSource(roomId)).toBeNull()
  })

  it('bilinmeyen oda için null döner', () => {
    expect(takeInitialSource('bilinmeyen-oda')).toBeNull()
  })
})

describe('buildInitialPlayback', () => {
  it('kaynaktan duraklatılmış başlangıç durumu üretir', () => {
    const playback = buildInitialPlayback(
      {
        provider: 'hls',
        url: 'https://ornek.com/akis.m3u8',
        videoId: '',
        startAt: 42,
      },
      'uid-1',
      'cmd-1',
      1000,
    )

    expect(playback.provider).toBe('hls')
    expect(playback.status).toBe('paused')
    expect(playback.currentTime).toBe(42)
    expect(playback.updatedBy).toBe('uid-1')
    expect(playback.commandId).toBe('cmd-1')
    expect(playback.updatedAt).toBe(1000)
  })

  it('negatif başlangıcı sıfıra çeker', () => {
    const playback = buildInitialPlayback(
      { provider: 'html5', url: 'https://ornek.com/a.mp4', videoId: '', startAt: -9 },
      'uid',
    )
    expect(playback.currentTime).toBe(0)
  })
})

describe('members', () => {
  it('üyeyi bir kez ekler', () => {
    const member = selfMember('uid-1', 'Ali', 5)
    expect(member).toMatchObject({ uid: 'uid-1', displayName: 'Ali', joinedAt: 5 })

    const first = withMember({}, member)
    expect(Object.keys(first)).toEqual(['uid-1'])

    // Aynı üye tekrar eklenirse nesne değişmemeli (gereksiz render olmasın).
    const second = withMember(first, member)
    expect(second).toBe(first)
  })
})

describe('shouldApplyPlayback', () => {
  const base: PlaybackState = {
    sourceUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    provider: 'youtube',
    videoId: 'dQw4w9WgXcQ',
    status: 'playing',
    currentTime: 10,
    playbackRate: 1,
    updatedAt: 200,
    updatedBy: 'a',
    commandId: 'c1',
  }

  it('kaynağı olmayan durum mevcut videoyu ezmez', () => {
    const empty: PlaybackState = {
      ...base,
      sourceUrl: '',
      provider: 'none',
      videoId: '',
      updatedAt: 999,
    }
    expect(shouldApplyPlayback(empty, base, 0)).toBe(false)
  })

  it('daha eski komutu yok sayar', () => {
    expect(shouldApplyPlayback({ ...base, updatedAt: 100 }, base, 500)).toBe(false)
  })

  it('daha yeni komutu uygular', () => {
    expect(shouldApplyPlayback({ ...base, updatedAt: 900 }, base, 500)).toBe(true)
  })

  it('yerel durum yokken gelen kaynağı kabul eder', () => {
    expect(shouldApplyPlayback(base, null, 0)).toBe(true)
  })
})