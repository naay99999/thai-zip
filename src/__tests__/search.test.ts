import { describe, it, expect, beforeAll } from 'vitest'
import { buildThaiAddressIndex } from '../core/indexer'
import { searchThaiAddress, lookupByZipCode } from '../core/search'
import type { RawData, TrigramIndex } from '../types'

const mockData: RawData = {
  geographies: [
    { id: 1, name: 'ภาคกลาง', deleted_at: null },
    { id: 2, name: 'ภาคเหนือ', deleted_at: null },
  ],
  provinces: [
    { id: 1, name_th: 'กรุงเทพมหานคร', name_en: 'Bangkok', geography_id: 1, deleted_at: null },
    { id: 2, name_th: 'เชียงใหม่', name_en: 'Chiang Mai', geography_id: 2, deleted_at: null },
  ],
  amphures: [
    { id: 1001, name_th: 'จตุจักร', name_en: 'Chatuchak', province_id: 1, deleted_at: null },
    { id: 1002, name_th: 'ลาดพร้าว', name_en: 'Lat Phrao', province_id: 1, deleted_at: null },
    { id: 2001, name_th: 'เมืองเชียงใหม่', name_en: 'Mueang Chiang Mai', province_id: 2, deleted_at: null },
  ],
  tambons: [
    { id: 100101, zip_code: 10900, name_th: 'ลาดพร้าว', name_en: 'Lat Phrao', amphure_id: 1001, deleted_at: null },
    { id: 100201, zip_code: 10230, name_th: 'จรเข้บัว', name_en: 'Chorakhe Bua', amphure_id: 1002, deleted_at: null },
    { id: 200101, zip_code: 50000, name_th: 'ศรีภูมิ', name_en: 'Si Phum', amphure_id: 2001, deleted_at: null },
    { id: 200102, zip_code: 50200, name_th: 'ช้างเผือก', name_en: 'Chang Phueak', amphure_id: 2001, deleted_at: null },
  ],
}

let index: TrigramIndex

beforeAll(() => {
  index = buildThaiAddressIndex(mockData)
})

describe('searchThaiAddress', () => {
  it('finds exact Thai tambon name match', () => {
    const results = searchThaiAddress(index, 'ลาดพร้าว')
    expect(results.length).toBeGreaterThan(0)
    expect(results.some(r => r.tambonNameTh === 'ลาดพร้าว')).toBe(true)
  })

  it('finds match with tone marks missing (fuzzy)', () => {
    const results = searchThaiAddress(index, 'ลาดพราว')
    expect(results.some(r => r.tambonNameTh === 'ลาดพร้าว')).toBe(true)
  })

  it('finds match by province name', () => {
    const results = searchThaiAddress(index, 'กรุงเทพ')
    expect(results.length).toBeGreaterThan(0)
    expect(results.every(r => r.provinceNameTh === 'กรุงเทพมหานคร')).toBe(true)
  })

  it('finds match by English amphure name', () => {
    const results = searchThaiAddress(index, 'chatuchak')
    expect(results.some(r => r.amphureNameEn === 'Chatuchak')).toBe(true)
  })

  it('finds match by zip code', () => {
    const results = searchThaiAddress(index, '10900')
    expect(results.length).toBeGreaterThan(0)
    expect(results.every(r => r.zipCode === '10900')).toBe(true)
  })

  it('zip code partial prefix match returns results', () => {
    const results = searchThaiAddress(index, '500')
    expect(results.some(r => r.zipCode.startsWith('500'))).toBe(true)
  })

  it('returns empty array for query with no matches', () => {
    const results = searchThaiAddress(index, 'xyzxyzxyz')
    expect(results).toHaveLength(0)
  })

  it('respects limit option', () => {
    // all records match กรุงเทพ province (2 records)
    const results = searchThaiAddress(index, 'กรุงเทพ', { limit: 1 })
    expect(results).toHaveLength(1)
  })

  it('returns empty array for empty query', () => {
    const results = searchThaiAddress(index, '')
    expect(results).toHaveLength(0)
  })

  it('is case-insensitive for English', () => {
    const lower = searchThaiAddress(index, 'bangkok')
    const upper = searchThaiAddress(index, 'BANGKOK')
    expect(lower.length).toBe(upper.length)
  })

  // A-4: threshold boundary
  it('returns empty when threshold is 1.0 and query has no perfect match', () => {
    const results = searchThaiAddress(index, 'xyzabc', { threshold: 1.0 })
    expect(results).toHaveLength(0)
  })

  it('returns results when threshold is 0', () => {
    const results = searchThaiAddress(index, 'กรุง', { threshold: 0 })
    expect(results.length).toBeGreaterThan(0)
  })

  // A-5: single-digit zip
  it('returns empty for single-digit zip code', () => {
    expect(searchThaiAddress(index, '1')).toHaveLength(0)
  })

  // A-6: whitespace-only query
  it('returns empty for whitespace-only query', () => {
    expect(searchThaiAddress(index, '   ')).toHaveLength(0)
  })

  // Fix 1: null index guard
  it('returns empty array when index is null', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(searchThaiAddress(null as any, 'กรุงเทพ')).toHaveLength(0)
  })

  // Fix 3: query length limit
  it('returns empty array for query longer than 300 characters', () => {
    expect(searchThaiAddress(index, 'ก'.repeat(301))).toHaveLength(0)
  })

  // Fix — zip sort: exact match before partial match (covers search.ts lines 30-31)
  it('zip exact match is returned before prefix-only match', () => {
    // synthetic zip codes: "1090" (4-digit exact) and "10901" (5-digit prefix match)
    const dataWithMixedZips: RawData = {
      geographies: [],
      provinces: mockData.provinces,
      amphures: mockData.amphures,
      tambons: [
        { id: 888801, zip_code: 1090, name_th: 'เขตสั้น', name_en: 'Short', amphure_id: 1001, deleted_at: null },
        { id: 888802, zip_code: 10901, name_th: 'เขตยาว', name_en: 'Long', amphure_id: 1001, deleted_at: null },
      ],
    }
    const idx = buildThaiAddressIndex(dataWithMixedZips)
    const results = searchThaiAddress(idx, '1090')
    expect(results).toHaveLength(2)
    expect(results[0].zipCode).toBe('1090')
    expect(results[1].zipCode).toBe('10901')
  })

  // Fix — zip sort: partial matches sorted ascending (covers search.ts line 32)
  it('zip partial matches are sorted ascending by zip code', () => {
    // mockData has 50000 and 50200; query "50" prefix-matches both, neither is exact
    const results = searchThaiAddress(index, '50')
    expect(results[0].zipCode).toBe('50000')
    expect(results[1].zipCode).toBe('50200')
  })

  // A-3: sub-3-char text queries (A-5 test cases)
  it('returns empty for single Thai character query', () => {
    expect(searchThaiAddress(index, 'ก')).toHaveLength(0)
  })

  it('returns empty for two-char Thai query', () => {
    expect(searchThaiAddress(index, 'กร')).toHaveLength(0)
  })

  it('returns empty for single English character query', () => {
    expect(searchThaiAddress(index, 'b')).toHaveLength(0)
  })

  it('returns empty for two-char English query', () => {
    expect(searchThaiAddress(index, 'ba')).toHaveLength(0)
  })

  // S-5: bound the raw query before the (multi-pass) normalizer runs over it
  it('returns empty array for query longer than 1000 characters', () => {
    expect(searchThaiAddress(index, 'ก'.repeat(1001))).toHaveLength(0)
  })

  // UC-1: a tambon whose own name matches the query exactly must outrank a
  // tambon that only matches via its parent amphure's name. mockData's
  // จรเข้บัว is in เขตลาดพร้าว (amphure "ลาดพร้าว"), so an unranked flat
  // trigram search ties it with the actual ลาดพร้าว tambon.
  it('ranks exact tambon name match above a same-scoring parent-only match', () => {
    const results = searchThaiAddress(index, 'ลาดพร้าว')
    expect(results[0].tambonNameTh).toBe('ลาดพร้าว')
  })

  describe('lookupByZipCode', () => {
    it('returns all matches for a zip prefix, not capped by the text limit', () => {
      const results = lookupByZipCode(index, '50')
      expect(results.length).toBe(2)
    })

    it('respects zipLimit', () => {
      const results = lookupByZipCode(index, '50', { zipLimit: 1 })
      expect(results).toHaveLength(1)
    })

    it('returns empty array for empty index or zip', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(lookupByZipCode(null as any, '10900')).toHaveLength(0)
      expect(lookupByZipCode(index, '')).toHaveLength(0)
    })

    it('returns empty array for single-digit zip', () => {
      expect(lookupByZipCode(index, '1')).toHaveLength(0)
    })
  })
})
