import { describe, it, expect, beforeAll } from 'vitest'
import { loadDefaultIndex } from '../data'
import { searchThaiAddress, lookupByZipCode } from '../core/search'
import { formatThaiAddressSuggestion } from '../core/formatter'
import { resolveThaiAddress } from '../core/resolver'
import type { TrigramIndex } from '../types'
import { t as defaultTambons } from '../data/defaultData'

let index: TrigramIndex

beforeAll(async () => {
  index = await loadDefaultIndex()
})

describe('defaultIndex integration', () => {
  it('has expected number of records', () => {
    expect(index.records.length).toBeGreaterThan(7000)
  })

  it('has non-empty trigram map', () => {
    expect(index.map.size).toBeGreaterThan(5000)
  })

  it('finds ลาดพร้าว by exact name', () => {
    const results = searchThaiAddress(index, 'ลาดพร้าว')
    expect(results.some(r => r.tambonNameTh === 'ลาดพร้าว')).toBe(true)
  })

  it('finds ลาดพร้าว with tone marks missing (fuzzy)', () => {
    const results = searchThaiAddress(index, 'ลาดพราว')
    expect(results.some(r => r.tambonNameTh === 'ลาดพร้าว')).toBe(true)
  })

  // A romanized query can never match the Thai name, so match-rank ranking has to
  // consult the English name too. Without that, these fall back to alphabetical
  // order and a tambon that only matches via its parent district wins — the exact
  // ranking bug match-rank exists to fix, just on the Latin-script path.
  it.each([
    ['lat phrao', 'ลาดพร้าว'],
    ['lardprao', 'ลาดพร้าว'],   // non-RTGS spelling, resolved via romanization aliases
    ['ladkrabang', 'ลาดกระบัง'],
    ['bang rak', 'บางรัก'],
  ])('ranks the exact tambon first for romanized query %s', (query, expected) => {
    const results = searchThaiAddress(index, query)
    expect(results[0].tambonNameTh).toBe(expected)
  })

  it('finds records by province name', () => {
    const results = searchThaiAddress(index, 'กรุงเทพ')
    expect(results.length).toBeGreaterThan(0)
    expect(results.every(r => r.provinceNameTh === 'กรุงเทพมหานคร')).toBe(true)
  })

  it('finds records by zip code', () => {
    const results = searchThaiAddress(index, '10900')
    expect(results.length).toBeGreaterThan(0)
    expect(results.every(r => r.zipCode === '10900')).toBe(true)
  })

  it('finds records by English province name', () => {
    const results = searchThaiAddress(index, 'chiang mai')
    expect(results.some(r => r.provinceNameEn === 'Chiang Mai')).toBe(true)
  })

  it('formatThaiAddressSuggestion produces correct label format', () => {
    const results = searchThaiAddress(index, 'ลาดพร้าว')
    const suggestion = formatThaiAddressSuggestion(results[0])
    expect(suggestion.label).toMatch(/^.+ > .+ > .+ \d{5}$/)
    expect(suggestion.id).toBeTruthy()
  })

  it('resolveThaiAddress produces all expected fields', () => {
    const results = searchThaiAddress(index, 'ลาดพร้าว')
    const resolved = resolveThaiAddress(results[0])
    expect(resolved.tambon).toBeTruthy()
    expect(resolved.subdistrict).toBe(resolved.tambon)
    expect(resolved.district).toBe(resolved.amphure)
    expect(resolved.postalCode).toBe(resolved.zipCode)
  })

  it('returns empty for nonsense query', () => {
    const results = searchThaiAddress(index, 'zzzzzzzzzz')
    expect(results).toHaveLength(0)
  })

  // UC-1 / UC-5: exact tambon match must rank first, even when other
  // records only match via a parent amphure/province with the same name.
  it('ranks the exact ลาดพร้าว tambon first', () => {
    const results = searchThaiAddress(index, 'ลาดพร้าว')
    expect(results[0].tambonNameTh).toBe('ลาดพร้าว')
  })

  it('ranks the exact บางรัก tambon first, not an unrelated Bang Rak district tambon', () => {
    const results = searchThaiAddress(index, 'บางรัก')
    expect(results[0].tambonNameTh).toBe('บางรัก')
  })

  // UC-2: zip lookups must not silently truncate at the text-search `limit`.
  // 45000 maps to 33 tambons in the bundled dataset.
  it('returns all 33 records for zip 45000 by default', () => {
    const results = searchThaiAddress(index, '45000')
    expect(results).toHaveLength(33)
  })

  // A partial prefix can match hundreds of records; without an explicit
  // zipLimit it is bounded by the text-search `limit` instead.
  it('caps a partial zip prefix at limit by default', () => {
    expect(searchThaiAddress(index, '30')).toHaveLength(10)
    expect(searchThaiAddress(index, '30', { limit: 3 })).toHaveLength(3)
  })

  it('returns every prefix match when zipLimit is Infinity', () => {
    expect(searchThaiAddress(index, '30', { zipLimit: Infinity }).length).toBeGreaterThan(200)
  })

  it('honours zipLimit for zip 45000', () => {
    const results = searchThaiAddress(index, '45000', { zipLimit: 5 })
    expect(results).toHaveLength(5)
  })

  it('orders exact-zip matches before prefix matches for 10500', () => {
    const results = searchThaiAddress(index, '10500')
    expect(results.length).toBeGreaterThan(0)
    expect(results.every(r => r.zipCode === '10500')).toBe(true)
  })

  it('lookupByZipCode returns all 33 records for 45000', () => {
    const results = lookupByZipCode(index, '45000')
    expect(results).toHaveLength(33)
  })

  // Amphures and tambons whose names start with เกาะ were once missing from
  // data/, which left island zip codes unsearchable (see data/SOURCE.md).
  it.each([
    ['84320', 'เกาะสมุย'],
    ['84140', 'เกาะสมุย'],
    ['84280', 'เกาะพะงัน'],
    ['84360', 'เกาะพะงัน'],
    ['23170', 'เกาะช้าง'],
    ['81150', 'เกาะลันตา'],
    ['20120', 'เกาะสีชัง'],
    ['52130', 'เกาะคา'],
  ])('finds island district records for zip %s (%s)', (zip, amphure) => {
    const results = lookupByZipCode(index, zip)
    expect(results.length).toBeGreaterThan(0)
    expect(results.every(r => r.amphureNameTh === amphure)).toBe(true)
  })

  it('finds tambons named เกาะ… by name', () => {
    const results = searchThaiAddress(index, 'เกาะเต่า')
    expect(results.some(r => r.tambonNameTh === 'เกาะเต่า' && r.amphureNameTh === 'เกาะพะงัน')).toBe(true)
    expect(searchThaiAddress(index, 'ko samui')[0].amphureNameTh).toBe('เกาะสมุย')
  })

  it('includes อำเภอกัลยาณิวัฒนา (Chiang Mai)', () => {
    const results = searchThaiAddress(index, 'กัลยาณิวัฒนา').filter(r => r.amphureNameTh === 'กัลยาณิวัฒนา')
    expect(results.map(r => r.tambonNameTh).sort()).toEqual(['บ้านจันทร์', 'แจ่มหลวง', 'แม่แดด'].sort())
    expect(results.every(r => r.provinceNameTh === 'เชียงใหม่' && r.zipCode === '58130')).toBe(true)
  })

  it('indexes every bundled tambon (no tambon is orphaned from its amphure)', () => {
    expect(index.records).toHaveLength(defaultTambons.length)
  })

  // S-5: bound the raw query before the (multi-pass) normalizer runs over it
  it('returns empty array for a query longer than 1000 characters', () => {
    expect(searchThaiAddress(index, 'ก'.repeat(1001))).toHaveLength(0)
  })

  // UC-12: sub-3-char queries can never match a >=3-char indexed name
  it('returns empty array for 2-char queries', () => {
    expect(searchThaiAddress(index, 'ปา')).toHaveLength(0)
    expect(searchThaiAddress(index, 'สี')).toHaveLength(0)
  })
})
