import type { MutableRefObject } from 'react'
import type { PlaybackState, PlaybackStatus, VideoProvider } from '@/types'

export interface PlaybackCommand {
  status: PlaybackStatus
  currentTime: number
  playbackRate: number
  sourceUrl?: string
  provider?: VideoProvider
  videoId?: string
}

export interface UsePlaybackResult {
  playback: PlaybackState | null
  loading: boolean
  error: string | null
  serverOffset: number
  /** Bağlantı yeniden kurulduğunda artar; oynatıcı son duruma zorla hizalanır. */
  syncNonce: number
  lastLocalCommandIdRef: MutableRefObject<string | null>
  publish: (patch: PlaybackCommand) => Promise<string>
}