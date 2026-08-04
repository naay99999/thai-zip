import { describe, it, expect, beforeAll } from 'vitest'
import { loadDefaultIndex } from '../data'
import { buildThaiAddressIndex } from '../core/indexer'
import { listProvinces, listAmphures, listTambons } from '../core/enumerate'
import type { RawData, TrigramIndex } from '../types'

let index: TrigramIndex

beforeAll(async () => {
  index = await loadDefaultIndex()
})

describe('listProvinces', () => {
  it('returns all 77 Thai provinces', () => {
    const provinces = listProvinces(index)
    expect(provinces).toHaveLength(77)
  })

  it('returns no duplicate province ids', () => {
    const provinces = listProvinces(index)
    const ids = new Set(provinces.map(p => p.id))
    expect(ids.size).toBe(provinces.length)
  })

  it('is sorted by Thai name', () => {
    const provinces = listProvinces(index)
    const collator = new Intl.Collator('th')
    const sorted = [...provinces].sort((a, b) => collator.compare(a.nameTh, b.nameTh))
    expect(provinces.map(p => p.nameTh)).toEqual(sorted.map(p => p.nameTh))
  })

  it('includes Bangkok with correct names', () => {
    const provinces = listProvinces(index)
    const bangkok = provinces.find(p => p.nameEn === 'Bangkok')
    expect(bangkok).toBeDefined()
    expect(bangkok?.nameTh).toBe('กรุงเทพมหานคร')
  })
})

describe('listAmphures', () => {
  it('returns amphures for a known province with no duplicates', () => {
    const provinces = listProvinces(index)
    const bangkok = provinces.find(p => p.nameEn === 'Bangkok')!
    const amphures = listAmphures(index, bangkok.id)
    expect(amphures.length).toBeGreaterThan(0)
    expect(amphures.every(a => a.provinceId === bangkok.id)).toBe(true)
    const ids = new Set(amphures.map(a => a.id))
    expect(ids.size).toBe(amphures.length)
  })

  it('is sorted by Thai name', () => {
    const provinces = listProvinces(index)
    const bangkok = provinces.find(p => p.nameEn === 'Bangkok')!
    const amphures = listAmphures(index, bangkok.id)
    const collator = new Intl.Collator('th')
    const sorted = [...amphures].sort((a, b) => collator.compare(a.nameTh, b.nameTh))
    expect(amphures.map(a => a.nameTh)).toEqual(sorted.map(a => a.nameTh))
  })

  it('returns [] for an unknown province id', () => {
    expect(listAmphures(index, -1)).toEqual([])
  })
})

describe('listTambons', () => {
  it('returns tambons for a known amphure including zipCode', () => {
    const provinces = listProvinces(index)
    const bangkok = provinces.find(p => p.nameEn === 'Bangkok')!
    const amphures = listAmphures(index, bangkok.id)
    const latPhrao = amphures.find(a => a.nameEn.includes('Lat Phrao'))!
    const tambons = listTambons(index, latPhrao.id)
    expect(tambons.length).toBeGreaterThan(0)
    expect(tambons.every(t => t.amphureId === latPhrao.id)).toBe(true)
    expect(tambons.every(t => typeof t.zipCode === 'string' && t.zipCode.length === 5)).toBe(true)
    expect(tambons.some(t => t.nameTh === 'ลาดพร้าว')).toBe(true)
  })

  it('is sorted by Thai name', () => {
    const provinces = listProvinces(index)
    const bangkok = provinces.find(p => p.nameEn === 'Bangkok')!
    const amphures = listAmphures(index, bangkok.id)
    const latPhrao = amphures.find(a => a.nameEn.includes('Lat Phrao'))!
    const tambons = listTambons(index, latPhrao.id)
    const collator = new Intl.Collator('th')
    const sorted = [...tambons].sort((a, b) => collator.compare(a.nameTh, b.nameTh))
    expect(tambons.map(t => t.nameTh)).toEqual(sorted.map(t => t.nameTh))
  })

  it('returns [] for an unknown amphure id', () => {
    expect(listTambons(index, -1)).toEqual([])
  })
})

describe('enumeration API on a hand-built small index', () => {
  const mockData: RawData = {
    provinces: [
      { id: 1, name_th: 'กรุงเทพมหานคร', name_en: 'Bangkok', geography_id: 1, deleted_at: null },
      { id: 2, name_th: 'เชียงใหม่', name_en: 'Chiang Mai', geography_id: 2, deleted_at: null },
    ],
    amphures: [
      { id: 1001, name_th: 'จตุจักร', name_en: 'Chatuchak', province_id: 1, deleted_at: null },
      { id: 2001, name_th: 'เมืองเชียงใหม่', name_en: 'Mueang Chiang Mai', province_id: 2, deleted_at: null },
    ],
    tambons: [
      { id: 100101, zip_code: 10900, name_th: 'ลาดพร้าว', name_en: 'Lat Phrao', amphure_id: 1001, deleted_at: null },
      { id: 100102, zip_code: 10900, name_th: 'จอมพล', name_en: 'Chom Phon', amphure_id: 1001, deleted_at: null },
      { id: 200101, zip_code: 50000, name_th: 'ศรีภูมิ', name_en: 'Si Phum', amphure_id: 2001, deleted_at: null },
    ],
  }

  it('listProvinces returns exactly the two provinces present', () => {
    const idx = buildThaiAddressIndex(mockData)
    const provinces = listProvinces(idx)
    expect(provinces.map(p => p.id).sort()).toEqual([1, 2])
  })

  it('listAmphures deduplicates when a province has multiple tambon records', () => {
    const idx = buildThaiAddressIndex(mockData)
    const amphures = listAmphures(idx, 1)
    expect(amphures).toHaveLength(1)
    expect(amphures[0].id).toBe(1001)
  })

  it('listTambons returns both tambons under the shared amphure', () => {
    const idx = buildThaiAddressIndex(mockData)
    const tambons = listTambons(idx, 1001)
    expect(tambons.map(t => t.id).sort()).toEqual([100101, 100102])
  })

  it('falls back to scanning records when byProvince/byAmphure are absent (older-shaped index)', () => {
    const idx = buildThaiAddressIndex(mockData)
    const legacyIndex = { ...idx, byProvince: undefined, byAmphure: undefined } as unknown as TrigramIndex

    expect(listProvinces(legacyIndex).map(p => p.id).sort()).toEqual([1, 2])
    expect(listAmphures(legacyIndex, 1)).toHaveLength(1)
    expect(listTambons(legacyIndex, 1001).map(t => t.id).sort()).toEqual([100101, 100102])
  })
})
