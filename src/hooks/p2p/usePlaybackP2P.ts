import { useCallback, useEffect, useRef, useState } from 'react'
import type { PlaybackState } from '@/types'
import { createCommandId } from '@/lib/ids'
import { clamp } from '@/lib/utils'
import { computeExpectedTime } from '@/lib/playback'
import { buildInitialPlayback, retainP2PRoom, takeInitialSource } from '@/lib/p2p/room'
import { shouldApplyPlayback } from '@/lib/p2p/local'
import type { PlaybackCommand, UsePlaybackResult } from '@/hooks/playbackTypes'

/**
 * Sunucusuz (P2P) oynatma senkronu.
 *
 * Zaman damgası yerine "alım anı" kullanılır: gelen komutun `updatedAt` değeri
 * yerel saate yazılır. Böylece iki cihazın saatleri farklı olsa bile oynatıcı
 * aynı noktaya hizalanır (fark yalnızca ağ gecikmesi kadardır).
 *
 * Sıralama için gönderenin kendi zaman damgası ayrıca karşılaştırılır; böylece
 * odaya sonradan katılan tarafın boş durumu mevcut videoyu ezmez.
 */
export function usePlaybackP2P(roomId: string, uid: string): UsePlaybackResult {
  const [playback, setPlayback] = useState<PlaybackState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [syncNonce, setSyncNonce] = useState(0)

  const lastLocalCommandIdRef = useRef<string | null>(null)
  const playbackRef = useRef<PlaybackState | null>(null)
  playbackRef.current = playback
  /** En son uygulanan komutun gönderen zaman damgası (çakışma çözümü). */
  const lastAppliedAtRef = useRef(0)
  const roomRef = useRef<ReturnType<typeof retainP2PRoom>['room'] | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const { room, release } = retainP2PRoom(roomId)
    roomRef.current = room

    // Oda kurulurken seçilen kaynak varsa yerel başlangıç durumu oluştur.
    const initialSource = takeInitialSource(roomId)
    if (initialSource) {
      const initial = buildInitialPlayback(initialSource, uid)
      lastAppliedAtRef.current = initial.updatedAt
      setPlayback(initial)
      room.sendState(initial)
    }
    setLoading(false)

    const unsubscribe = room.subscribe((event) => {
      if (event.type === 'state') {
        const incoming = event.playback
        const current = playbackRef.current

        if (!shouldApplyPlayback(incoming, current, lastAppliedAtRef.current)) return

        lastAppliedAtRef.current = Number(incoming.updatedAt) || 0
        setPlayback({ ...incoming, updatedAt: Date.now() })
        setLoading(false)
        setError(null)
      } else if (event.type === 'peers') {
        if (event.peerIds.length > 0) {
          // Yeni katılan taraf mevcut durumu öğrensin.
          const current = playbackRef.current
          if (current?.sourceUrl) room.sendState(current)
          setSyncNonce((value) => value + 1)
        }
      } else if (event.type === 'error') {
        setError(event.message)
      }
    })

    return () => {
      unsubscribe()
      roomRef.current = null
      release()
    }
  }, [roomId, uid])

  const publish = useCallback(
    async (patch: PlaybackCommand): Promise<string> => {
      const commandId = createCommandId()
      const previous = playbackRef.current
      const sanitizedTime = Math.max(0, Number.isFinite(patch.currentTime) ? patch.currentTime : 0)
      const sanitizedRate = clamp(patch.playbackRate, 0.25, 4)

      const next: PlaybackState = {
        sourceUrl: patch.sourceUrl ?? previous?.sourceUrl ?? '',
        provider: patch.provider ?? previous?.provider ?? 'none',
        videoId: patch.videoId ?? previous?.videoId ?? '',
        status: patch.status,
        currentTime: sanitizedTime,
        playbackRate: sanitizedRate,
        updatedAt: Date.now(),
        updatedBy: uid,
        commandId,
      }

      lastLocalCommandIdRef.current = commandId
      lastAppliedAtRef.current = next.updatedAt
      playbackRef.current = next
      setPlayback(next)
      roomRef.current?.sendState(next)

      return commandId
    },
    [uid],
  )

  return {
    playback,
    loading,
    error,
    serverOffset: 0,
    syncNonce,
    lastLocalCommandIdRef,
    publish,
  }
}

export { computeExpectedTime }