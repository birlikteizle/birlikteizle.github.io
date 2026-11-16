/** Sesli sohbette bir katılımcı. */
export interface VoicePeer {
  /** Taşıyıcı kimliği (sunucusuz modda peerId, sunucu modunda uid). */
  id: string
  uid: string
  name: string
  stream: MediaStream | null
  micOn: boolean
  camOn: boolean
}

export interface VoiceChatResult {
  /** Sese katıldık mı? */
  inVoice: boolean
  micEnabled: boolean
  cameraEnabled: boolean
  localStream: MediaStream | null
  peers: VoicePeer[]
  error: string | null
  join: () => Promise<void>
  leave: () => void
  toggleMic: () => void
  toggleCamera: () => Promise<void>
}

/** Tarayıcı izni reddi gibi hataları anlaşılır metne çevirir. */
export function voiceErrorMessage(error: unknown): string {
  const name = (error as { name?: string }).name ?? ''
  switch (name) {
    case 'NotAllowedError':
      return 'Mikrofon/kamera izni verilmedi. Tarayıcının adres çubuğundaki izin simgesinden izin verip tekrar dene.'
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'Mikrofon veya kamera bulunamadı. Başka bir uygulama kullanıyor olabilir.'
    case 'NotReadableError':
    case 'AbortError':
      return 'Mikrofon/kamera başka bir uygulama tarafından kullanılıyor.'
    case 'NotSupportedError':
      return 'Bu tarayıcı sesli sohbeti desteklemiyor.'
    default:
      return 'Sesli sohbete katılınamadı. Sayfayı yenileyip tekrar dene.'
  }
}