import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { applyRomanizationAliases } from '../core/romanize'
import { normalizeThaiAddressText } from '../core/normalizer'
import { searchThaiAddress } from '../core/search'
import { loadDefaultIndex, clearDefaultIndex } from '../data'
import type { ThaiAddressRecord, TrigramIndex } from '../types'

describe('applyRomanizationAliases', () => {
  it('returns Thai-script input unchanged', () => {
    expect(applyRomanizationAliases('บางรัก')).toBe('บางรัก')
    expect(applyRomanizationAliases('ลาดพร้าว')).toBe('ลาดพร้าว')
    expect(applyRomanizationAliases('เชียงใหม่')).toBe('เชียงใหม่')
  })

  it('returns mixed Thai+digit input unchanged', () => {
    expect(applyRomanizationAliases('บางรัก10500')).toBe('บางรัก10500')
    expect(applyRomanizationAliases('ซอย 1 บางรัก')).toBe('ซอย 1 บางรัก')
  })

  it('handles empty string', () => {
    expect(applyRomanizationAliases('')).toBe('')
  })

  it('handles whitespace-only input without throwing', () => {
    expect(() => applyRomanizationAliases('   ')).not.toThrow()
    expect(typeof applyRomanizationAliases('   ')).toBe('string')
  })

  describe('dictionary hits map to the exact RTGS string', () => {
    const cases: [alias: string, rtgs: string][] = [
      ['lardprao', 'lat phrao'],
      ['ladprao', 'lat phrao'],
      ['silom', 'si lom'],
      ['sathorn', 'sathon'],
      ['huaykwang', 'huai khwang'],
      ['klongtoey', 'khlong toei'],
      ['donmuang', 'don mueang'],
      ['bangrak', 'bang rak'],
      ['patumwan', 'pathum wan'],
      ['krungthep', 'bangkok'],
      ['korat', 'nakhon ratchasima'],
      ['chiangmai', 'chiang mai'],
      ['hatyai', 'hat yai'],
      ['huahin', 'hua hin'],
      ['lopburi', 'loburi'],
      ['buengkan', 'buogkan'],
      ['laksi', 'lak si'],
      ['khlongsamwa', 'khlong sam wa'],
      ['bangna', 'bang na'],
      ['wattana', 'watthana'],
    ]

    for (const [alias, rtgs] of cases) {
      it(`"${alias}" -> "${rtgs}"`, () => {
        expect(applyRomanizationAliases(alias)).toBe(rtgs)
      })
    }
  })

  describe('queries that already match RTGS exactly are returned unchanged', () => {
    const cases = ['bang rak', 'chatuchak', 'phuket', 'hua hin', 'chiang mai', 'krabi', 'watthana', 'din daeng']

    for (const q of cases) {
      it(`"${q}" is a no-op`, () => {
        expect(applyRomanizationAliases(q)).toBe(q)
      })
    }
  })

  describe('safe cleanup layer (dictionary-miss fallback)', () => {
    it('strips a trailing "district" noise word', () => {
      expect(applyRomanizationAliases('chatuchak district')).toBe('chatuchak')
    })

    it('strips a trailing "province" noise word', () => {
      expect(applyRomanizationAliases('bangkok province')).toBe('bangkok')
    })

    it('collapses repeated whitespace', () => {
      expect(applyRomanizationAliases('bang  rak')).toBe('bang rak')
    })

    it('does not strip "khet", which is a genuine name component in the real data', () => {
      // "Khet Chatuchak" is the real amphure name; stripping "khet" here
      // would not corrupt this particular query, but the noise-word list
      // intentionally excludes "khet" because other real records use it as
      // part of the tambon name itself (e.g. "Sanam Chai Khet").
      expect(applyRomanizationAliases('khet')).toBe('khet')
    })
  })
})

describe('applyRomanizationAliases end-to-end against the real default index', () => {
  let index: TrigramIndex

  beforeAll(async () => {
    index = await loadDefaultIndex()
  })

  // Other test files rely on `loadDefaultIndex()`'s module-level singleton
  // cache too; clear it afterwards rather than leaving it populated as a
  // side effect of this file running.
  afterAll(() => {
    clearDefaultIndex()
  })

  function inTop5(records: ThaiAddressRecord[], predicate: (r: ThaiAddressRecord) => boolean): boolean {
    return records.slice(0, 5).some(predicate)
  }

  function runAliased(query: string): ThaiAddressRecord[] {
    const normalized = normalizeThaiAddressText(query)
    const aliased = applyRomanizationAliases(normalized)
    // Disable the pipeline's own aliasing step so only this module's output
    // is under test here, independent of how search.ts wires it up.
    return searchThaiAddress(index, aliased, { limit: 5, romanizationAliases: false })
  }

  it('"lardprao" resolves to Lat Phrao district, Bangkok', () => {
    const results = runAliased('lardprao')
    expect(inTop5(results, r => r.amphureNameEn === 'Khet Lat Phrao')).toBe(true)
  })

  it('"silom" resolves to Si Lom tambon, Bang Rak', () => {
    const results = runAliased('silom')
    expect(inTop5(results, r => r.tambonNameEn === 'Si Lom')).toBe(true)
  })

  it('"krungthep" resolves to a Bangkok record', () => {
    const results = runAliased('krungthep')
    expect(inTop5(results, r => r.provinceNameEn === 'Bangkok')).toBe(true)
  })

  it('"huaykwang" resolves to Huai Khwang district, Bangkok', () => {
    const results = runAliased('huaykwang')
    expect(inTop5(results, r => r.amphureNameEn === 'Khet Huai Khwang')).toBe(true)
  })

  it('"korat" resolves to Nakhon Ratchasima province', () => {
    const results = runAliased('korat')
    expect(inTop5(results, r => r.provinceNameEn === 'Nakhon Ratchasima')).toBe(true)
  })

  it('"hatyai" resolves to Hat Yai district, Songkhla', () => {
    const results = runAliased('hatyai')
    expect(inTop5(results, r => r.amphureNameEn === 'Hat Yai' && r.provinceNameEn === 'Songkhla')).toBe(true)
  })
})
