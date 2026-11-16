import type { Ref } from 'react'

export interface PlayerHandle {
  play: () => Promise<void>
  pause: () => void
  seek: (seconds: number) => void
  setPlaybackRate: (rate: number) => void
  getCurrentTime: () => number
  getDuration: () => number
  getPlaybackRate: () => number
  isPaused: () => boolean
  isBuffering: () => boolean
  setVolume: (volume: number) => void
  setMuted: (muted: boolean) => void
}

export interface PlayerEvents {
  onReady: () => void
  onTimeUpdate: (currentTime: number, duration: number, bufferedEnd: number) => void
  onEnded: () => void
  onError: (message: string) => void
}

export interface PlayableSource {
  provider: 'youtube' | 'vimeo' | 'html5' | 'hls' | 'iframe'
  url: string
  videoId: string
  embedUrl: string
  startAt: number
}

export interface PlayerProps {
  source: PlayableSource
  events: PlayerEvents
  ref?: Ref<PlayerHandle>
}
