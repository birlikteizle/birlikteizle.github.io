import type { VideoProvider, VideoSource } from '@/types'

export type VideoParseFailureCode = 'empty' | 'invalid' | 'insecure' | 'unsupported'

export interface VideoParseSuccess {
  ok: true
  source: VideoSource
  providerLabel: string
  title: string
  /** Oynatıcı bileşeninin kullanacağı gömme adresi. */
  embedUrl: string
  /** Kullanıcıya gösterilecek ek uyarı (ör. gömülü oynatma engellenebilir). */
  note?: string
}

export interface VideoParseFailure {
  ok: false
  code: VideoParseFailureCode
  reason: string
  host: string | null
  externalUrl: string | null
}

export type VideoParseResult = VideoParseSuccess | VideoParseFailure

const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/
const VIMEO_ID_PATTERN = /^\d{5,12}$/

const UNSUPPORTED_HOSTS: Record<string, string> = {
  'netflix.com':
    'Netflix videoları DRM ile korunur ve kendi oynatıcısı dışında oynatılamaz. Bu tür içerikler birlikte izleme odasına eklenemez.',
  'disneyplus.com':
    'Disney+ içerikleri DRM korumalıdır; üçüncü taraf bir oynatıcıda gömülü olarak oynatılamaz.',
  'hotstar.com': 'Disney+ Hotstar içerikleri DRM korumalıdır ve gömülü oynatılamaz.',
  'primevideo.com':
    'Amazon Prime Video içerikleri DRM korumalıdır; harici oynatıcıda senkronize edilemez.',
  'hulu.com': 'Hulu içerikleri DRM korumalıdır ve gömülü oynatılamaz.',
  'max.com': 'Max (HBO) içerikleri DRM korumalıdır ve gömülü oynatılamaz.',
  'hbomax.com': 'HBO Max içerikleri DRM korumalıdır ve gömülü oynatılamaz.',
  'tv.apple.com':
    'Apple TV+ içerikleri DRM korumalıdır. Harici sekmede izlenebilir ancak senkronize kontrol edilemez.',
  'spotify.com': 'Spotify bir video kaynağı değildir. Yalnızca video bağlantıları desteklenir.',
  'instagram.com':
    'Instagram gönderileri gömülü oynatma kısıtları nedeniyle desteklenmiyor. Doğrudan bir video dosyası ya da YouTube/Vimeo bağlantısı kullanın.',
  'tiktok.com':
    'TikTok videoları gömülü oynatma ve senkronizasyon için uygun değildir. YouTube/Vimeo bağlantıları kullanın.',
  'facebook.com':
    'Facebook videoları gömülü oynatma kısıtlarına tabidir ve güvenilir şekilde senkronize edilemez.',
  'twitch.tv':
    'Twitch canlı yayınları bu sürümde desteklenmiyor. HLS (.m3u8) bağlantısı varsa doğrudan ekleyebilirsiniz.',
  'drive.google.com':
    'Google Drive bağlantıları doğrudan medya adresi değildir. Dosyayı herkese açık bir MP4 bağlantısı olarak paylaşmanız gerekir.',
  'docs.google.com': 'Google Docs bağlantısı bir video kaynağı değildir.',
  'vimeo.com': '', // aşağıda özel olarak işlenir
}

const CHANNEL_HOSTS = [
  'youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
  'youtu.be',
]

const VIMEO_HOSTS = ['vimeo.com', 'player.vimeo.com']

function fail(
  code: VideoParseFailureCode,
  reason: string,
  host: string | null = null,
  externalUrl: string | null = null,
): VideoParseFailure {
  return { ok: false, code, reason, host, externalUrl }
}

export function parseStartSeconds(value: string | null | undefined): number {
  if (!value) return 0
  const trimmed = value.trim().toLowerCase()
  if (/^\d+$/.test(trimmed)) {
    const seconds = Number(trimmed)
    return Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0
  }
  const match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(trimmed)
  if (!match) return 0
  const hours = Number(match[1] ?? 0)
  const minutes = Number(match[2] ?? 0)
  const seconds = Number(match[3] ?? 0)
  return Math.max(0, hours * 3600 + minutes * 60 + seconds)
}

function normalizeHost(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, '')
}

function parseYouTube(url: URL, host: string): VideoParseResult {
  if (host === 'youtu.be') {
    const id = url.pathname.split('/').filter(Boolean)[0] ?? ''
    if (!YOUTUBE_ID_PATTERN.test(id)) {
      return fail('invalid', 'YouTube kısa bağlantısındaki video kimliği geçersiz görünüyor.', host, url.toString())
    }
    const startAt = parseStartSeconds(url.searchParams.get('t') ?? url.searchParams.get('start'))
    return youtubeSuccess(id, startAt)
  }

  const segments = url.pathname.split('/').filter(Boolean)
  const first = segments[0]?.toLowerCase() ?? ''

  if (first === 'playlist') {
    return fail(
      'unsupported',
      'YouTube oynatma listesi bağlantıları desteklenmiyor. Tek bir videonun bağlantısını yapıştırın.',
      host,
      url.toString(),
    )
  }

  let id = ''
  if (first === 'watch') {
    id = url.searchParams.get('v') ?? ''
  } else if (['shorts', 'embed', 'live', 'v', 'e'].includes(first)) {
    id = segments[1] ?? ''
  } else if (segments.length === 1 && url.searchParams.has('v')) {
    id = url.searchParams.get('v') ?? ''
  }

  if (!id) {
    return fail(
      'invalid',
      'Bu YouTube bağlantısından bir video kimliği okunamadı. Tarayıcıdaki videonun adresini kopyalayıp yapıştırın.',
      host,
      url.toString(),
    )
  }
  if (!YOUTUBE_ID_PATTERN.test(id)) {
    return fail('invalid', 'YouTube video kimliği geçersiz görünüyor.', host, url.toString())
  }

  const startAt = parseStartSeconds(url.searchParams.get('t') ?? url.searchParams.get('start'))
  return youtubeSuccess(id, startAt)
}

function youtubeSuccess(id: string, startAt: number): VideoParseSuccess {
  const canonical = `https://www.youtube.com/watch?v=${id}${startAt ? `&t=${startAt}` : ''}`
  return {
    ok: true,
    source: { provider: 'youtube', url: canonical, videoId: id, startAt },
    providerLabel: 'YouTube',
    title: 'YouTube videosu',
    embedUrl: `https://www.youtube-nocookie.com/embed/${id}?enablejsapi=1&rel=0&modestbranding=1&playsinline=1${
      startAt ? `&start=${startAt}` : ''
    }`,
  }
}

function parseVimeo(url: URL, host: string): VideoParseResult {
  const segments = url.pathname.split('/').filter(Boolean)
  const numericIndex = segments.findIndex((segment) => VIMEO_ID_PATTERN.test(segment))

  if (numericIndex === -1) {
    return fail(
      'invalid',
      'Bu Vimeo bağlantısından bir video kimliği okunamadı. Videonun kendi sayfasının adresini kopyalayın.',
      host,
      url.toString(),
    )
  }

  const id = segments[numericIndex]
  const possibleHash = segments[numericIndex + 1]
  const hash = possibleHash && /^[A-Za-z0-9]{5,32}$/.test(possibleHash) ? possibleHash : null

  const hashFragment = url.hash.match(/[#&]t=([^&]+)/)?.[1]
  const startAt = parseStartSeconds(hashFragment ?? url.searchParams.get('t'))

  const embedUrl = `https://player.vimeo.com/video/${id}${hash ? `?h=${hash}` : ''}`
  const canonical = `https://vimeo.com/${id}${hash ? `/${hash}` : ''}`

  return {
    ok: true,
    source: { provider: 'vimeo', url: canonical, videoId: id, startAt },
    providerLabel: 'Vimeo',
    title: 'Vimeo videosu',
    embedUrl,
  }
}

function parseDirectMedia(url: URL): VideoParseResult {
  const pathname = url.pathname.toLowerCase()
  const extension = pathname.slice(pathname.lastIndexOf('.') + 1)

  if (extension === 'm3u8') {
    return {
      ok: true,
      source: { provider: 'hls', url: url.toString(), videoId: '', startAt: 0 },
      providerLabel: 'HLS',
      title: fileNameFromUrl(url),
      embedUrl: url.toString(),
    }
  }

  if (['mp4', 'webm', 'ogg', 'ogv', 'm4v'].includes(extension)) {
    const provider: Exclude<VideoProvider, 'none'> = 'html5'
    return {
      ok: true,
      source: { provider, url: url.toString(), videoId: '', startAt: 0 },
      providerLabel: extension.toUpperCase(),
      title: fileNameFromUrl(url),
      embedUrl: url.toString(),
    }
  }

  return parseEmbeddedPage(url)
}

/**
 * Tanınmayan ama https olan adresleri gömülü sayfa (iframe) olarak kabul eder.
 * Çoğu site güvenlik başlıklarıyla gömülmeyi engellediği için kullanıcıya not
 * gösterilir; engellenen durumlar için ekran paylaşımı modu önerilir.
 */
function parseEmbeddedPage(url: URL): VideoParseSuccess {
  const host = normalizeHost(url.hostname)
  return {
    ok: true,
    source: { provider: 'iframe', url: url.toString(), videoId: '', startAt: 0 },
    providerLabel: host,
    title: 'Gömülü sayfa',
    embedUrl: url.toString(),
    note:
      'Bu adres gömülü (iframe) olarak açılıyor. Site gömülü oynatmayı engelliyorsa içerik boş görünür; ' +
      'o durumda kaynağı harici sekmede açıp ekran paylaşımı modunu kullan.',
  }
}

function fileNameFromUrl(url: URL): string {
  const raw = url.pathname.split('/').filter(Boolean).pop() ?? ''
  try {
    return decodeURIComponent(raw) || normalizeHost(url.hostname)
  } catch {
    return raw || normalizeHost(url.hostname)
  }
}

/**
 * Yapıştırılan adresi güvenli şekilde analiz eder. Yalnızca gerçekten
 * oynatılabilen kaynakları kabul eder; rastgele URL'leri video saymaz.
 */
export function parseVideoUrl(rawInput: string): VideoParseResult {
  const input = rawInput.trim()

  if (!input) {
    return fail('empty', 'Bir video bağlantısı yapıştırın veya Google üzerinden arayın.')
  }

  if (input.length > 2048) {
    return fail('invalid', 'Bağlantı çok uzun. Lütfen videonun doğrudan adresini kullanın.')
  }

  if (/^(javascript|data|file|vbscript|blob):/i.test(input)) {
    return fail('insecure', 'Güvenlik nedeniyle yalnızca https:// ile başlayan web bağlantıları kabul edilir.')
  }

  let candidate = input
  if (candidate.startsWith('//')) candidate = `https:${candidate}`

  const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(candidate)
  if (!hasScheme) {
    if (!/^[\w.-]+\.[a-zA-Z]{2,}(?::\d+)?(?:[/?#]|$)/.test(candidate)) {
      return fail(
        'invalid',
        'Bu bir bağlantıya benzemiyor. Örnek: https://www.youtube.com/watch?v=... veya https://site.com/video.mp4',
      )
    }
    candidate = `https://${candidate}`
  }

  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    return fail('invalid', 'Bağlantı okunamadı. Lütfen adresi eksiksiz kopyalayıp tekrar deneyin.')
  }

  if (url.protocol !== 'https:') {
    return fail(
      'insecure',
      'Güvenlik nedeniyle yalnızca https:// bağlantıları kullanılabilir. (http:// bağlantıları tarayıcı tarafından da engellenebilir.)',
      normalizeHost(url.hostname),
      url.toString(),
    )
  }

  if (url.username || url.password) {
    return fail('insecure', 'Kullanıcı adı veya parola içeren bağlantılar güvenlik nedeniyle kabul edilmez.', normalizeHost(url.hostname))
  }

  if (!url.hostname.includes('.')) {
    return fail('invalid', 'Bağlantının alan adı geçerli görünmüyor.', normalizeHost(url.hostname))
  }

  const host = normalizeHost(url.hostname)

  if (host === 'google.com' || host.endsWith('.google.com')) {
    if (url.pathname.startsWith('/search')) {
      return fail(
        'unsupported',
        'Google arama sonuçları bir video dosyası değildir. Arama sonucunda bulduğunuz YouTube/Vimeo bağlantısını veya doğrudan .mp4 adresini yapıştırın.',
        host,
        url.toString(),
      )
    }
    if (host === 'drive.google.com' || host === 'docs.google.com') {
      return fail('unsupported', UNSUPPORTED_HOSTS[host], host, url.toString())
    }
  }

  if (CHANNEL_HOSTS.includes(host)) {
    return parseYouTube(url, host)
  }

  if (VIMEO_HOSTS.includes(host)) {
    return parseVimeo(url, host)
  }

  if (UNSUPPORTED_HOSTS[host]) {
    return fail('unsupported', UNSUPPORTED_HOSTS[host], host, url.toString())
  }

  return parseDirectMedia(url)
}

export function isVideoSource(value: unknown): value is VideoSource {
  if (!value || typeof value !== 'object') return false
  const source = value as Partial<VideoSource>
  return (
    typeof source.url === 'string' &&
    typeof source.videoId === 'string' &&
    (source.provider === 'youtube' ||
      source.provider === 'vimeo' ||
      source.provider === 'html5' ||
      source.provider === 'hls' ||
      source.provider === 'iframe')
  )
}

export function providerDisplayName(provider: VideoProvider): string {
  switch (provider) {
    case 'youtube':
      return 'YouTube'
    case 'vimeo':
      return 'Vimeo'
    case 'html5':
      return 'Doğrudan video'
    case 'hls':
      return 'HLS yayını'
    case 'iframe':
      return 'Gömülü sayfa'
    default:
      return 'Video yok'
  }
}
