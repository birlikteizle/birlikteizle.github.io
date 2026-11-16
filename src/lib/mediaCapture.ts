import type { BroadcastKind } from '@/hooks/screenShareTypes'

/**
 * Medya yakalama yardımcıları.
 *
 * Tarayıcı desteği cihaza göre değişir:
 * - **Ekran/sekme yakalama** (`getDisplayMedia`) yalnızca masaüstü tarayıcılarda
 *   vardır. iOS ve Android tarayıcıları web sayfasına ekran erişimi vermez.
 * - **Kamera** (`getUserMedia`) hemen her cihazda çalışır.
 *
 * Bu yüzden telefonda yayın açmak isteyen kullanıcıya kamera yayını sunulur:
 * telefonu ekrana/TV'ye çevirip yayın açabilir.
 */

export function hasMediaDevices(): boolean {
  return typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices)
}

export function supportsScreen(): boolean {
  return hasMediaDevices() && typeof navigator.mediaDevices.getDisplayMedia === 'function'
}

export function supportsCamera(): boolean {
  return hasMediaDevices() && typeof navigator.mediaDevices.getUserMedia === 'function'
}

export function supportsTouch(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(pointer: coarse)').matches ?? false
}

export function isSecure(): boolean {
  return typeof window === 'undefined' ? true : window.isSecureContext
}

/** Ekran/sekme paylaşımı isteği. */
export async function captureScreen(): Promise<MediaStream> {
  if (!supportsScreen()) {
    throw new DOMException('Screen capture is not supported', 'NotSupportedError')
  }
  return navigator.mediaDevices.getDisplayMedia({
    video: { frameRate: { ideal: 30, max: 60 } },
    audio: true,
  })
}

export interface CaptureCameraOptions {
  facingMode?: 'user' | 'environment'
  withAudio?: boolean
}

/** Kamera yayını isteği (telefonlar için ekran paylaşımının karşılığı). */
export async function captureCamera({
  facingMode = 'environment',
  withAudio = true,
}: CaptureCameraOptions = {}): Promise<MediaStream> {
  if (!supportsCamera()) {
    throw new DOMException('Camera is not supported', 'NotSupportedError')
  }
  return navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: { ideal: facingMode },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
    audio: withAudio,
  })
}

/** Yakalama hatalarını kullanıcıya gösterilecek Türkçe metne çevirir. */
export function broadcastErrorMessage(error: unknown, mode: BroadcastKind): string {
  const name = (error as { name?: string })?.name ?? ''

  switch (name) {
    case 'NotAllowedError':
      return mode === 'screen'
        ? 'Ekran paylaşımı izni verilmedi. Tarayıcı adres çubuğundaki izin simgesinden "Ekran kaydı" iznini açıp tekrar dene.'
        : 'Kamera/mikrofon izni verilmedi. Tarayıcının izin simgesinden kameraya izin verip tekrar dene.'
    case 'NotSupportedError':
    case 'TypeError':
      return 'Bu cihaz ekran paylaşımını desteklemiyor. Telefonlarda tarayıcılar ekranı paylaşmaya izin vermez; kamera yayınını kullanabilirsin.'
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'Kamera bulunamadı. Başka uygulamalar kamerayı kullanıyor olabilir; onları kapatıp tekrar dene.'
    case 'NotReadableError':
    case 'AbortError':
      return 'Kamera/ekran başka bir uygulama tarafından kullanılıyor. Diğer uygulamaları kapatıp tekrar dene.'
    default:
      return 'Yayın başlatılamadı. Sayfayı yenileyip tekrar dene.'
  }
}

/** Cihaz için önerilen yayın türü. */
export function preferredBroadcastKind(): BroadcastKind {
  return supportsScreen() ? 'screen' : 'camera'
}