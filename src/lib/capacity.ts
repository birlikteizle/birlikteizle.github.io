/**
 * Oda kapasitesi.
 *
 * Her oda oluşturulurken bir kapasite seçilir. Sunucu modunda sunucu bu sayıyı
 * uygular; sunucusuz (P2P) modda kapasite davet bağlantısındaki `?k=` değeriyle
 * taşınır ve eşleşme ağı bu sayıya göre sınırlanır.
 */

import type { RoomVisibility } from '@/types'

export const MIN_CAPACITY = 2
export const MAX_CAPACITY = 50
export const DEFAULT_CAPACITY = 2

/** Oluşturma ekranında sunulan hazır seçenekler. */
export const CAPACITY_OPTIONS = [2, 3, 4, 5, 6, 8, 10, 15, 20, 30, 50] as const

export function normalizeCapacity(value: unknown, fallback = DEFAULT_CAPACITY): number {
  const parsed = Math.floor(Number(value))
  if (!Number.isFinite(parsed)) return fallback
  if (parsed < MIN_CAPACITY) return MIN_CAPACITY
  return Math.min(MAX_CAPACITY, parsed)
}

/** "3/10 kişi" gibi doluluk etiketi. */
export function occupancyLabel(count: number, capacity: number): string {
  return `${count}/${capacity} kişi`
}

/**
 * Sunucusuz (P2P) modda kaç kişiden sonra uyarı gösterilir: herkes herkesle
 * doğrudan bağlandığı için kalabalık odalarda bağlantı sayısı hızla artar.
 */
export const P2P_CROWDED_THRESHOLD = 8

/* ------------------------------------------------------------------ */
/* Oda görünürlüğü                                                     */
/* ------------------------------------------------------------------ */

export const VISIBILITY_OPTIONS: Array<{ value: RoomVisibility; label: string; hint: string }> = [
  {
    value: 'public',
    label: 'Herkese açık',
    hint: 'Oda bilgisi listelenebilir; davet bağlantısı yine gerekir.',
  },
  {
    value: 'private',
    label: 'Özel',
    hint: 'Oda hiçbir listede görünmez; yalnızca davet bağlantısıyla girilir.',
  },
]

export function normalizeVisibility(
  value: unknown,
  fallback: RoomVisibility = 'public',
): RoomVisibility {
  if (value === 'private') return 'private'
  if (value === 'public') return 'public'
  return fallback
}

export function visibilityLabel(value: RoomVisibility): string {
  return value === 'private' ? 'Özel oda' : 'Herkese açık'
}