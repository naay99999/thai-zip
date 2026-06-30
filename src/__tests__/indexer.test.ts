import { describe, it, expect, vi } from 'vitest'
import { buildThaiAddressIndex } from '../core/indexer'
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
