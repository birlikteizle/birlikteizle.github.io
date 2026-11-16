import { describe, expect, it } from 'vitest'
import { formatClock, formatDurationLong } from '@/lib/format'

describe('formatClock', () => {
  it('dakika:saniye ve saat biçimlerini üretir', () => {
    expect(formatClock(0)).toBe('0:00')
    expect(formatClock(75)).toBe('1:15')
    expect(formatClock(3671)).toBe('1:01:11')
    expect(formatClock(59.9)).toBe('0:59')
  })

  it('geçersiz ve negatif değerlerde 0:00 döndürür', () => {
    expect(formatClock(Number.NaN)).toBe('0:00')
    expect(formatClock(-5)).toBe('0:00')
    expect(formatClock(Number.POSITIVE_INFINITY)).toBe('0:00')
  })
})

describe('formatDurationLong', () => {
  it('Türkçe kısa süre etiketi üretir', () => {
    expect(formatDurationLong(30)).toBe('30 sn')
    expect(formatDurationLong(125)).toBe('2 dk')
    expect(formatDurationLong(3725)).toBe('1 sa 2 dk')
    expect(formatDurationLong(0)).toBe('—')
  })
})
