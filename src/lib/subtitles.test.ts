import { describe, expect, it } from 'vitest'
import { findActiveCue, parseSubtitles } from '@/lib/subtitles'

const VTT = `\uFEFFWEBVTT

1
00:00:01.000 --> 00:00:03.500
Merhaba <b>dünya</b>

2
00:00:04.000 --> 00:00:06.000
İkinci satır
devam ediyor

NOTE bu yorum yok sayılır

3
00:00:07.000 --> 00:00:08.000
&lt;script&gt;alert(1)&lt;/script&gt;
`

const SRT = `1
00:00:00,500 --> 00:00:02,000
SRT satırı

2
00:01:02,250 --> 00:01:04,000
Geç satır
`

describe('parseSubtitles', () => {
  it('WebVTT dosyasını etiketlerden arındırarak okur', () => {
    const cues = parseSubtitles(VTT)
    expect(cues).toHaveLength(3)
    expect(cues[0]).toEqual({ start: 1, end: 3.5, text: 'Merhaba dünya' })
    expect(cues[1].text).toBe('İkinci satır\ndevam ediyor')
    expect(cues[2].text).toBe('<script>alert(1)</script>')
  })

  it('SRT virgüllü milisaniyeleri destekler', () => {
    const cues = parseSubtitles(SRT)
    expect(cues).toHaveLength(2)
    expect(cues[0].start).toBe(0.5)
    expect(cues[1].start).toBe(62.25)
  })

  it('geçersiz blokları sessizce atlar', () => {
    const cues = parseSubtitles(`WEBVTT\n\nbozuk blok\n\n00:00:05.000 --> 00:00:02.000\nTers\n\n00:00:01.000 --> 00:00:02.000\n`)
    expect(cues).toHaveLength(0)
  })
})

describe('findActiveCue', () => {
  const cues = parseSubtitles(VTT)

  it('zaman aralığına düşen altyazıyı bulur', () => {
    expect(findActiveCue(cues, 2)?.text).toBe('Merhaba dünya')
    expect(findActiveCue(cues, 4.5)?.text).toBe('İkinci satır\ndevam ediyor')
    expect(findActiveCue(cues, 8.2)).toBeNull()
  })

  it('sınırlarda doğru davranır', () => {
    expect(findActiveCue(cues, 1)?.text).toBe('Merhaba dünya')
    expect(findActiveCue(cues, 3.5)).toBeNull()
    expect(findActiveCue(cues, 0)).toBeNull()
  })

  it('boş liste ve geçersiz zamanda null döndürür', () => {
    expect(findActiveCue([], 1)).toBeNull()
    expect(findActiveCue(cues, Number.NaN)).toBeNull()
  })
})
