import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { watchRemoteStream } from '@/lib/remoteStream'

class FakeTrack extends EventTarget {
  muted = false
  readyState: 'live' | 'ended' = 'live'
  kind = 'video'
}

function fakeStream(tracks: FakeTrack[]): MediaStream {
  return { getTracks: () => tracks } as unknown as MediaStream
}

const originalWindow = (globalThis as { window?: unknown }).window

beforeEach(() => {
  vi.useFakeTimers()
  ;(globalThis as { window?: unknown }).window = {
    setTimeout: (handler: () => void, delay?: number) => setTimeout(handler, delay),
    clearTimeout: (id?: number) => clearTimeout(id),
  }
})

afterEach(() => {
  vi.useRealTimers()
  ;(globalThis as { window?: unknown }).window = originalWindow
})

describe('watchRemoteStream', () => {
  it('canlı akışta ölü saymaz', () => {
    const onDead = vi.fn()
    const track = new FakeTrack()
    watchRemoteStream(fakeStream([track]), onDead, 3000)

    vi.advanceTimersByTime(5000)
    expect(onDead).not.toHaveBeenCalled()
  })

  it('kanal sustuğunda ölü sayar', () => {
    const onDead = vi.fn()
    const track = new FakeTrack()
    watchRemoteStream(fakeStream([track]), onDead, 3000)

    track.muted = true
    track.dispatchEvent(new Event('mute'))

    vi.advanceTimersByTime(2000)
    expect(onDead).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1200)
    expect(onDead).toHaveBeenCalledTimes(1)
  })

  it('süre dolmadan geri gelirse ölü saymaz', () => {
    const onDead = vi.fn()
    const track = new FakeTrack()
    watchRemoteStream(fakeStream([track]), onDead, 3000)

    track.muted = true
    track.dispatchEvent(new Event('mute'))
    vi.advanceTimersByTime(1000)

    track.muted = false
    track.dispatchEvent(new Event('unmute'))
    vi.advanceTimersByTime(5000)

    expect(onDead).not.toHaveBeenCalled()
  })

  it('zaten sessiz gelen akışı izlemeye başlar', () => {
    const onDead = vi.fn()
    const track = new FakeTrack()
    track.muted = true

    watchRemoteStream(fakeStream([track]), onDead, 1000)
    vi.advanceTimersByTime(1200)

    expect(onDead).toHaveBeenCalledTimes(1)
  })

  it('temizleme fonksiyonu dinleyicileri ve zamanlayıcıyı kaldırır', () => {
    const onDead = vi.fn()
    const track = new FakeTrack()
    const stop = watchRemoteStream(fakeStream([track]), onDead, 3000)

    stop()
    track.muted = true
    track.dispatchEvent(new Event('mute'))
    vi.advanceTimersByTime(5000)

    expect(onDead).not.toHaveBeenCalled()
  })
})