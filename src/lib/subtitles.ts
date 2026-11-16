export interface SubtitleCue {
  start: number
  end: number
  text: string
}

const TIMESTAMP_PATTERN =
  /^(?:(\d{1,3}):)?(\d{1,2}):(\d{1,2})(?:[,.](\d{1,3}))?$/

function parseTimestamp(value: string): number | null {
  const match = TIMESTAMP_PATTERN.exec(value.trim())
  if (!match) return null

  const hours = Number(match[1] ?? 0)
  const minutes = Number(match[2])
  const seconds = Number(match[3])
  const milliseconds = Number((match[4] ?? '0').padEnd(3, '0'))

  if (![hours, minutes, seconds, milliseconds].every((part) => Number.isFinite(part))) {
    return null
  }

  return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
}

/** HTML etiketlerini temizler; altyazı metni her zaman düz metin olarak çizilir. */
function cleanCueText(lines: string[]): string {
  return decodeEntities(
    lines
      .join('\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/\{\\[^}]*\}/g, ''),
  )
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * WebVTT ve SRT dosyalarını ayrıştırır. Bilinmeyen bloklar sessizce atlanır;
 * hatalı zaman damgaları altyazıyı bozmaz. Metin asla HTML olarak çalıştırılmaz.
 */
export function parseSubtitles(content: string): SubtitleCue[] {
  const normalized = content.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  const blocks = normalized.split(/\n{2,}/)
  const cues: SubtitleCue[] = []

  for (const block of blocks) {
    const lines = block.split('\n').map((line) => line.trimEnd())
    if (lines.length === 0) continue

    const firstLine = lines[0]?.trim() ?? ''
    if (!firstLine || /^WEBVTT\b/i.test(firstLine) || /^NOTE\b/i.test(firstLine) || /^STYLE\b/i.test(firstLine)) {
      continue
    }

    const timingIndex = lines.findIndex((line) => line.includes('-->'))
    if (timingIndex === -1) continue

    const [rawStart, rawEnd] = lines[timingIndex].split('-->')
    const start = parseTimestamp(rawStart ?? '')
    const end = parseTimestamp((rawEnd ?? '').trim().split(/\s+/)[0] ?? '')
    if (start === null || end === null || end <= start) continue

    const text = cleanCueText(lines.slice(timingIndex + 1))
    if (!text) continue

    cues.push({ start, end, text })
  }

  cues.sort((a, b) => a.start - b.start)
  return cues
}

/** Zaman çizgisine göre görünmesi gereken tek altyazıyı döndürür. */
export function findActiveCue(cues: SubtitleCue[], time: number): SubtitleCue | null {
  if (!Number.isFinite(time) || cues.length === 0) return null

  let low = 0
  let high = cues.length - 1
  while (low <= high) {
    const middle = (low + high) >> 1
    const cue = cues[middle]
    if (time < cue.start) high = middle - 1
    else if (time >= cue.end) low = middle + 1
    else return cue
  }

  return null
}
