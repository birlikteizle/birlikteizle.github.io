import { describe, expect, it } from 'vitest'
import { parseStartSeconds, parseVideoUrl, providerDisplayName } from '@/lib/video'

describe('parseStartSeconds', () => {
  it('düz saniye ve saat/dakika biçimlerini okur', () => {
    expect(parseStartSeconds('90')).toBe(90)
    expect(parseStartSeconds('1h2m3s')).toBe(3723)
    expect(parseStartSeconds('2m')).toBe(120)
    expect(parseStartSeconds('45s')).toBe(45)
    expect(parseStartSeconds('abc')).toBe(0)
    expect(parseStartSeconds(null)).toBe(0)
  })
})

describe('parseVideoUrl', () => {
  it('YouTube watch bağlantısını kimliğiyle kabul eder', () => {
    const result = parseVideoUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.source.provider).toBe('youtube')
    expect(result.source.videoId).toBe('dQw4w9WgXcQ')
    expect(result.source.startAt).toBe(42)
    expect(result.source.url).toContain('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    expect(result.embedUrl).toContain('youtube-nocookie.com/embed/dQw4w9WgXcQ')
  })

  it('youtu.be, shorts ve embed bağlantılarını kabul eder', () => {
    for (const input of [
      'https://youtu.be/dQw4w9WgXcQ',
      'https://www.youtube.com/shorts/dQw4w9WgXcQ',
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    ]) {
      const result = parseVideoUrl(input)
      expect(result.ok, input).toBe(true)
      if (result.ok) expect(result.source.videoId).toBe('dQw4w9WgXcQ')
    }
  })

  it('Vimeo kimliğini ve private hash değerini korur', () => {
    const result = parseVideoUrl('https://vimeo.com/76979871/abc123def')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.source.provider).toBe('vimeo')
    expect(result.source.videoId).toBe('76979871')
    expect(result.embedUrl).toBe('https://player.vimeo.com/video/76979871?h=abc123def')
  })

  it('doğrudan medya ve HLS bağlantılarını kabul eder', () => {
    const mp4 = parseVideoUrl('https://cdn.example.com/movie.mp4')
    expect(mp4.ok).toBe(true)
    if (mp4.ok) expect(mp4.source.provider).toBe('html5')

    const hls = parseVideoUrl('https://cdn.example.com/live.m3u8?token=1')
    expect(hls.ok).toBe(true)
    if (hls.ok) expect(hls.source.provider).toBe('hls')
  })

  it('http, javascript, data ve kimlik bilgili bağlantıları reddeder', () => {
    const cases = [
      'http://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'javascript:alert(1)',
      'data:text/html,hello',
      'https://user:pass@example.com/video.mp4',
    ]
    for (const input of cases) {
      const result = parseVideoUrl(input)
      expect(result.ok, input).toBe(false)
    }
  })

  it('DRM korumalı ve uygun olmayan sayfaları reddeder', () => {
    const netflix = parseVideoUrl('https://www.netflix.com/watch/123')
    expect(netflix.ok).toBe(false)
    if (!netflix.ok) {
      expect(netflix.code).toBe('unsupported')
      expect(netflix.reason).toContain('DRM')
    }

    const search = parseVideoUrl('https://www.google.com/search?q=film')
    expect(search.ok).toBe(false)
    if (!search.ok) expect(search.code).toBe('unsupported')

    const playlist = parseVideoUrl('https://www.youtube.com/playlist?list=PL123')
    expect(playlist.ok).toBe(false)
  })

  it('tanınmayan web sayfalarını gömülü (iframe) kaynak olarak kabul eder', () => {
    const page = parseVideoUrl('https://example.com/blog/article')
    expect(page.ok).toBe(true)
    if (page.ok) {
      expect(page.source.provider).toBe('iframe')
      expect(page.embedUrl).toBe('https://example.com/blog/article')
      expect(page.note).toBeTruthy()
    }

    const archive = parseVideoUrl('https://archive.org/details/some-film')
    expect(archive.ok).toBe(true)
    if (archive.ok) expect(archive.source.provider).toBe('iframe')
  })

  it('geçersiz YouTube kimliğini reddeder', () => {
    const result = parseVideoUrl('https://www.youtube.com/watch?v=short')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('invalid')
  })

  it('sağlayıcı etiketlerini Türkçe döndürür', () => {
    expect(providerDisplayName('youtube')).toBe('YouTube')
    expect(providerDisplayName('vimeo')).toBe('Vimeo')
    expect(providerDisplayName('html5')).toBe('Doğrudan video')
    expect(providerDisplayName('hls')).toBe('HLS yayını')
    expect(providerDisplayName('none')).toBe('Video yok')
  })
})
