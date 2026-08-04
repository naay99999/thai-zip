import { describe, it, expect, vi } from 'vitest'
import { buildThaiAddressIndex, validateRawData } from '../core/indexer'
import type { RawData } from '../types'

const mockData: RawData = {
  geographies: [
    { id: 1, name: 'ภาคกลาง', deleted_at: null },
    { id: 2, name: 'ภาคเหนือ', deleted_at: null },
  ],
  provinces: [
    { id: 1, name_th: 'กรุงเทพมหานคร', name_en: 'Bangkok', geography_id: 1, deleted_at: null },
    { id: 2, name_th: 'เชียงใหม่', name_en: 'Chiang Mai', geography_id: 2, deleted_at: null },
    { id: 3, name_th: 'ลบแล้ว', name_en: 'Deleted', geography_id: 1, deleted_at: '2020-01-01' },
  ],
  amphures: [
    { id: 1001, name_th: 'จตุจักร', name_en: 'Chatuchak', province_id: 1, deleted_at: null },
    { id: 2001, name_th: 'เมืองเชียงใหม่', name_en: 'Mueang Chiang Mai', province_id: 2, deleted_at: null },
  ],
  tambons: [
    { id: 100101, zip_code: 10900, name_th: 'ลาดพร้าว', name_en: 'Lat Phrao', amphure_id: 1001, deleted_at: null },
    { id: 100102, zip_code: 10900, name_th: 'จอมพล', name_en: 'Chom Phon', amphure_id: 1001, deleted_at: null },
    { id: 200101, zip_code: 50000, name_th: 'ศรีภูมิ', name_en: 'Si Phum', amphure_id: 2001, deleted_at: null },
    { id: 100199, zip_code: 10900, name_th: 'ลบแล้ว', name_en: 'Deleted', amphure_id: 1001, deleted_at: '2020-01-01' },
  ],
}

describe('buildThaiAddressIndex', () => {
  it('returns correct number of records (excludes deleted)', () => {
    const index = buildThaiAddressIndex(mockData)
    expect(index.records).toHaveLength(3)
  })

  it('correctly joins tambon with amphure and province', () => {
    const index = buildThaiAddressIndex(mockData)
    const latPhrao = index.records.find(r => r.tambonId === 100101)!
    expect(latPhrao.tambonNameTh).toBe('ลาดพร้าว')
    expect(latPhrao.tambonNameEn).toBe('Lat Phrao')
    expect(latPhrao.amphureNameTh).toBe('จตุจักร')
    expect(latPhrao.amphureNameEn).toBe('Chatuchak')
    expect(latPhrao.provinceNameTh).toBe('กรุงเทพมหานคร')
    expect(latPhrao.provinceNameEn).toBe('Bangkok')
    expect(latPhrao.zipCode).toBe('10900')
  })

  it('excludes deleted tambons', () => {
    const index = buildThaiAddressIndex(mockData)
    expect(index.records.find(r => r.tambonId === 100199)).toBeUndefined()
  })

  it('builds trigram map with entries', () => {
    const index = buildThaiAddressIndex(mockData)
    expect(index.map.size).toBeGreaterThan(0)
  })

  it('trigram map contains trigrams from tambon name', () => {
    const index = buildThaiAddressIndex(mockData)
    // "ลาดพราว" normalized → trigrams include "ลาด", "าดพ", "ดพร", "พรา", "ราว"
    expect(index.map.has('ลาด')).toBe(true)
  })

  it('trigram map contains trigrams from province name', () => {
    const index = buildThaiAddressIndex(mockData)
    // "กรุงเทพมหานคร" → contains "กรุ"
    expect(index.map.has('กรุ')).toBe(true)
  })

  it('trigram map contains trigrams from zip code', () => {
    const index = buildThaiAddressIndex(mockData)
    expect(index.map.has('109')).toBe(true)
  })

  it('trigram map contains English trigrams (lowercased)', () => {
    const index = buildThaiAddressIndex(mockData)
    expect(index.map.has('ban')).toBe(true)
  })

  it('skips tambons whose amphure_id has no match and calls onSkip', () => {
    const onSkip = vi.fn()
    const data: RawData = {
      provinces: mockData.provinces,
      amphures: mockData.amphures,
      tambons: [
        { id: 100101, zip_code: 10900, name_th: 'ลาดพร้าว', name_en: 'Lat Phrao', amphure_id: 1001, deleted_at: null },
        { id: 999999, zip_code: 99999, name_th: 'ไม่มีอำเภอ', name_en: 'No Amphure', amphure_id: 9999, deleted_at: null },
      ],
    }
    const index = buildThaiAddressIndex(data, { onSkip })
    expect(index.records).toHaveLength(1)
    expect(onSkip).toHaveBeenCalledTimes(1)
    expect(onSkip).toHaveBeenCalledWith(expect.objectContaining({ id: 999999 }))
  })

  it('does not call onSkip when all tambons have valid amphures', () => {
    const onSkip = vi.fn()
    buildThaiAddressIndex(mockData, { onSkip })
    expect(onSkip).not.toHaveBeenCalled()
  })
})

describe('validateRawData', () => {
  it('accepts valid data without throwing', () => {
    expect(() => validateRawData(mockData)).not.toThrow()
  })

  it('rejects a province with non-number id', () => {
    const data: RawData = {
      provinces: [{ id: '1' as unknown as number, name_th: 'x', name_en: 'x', geography_id: 1, deleted_at: null }],
      amphures: [],
      tambons: [],
    }
    expect(() => validateRawData(data)).toThrow(/\[thaizip\] province 1: expected number for id, got string/)
  })

  it('rejects a province with non-string name_th', () => {
    const data: RawData = {
      provinces: [{ id: 1, name_th: 12345 as unknown as string, name_en: 'x', geography_id: 1, deleted_at: null }],
      amphures: [],
      tambons: [],
    }
    expect(() => validateRawData(data)).toThrow(/\[thaizip\] province 1: expected string for name_th, got number/)
  })

  it('rejects a province with non-string name_en', () => {
    const data: RawData = {
      provinces: [{ id: 1, name_th: 'x', name_en: undefined as unknown as string, geography_id: 1, deleted_at: null }],
      amphures: [],
      tambons: [],
    }
    expect(() => validateRawData(data)).toThrow(/\[thaizip\] province 1: expected string for name_en, got undefined/)
  })

  it('rejects an amphure with non-number province_id', () => {
    const data: RawData = {
      provinces: mockData.provinces,
      amphures: [{ id: 1001, name_th: 'x', name_en: 'x', province_id: 'bkk' as unknown as number, deleted_at: null }],
      tambons: [],
    }
    expect(() => validateRawData(data)).toThrow(/\[thaizip\] amphure 1001: expected number for province_id, got string/)
  })

  it('rejects a tambon with non-string name_th', () => {
    const data: RawData = {
      provinces: mockData.provinces,
      amphures: mockData.amphures,
      tambons: [{ id: 100404, zip_code: 10900, name_th: 12345 as unknown as string, name_en: 'x', amphure_id: 1001, deleted_at: null }],
    }
    expect(() => validateRawData(data)).toThrow('[thaizip] tambon 100404: expected string for name_th, got number')
  })

  it('rejects a tambon with invalid zip_code type', () => {
    const data: RawData = {
      provinces: mockData.provinces,
      amphures: mockData.amphures,
      tambons: [{ id: 100404, zip_code: true as unknown as number, name_th: 'x', name_en: 'x', amphure_id: 1001, deleted_at: null }],
    }
    expect(() => validateRawData(data)).toThrow(/\[thaizip\] tambon 100404: expected string or number for zip_code, got boolean/)
  })

  it('accepts a tambon with numeric zip_code', () => {
    const data: RawData = {
      provinces: mockData.provinces,
      amphures: mockData.amphures,
      tambons: [{ id: 100404, zip_code: 10900, name_th: 'x', name_en: 'x', amphure_id: 1001, deleted_at: null }],
    }
    expect(() => validateRawData(data)).not.toThrow()
  })

  it('rejects a tambon with non-number amphure_id', () => {
    const data: RawData = {
      provinces: mockData.provinces,
      amphures: mockData.amphures,
      tambons: [{ id: 100404, zip_code: 10900, name_th: 'x', name_en: 'x', amphure_id: '1001' as unknown as number, deleted_at: null }],
    }
    expect(() => validateRawData(data)).toThrow(/\[thaizip\] tambon 100404: expected number for amphure_id, got string/)
  })
})

describe('buildThaiAddressIndex validation integration', () => {
  // name_th/name_en being a truthy non-string crashes deep inside the normalizer
  // (`input.trim is not a function`) regardless of the `validate` option, since
  // normalization always runs during indexing (see S-4 in the audit report).
  // zip_code, by contrast, only ever flows through `String(...)`, so an invalid
  // zip_code type is a case validation alone catches, cleanly demonstrating the
  // opt-out: building still succeeds (just with a stringified bad value) when
  // `validate: false` is passed.
  const badData: RawData = {
    provinces: mockData.provinces,
    amphures: mockData.amphures,
    tambons: [{ id: 100404, zip_code: true as unknown as number, name_th: 'x', name_en: 'x', amphure_id: 1001, deleted_at: null }],
  }

  it('throws by default when data has a bad field type', () => {
    expect(() => buildThaiAddressIndex(badData)).toThrow(TypeError)
    expect(() => buildThaiAddressIndex(badData)).toThrow(/\[thaizip\]/)
  })

  it('throws when validate: true is explicit', () => {
    expect(() => buildThaiAddressIndex(badData, { validate: true })).toThrow(TypeError)
  })

  it('does not throw when validate: false is passed, even with bad data', () => {
    expect(() => buildThaiAddressIndex(badData, { validate: false })).not.toThrow()
  })

  it('still builds a usable index when validation is skipped on bad data', () => {
    const index = buildThaiAddressIndex(badData, { validate: false })
    expect(index.records).toHaveLength(1)
  })
})
