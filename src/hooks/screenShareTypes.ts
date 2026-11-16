export type ScreenShareRole = 'idle' | 'sharing' | 'watching'

/** Yayın türü: ekran/sekme yakalama ya da kamera. */
export type BroadcastKind = 'screen' | 'camera'

export interface ScreenShareResult {
  role: ScreenShareRole
  error: string | null
  sharerName: string | null
  localStream: MediaStream | null
  remoteStream: MediaStream | null
  /** Yayını başlatır. Ekran desteklenmiyorsa (telefon) kamera kullanılır. */
  startSharing: (kind?: BroadcastKind) => Promise<void>
  stopSharing: () => void
  isSharing: boolean
  isWatching: boolean
  /** Aktif yayının türü. */
  kind: BroadcastKind | null
  /**
   * Tarayıcı ekran/sekme yakalamayı destekliyor mu?
   * Masaüstü tarayıcılarda evet; telefon tarayıcılarında hayır.
   */
  canShareScreen: boolean
  /** Kamera yayını destekleniyor mu? Hemen her cihazda evet. */
  canShareCamera: boolean
  /** Kamera yayınında ön/arka kamerayı değiştirir. */
  switchCamera: () => Promise<void>
  /** Gönderilen ses açık mı? (kamera yayınında ortam sesi) */
  micEnabled: boolean
  toggleMic: () => void
}