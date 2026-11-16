import { describe, expect, it } from 'vitest'
import {
  CAPACITY_OPTIONS,
  DEFAULT_CAPACITY,
  MAX_CAPACITY,
  MIN_CAPACITY,
  normalizeCapacity,
  occupancyLabel,
} from '@/lib/capacity'

describe('normalizeCapacity', () => {
  it('geçerli sayıyı olduğu gibi döner', () => {
    expect(normalizeCapacity(6)).toBe(6)
    expect(normalizeCapacity('12')).toBe(12)
  })

  it('alt sınırın altını yukarı çeker', () => {
    expect(normalizeCapacity(0)).toBe(MIN_CAPACITY)
    expect(normalizeCapacity(1)).toBe(MIN_CAPACITY)
    expect(normalizeCapacity(-4)).toBe(MIN_CAPACITY)
  })

  it('üst sınırı aşanı kırpar', () => {
    expect(normalizeCapacity(9999)).toBe(MAX_CAPACITY)
  })

  it('sayı olmayan değerde varsayılana düşer', () => {
    expect(normalizeCapacity(undefined)).toBe(DEFAULT_CAPACITY)
    expect(normalizeCapacity('abc', 5)).toBe(5)
    expect(normalizeCapacity(null)).toBe(DEFAULT_CAPACITY)
  })

  it('ondalık değeri aşağı yuvarlar', () => {
    expect(normalizeCapacity(4.9)).toBe(4)
  })
})

describe('occupancyLabel', () => {
  it('doluluk etiketi üretir', () => {
    expect(occupancyLabel(1, 2)).toBe('1/2 kişi')
    expect(occupancyLabel(7, 10)).toBe('7/10 kişi')
  })
})

describe('CAPACITY_OPTIONS', () => {
  it('artan sırada ve sınırlar içinde', () => {
    const sorted = [...CAPACITY_OPTIONS].sort((a, b) => a - b)
    expect([...CAPACITY_OPTIONS]).toEqual(sorted)
    expect(Math.min(...CAPACITY_OPTIONS)).toBeGreaterThanOrEqual(MIN_CAPACITY)
    expect(Math.max(...CAPACITY_OPTIONS)).toBeLessThanOrEqual(MAX_CAPACITY)
  })
})
