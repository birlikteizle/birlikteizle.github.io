import { describe, expect, it } from 'vitest'
import { computeExpectedTime } from '@/lib/playback'
import type { PlaybackState } from '@/types'

function playback(overrides: Partial<PlaybackState> = {}): PlaybackState {
  return {
    sourceUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    provider: 'youtube',
    videoId: 'dQw4w9WgXcQ',
    status: 'playing',
    currentTime: 10,
    playbackRate: 1,
    updatedAt: 1_000_000,
    updatedBy: 'uid-1',
    commandId: 'cmd-1',
    ...overrides,
  }
}

describe('computeExpectedTime', () => {
  it('oynarken geçen süreyi hız ile çarpar', () => {
    expect(computeExpectedTime(playback(), 0, 1_005_000)).toBe(15)
    expect(computeExpectedTime(playback({ playbackRate: 2 }), 0, 1_003_000)).toBe(16)
  })

  it('sunucu saat farkını hesaba katar', () => {
    // İstemci saati sunucudan 2 saniye geride.
    expect(computeExpectedTime(playback(), 2_000, 1_003_000)).toBe(15)
  })

  it('duraklatılmışken konumu sabit tutar', () => {
    expect(computeExpectedTime(playback({ status: 'paused' }), 0, 1_999_999)).toBe(10)
    expect(computeExpectedTime(playback({ status: 'idle' }), 0, 1_999_999)).toBe(10)
  })

  it('negatif süreleri ve eksik zaman damgasını güvenli işler', () => {
    expect(computeExpectedTime(playback({ updatedAt: 0 }), 0, 9_999_999)).toBe(10)
    expect(computeExpectedTime(playback({ currentTime: 0 }), 0, 500_000)).toBe(0)
    expect(computeExpectedTime(playback(), 0, 900_000)).toBe(10)
  })
})
