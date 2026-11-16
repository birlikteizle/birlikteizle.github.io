import type { PlaybackState } from '@/types'

/**
 * Oynatma durumundan beklenen anlık konumu hesaplar. Sunucu saat farkı hesaba
 * katılır; böylece ağ gecikmesi videolar arasında kalıcı fark oluşturmaz.
 */
export function computeExpectedTime(
  playback: PlaybackState,
  serverOffset: number,
  now = Date.now(),
): number {
  if (playback.status !== 'playing' || !playback.updatedAt) return playback.currentTime
  const elapsed = Math.max(0, (now + serverOffset - playback.updatedAt) / 1000)
  return Math.max(0, playback.currentTime + elapsed * playback.playbackRate)
}
