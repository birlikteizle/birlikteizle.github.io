import { useCallback, useEffect, useRef, useState } from 'react'
import type { PlaybackState, VideoProvider } from '@/types'
import { api } from '@/lib/api'
import { mapApiError } from '@/lib/errors'
import { createCommandId } from '@/lib/ids'
import { computeExpectedTime } from '@/lib/playback'
import { getRoomChannel } from '@/lib/roomChannel'
import { clamp } from '@/lib/utils'
import { useServerTimeOffset } from '@/hooks/useServerTimeOffset'
import type { PlaybackCommand, UsePlaybackResult } from '@/hooks/playbackTypes'

const VALID_PROVIDERS: VideoProvider[] = ['youtube', 'vimeo', 'html5', 'hls', 'iframe', 'none']

function normalizePlayback(value: Partial<PlaybackState> | null): PlaybackState | null {
  if (!value || typeof value !== 'object') return null

  const provider = VALID_PROVIDERS.includes(value.provider as VideoProvider)
    ? (value.provider as VideoProvider)
    : 'none'

  return {
    sourceUrl: typeof value.sourceUrl === 'string' ? value.sourceUrl.slice(0, 2048) : '',
    provider,
    videoId: typeof value.videoId === 'string' ? value.videoId.slice(0, 128) : '',
    status:
      value.status === 'playing' || value.status === 'paused' || value.status === 'idle'
        ? value.status
        : 'idle',
    currentTime:
      typeof value.currentTime === 'number' && Number.isFinite(value.currentTime)
        ? Math.max(0, value.currentTime)
        : 0,
    playbackRate:
      typeof value.playbackRate === 'number' && Number.isFinite(value.playbackRate)
        ? clamp(value.playbackRate, 0.25, 4)
        : 1,
    updatedAt:
      typeof value.updatedAt === 'number' && Number.isFinite(value.updatedAt) ? value.updatedAt : 0,
    updatedBy: typeof value.updatedBy === 'string' ? value.updatedBy : '',
    commandId: typeof value.commandId === 'string' ? value.commandId : 'init',
  }
}

/** Sunucu modu: oynatma durumu REST ile yazılır, SSE ile dinlenir. */
export function usePlaybackServer(roomId: string, uid: string): UsePlaybackResult {
  const serverOffset = useServerTimeOffset()

  const [playback, setPlayback] = useState<PlaybackState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [syncNonce, setSyncNonce] = useState(0)

  const lastLocalCommandIdRef = useRef<string | null>(null)
  const hasSnapshotRef = useRef(false)

  useEffect(() => {
    hasSnapshotRef.current = false
    setLoading(true)
    setError(null)

    const channel = getRoomChannel(roomId)
    return channel.subscribe((event) => {
      if (event.type === 'snapshot') {
        hasSnapshotRef.current = true
        setPlayback(normalizePlayback(event.snapshot.playback))
        setLoading(false)
        setError(null)
      } else if (event.type === 'playback') {
        setPlayback(normalizePlayback(event.playback))
        setLoading(false)
        setError(null)
      } else if (event.type === 'status' && event.connected && hasSnapshotRef.current) {
        setSyncNonce((value) => value + 1)
      }
    })
  }, [roomId])

  const publish = useCallback(
    async (patch: PlaybackCommand): Promise<string> => {
      const commandId = createCommandId()
      const optimisticTime = Date.now() + serverOffset
      const sanitizedTime = Math.max(0, Number.isFinite(patch.currentTime) ? patch.currentTime : 0)
      const sanitizedRate = clamp(patch.playbackRate, 0.25, 4)

      const optionalFields: Partial<PlaybackState> = {}
      if (patch.sourceUrl !== undefined) optionalFields.sourceUrl = patch.sourceUrl
      if (patch.provider !== undefined) optionalFields.provider = patch.provider
      if (patch.videoId !== undefined) optionalFields.videoId = patch.videoId

      lastLocalCommandIdRef.current = commandId

      setPlayback((previous) => ({
        sourceUrl: previous?.sourceUrl ?? '',
        provider: previous?.provider ?? 'none',
        videoId: previous?.videoId ?? '',
        ...previous,
        ...optionalFields,
        status: patch.status,
        currentTime: sanitizedTime,
        playbackRate: sanitizedRate,
        updatedAt: optimisticTime,
        updatedBy: uid,
        commandId,
      }))

      try {
        await api.playback(roomId, {
          status: patch.status,
          currentTime: sanitizedTime,
          playbackRate: sanitizedRate,
          commandId,
          ...optionalFields,
        })
        return commandId
      } catch (writeError) {
        setError(mapApiError(writeError))
        throw writeError
      }
    },
    [roomId, serverOffset, uid],
  )

  return {
    playback,
    loading,
    error,
    serverOffset,
    syncNonce,
    lastLocalCommandIdRef,
    publish,
  }
}

export { computeExpectedTime }