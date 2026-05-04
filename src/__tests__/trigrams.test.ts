import { describe, it, expect } from 'vitest'
import { extractTrigrams, extractTrigramsNormalized } from '../core/trigrams'

describe('extractTrigramsNormalized', () => {
  it('returns empty set for empty string', () => {
    expect(extractTrigramsNormalized('')).toEqual(new Set())
  })

  it('returns 1-char string as sole element when input length is 1', () => {
    expect(extractTrigramsNormalized('a')).toEqual(new Set(['a']))
  })

  it('returns 2-char string as sole element when input length is 2', () => {
    expect(extractTrigramsNormalized('กร')).toEqual(new Set(['กร']))
  })

  it('returns sliding 3-char windows for strings longer than 2 chars', () => {
    expect(extractTrigramsNormalized('abcd')).toEqual(new Set(['abc', 'bcd']))
  })

  it('returns a single trigram for exactly 3 chars', () => {
    expect(extractTrigramsNormalized('abc')).toEqual(new Set(['abc']))
  })
})

describe('extractTrigrams', () => {
  it('normalises input before extracting (strips tone marks)', () => {
    // "ลาดพร้าว" → normalised "ลาดพราว" (7 chars) → 5 trigrams
    const result = extractTrigrams('ลาดพร้าว')
    expect(result.has('ลาด')).toBe(true)
    expect(result.has('าดพ')).toBe(true)
    expect(result.has('ดพร')).toBe(true)
  })

  it('strips address prefix before extracting trigrams', () => {
    // "ตำบลแก" → normalised "แก" (2 chars) → {"แก"}
    const result = extractTrigrams('ตำบลแก')
    expect(result).toEqual(new Set(['แก']))
  })
})
