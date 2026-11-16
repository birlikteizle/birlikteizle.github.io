import { isP2P } from '@/lib/mode'
import { usePlaybackServer } from '@/hooks/server/usePlaybackServer'
import { usePlaybackP2P } from '@/hooks/p2p/usePlaybackP2P'

export type { PlaybackCommand, UsePlaybackResult } from '@/hooks/playbackTypes'
export { computeExpectedTime } from '@/lib/playback'

/**
 * Oynatma durumu ve yayınlama.
 *
 * Mod derleme zamanında sabittir: `server` modunda REST+SSE, `p2p` modunda
 * doğrudan tarayıcılar arası kanal kullanılır. Arayüz tarafında fark yoktur.
 */
export const usePlayback = isP2P ? usePlaybackP2P : usePlaybackServer