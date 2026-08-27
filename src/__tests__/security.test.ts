/// <reference types="node" />
import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { buildThaiAddressIndex, validateRawData } from '../core/indexer'
import { searchThaiAddress, lookupByZipCode } from '../core/search'
import { normalizeThaiAddressText } from '../core/normalizer'
import { listProvinces, listAmphures, listTambons } from '../core/enumerate'
import { loadDefaultIndex } from '../data'
import type { RawData, TrigramIndex } from '../types'

const baseData: RawData = {
  provinces: [
    { id: 1, name_th: 'กรุงเทพมหานคร', name_en: 'Bangkok', geography_id: 1, deleted_at: null },
  ],
  amphures: [
    { id: 1001, name_th: 'ลาดพร้าว', name_en: 'Lat Phrao', province_id: 1, deleted_at: null },
  ],
  tambons: [
    { id: 100101, zip_code: 10900, name_th: 'ลาดพร้าว', name_en: 'Lat Phrao', amphure_id: 1001, deleted_at: null },
    { id: 100102, zip_code: 10900, name_th: 'จอมพล', name_en: 'Chom Phon', amphure_id: 1001, deleted_at: null },
    { id: 100103, zip_code: 10901, name_th: 'จอมทอง', name_en: 'Chom Thong', amphure_id: 1001, deleted_at: null },
  ],
}

let defaultIndex: TrigramIndex

beforeAll(async () => {
  defaultIndex = await loadDefaultIndex()
})

// ---------------------------------------------------------------------------
// SEC-2 / Phase 1 — duplicate IDs in custom datasets
// ---------------------------------------------------------------------------

describe('validateRawData duplicate id detection', () => {
  it('throws a descriptive error for duplicate province ids', () => {
    const data: RawData = {
      ...baseData,
      provinces: [...baseData.provinces, { ...baseData.provinces[0] }],
    }
    expect(() => validateRawData(data)).toThrow('[thaizip] duplicate province id: 1')
  })

  it('throws a descriptive error for duplicate amphure ids', () => {
    const data: RawData = {
      ...baseData,
      amphures: [...baseData.amphures, { ...baseData.amphures[0] }],
    }
    expect(() => validateRawData(data)).toThrow('[thaizip] duplicate amphure id: 1001')
  })

  it('throws a descriptive error for duplicate tambon ids', () => {
    const data: RawData = {
      ...baseData,
      tambons: [...baseData.tambons, { ...baseData.tambons[0] }],
    }
    expect(() => validateRawData(data)).toThrow('[thaizip] duplicate tambon id: 100101')
  })

  it('buildThaiAddressIndex rejects duplicate tambon ids by default (default path to the React hook)', () => {
    const data: RawData = {
      ...baseData,
      tambons: [
        { id: 100101, zip_code: 10900, name_th: 'อาทิ', name_en: 'Alpha', amphure_id: 1001, deleted_at: null },
        { id: 100101, zip_code: 10900, name_th: 'เบต้า', name_en: 'Beta', amphure_id: 1001, deleted_at: null },
      ],
    }
    // Two suggestions sharing one id would make the React hook resolve BOTH
    // selections to the same record — the index build must fail instead.
    expect(() => buildThaiAddressIndex(data)).toThrow('[thaizip] duplicate tambon id: 100101')
  })

  it('a duplicate between a live row and a soft-deleted row still throws (every row is validated as provided)', () => {
    const data: RawData = {
      ...baseData,
      tambons: [
        baseData.tambons[0],
        { ...baseData.tambons[0], deleted_at: '2020-01-01' },
      ],
    }
    expect(() => validateRawData(data)).toThrow('[thaizip] duplicate tambon id: 100101')
  })

  it('valid datasets still pass, including soft-deleted rows and dangling references', () => {
    const data: RawData = {
      provinces: [
        baseData.provinces[0],
        { id: 2, name_th: 'ลบแล้ว', name_en: 'Deleted', geography_id: 1, deleted_at: '2020-01-01' },
      ],
      amphures: [
        baseData.amphures[0],
        // dangling province_id (province soft-deleted): handled by onSkip at
        // build time, intentionally NOT a validation error
        { id: 1002, name_th: 'เมือง', name_en: 'Mueang', province_id: 2, deleted_at: null },
      ],
      tambons: [
        ...baseData.tambons,
        // dangling amphure_id: also handled by onSkip, not validation
        { id: 100199, zip_code: 10900, name_th: 'กำแพง', name_en: 'Kamphaeng', amphure_id: 9999, deleted_at: null },
      ],
    }
    expect(() => validateRawData(data)).not.toThrow()
    const index = buildThaiAddressIndex(data)
    expect(index.records).toHaveLength(3)
  })

  it('validate: false preserves the documented trust-boundary behavior (duplicates build without error)', () => {
    const data: RawData = {
      ...baseData,
      tambons: [
        { id: 100101, zip_code: 10900, name_th: 'อาทิ', name_en: 'Alpha', amphure_id: 1001, deleted_at: null },
        { id: 100101, zip_code: 10900, name_th: 'เบต้า', name_en: 'Beta', amphure_id: 1001, deleted_at: null },
      ],
    }
    expect(() => buildThaiAddressIndex(data, { validate: false })).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// SEC-5 / Phase 3 — malformed runtime input at public boundaries
// ---------------------------------------------------------------------------

describe('runtime API boundary hardening', () => {
  const junkValues = [
    null,
    undefined,
    {},
    [],
    true,
    false,
    NaN,
    Infinity,
    Symbol('x'),
    BigInt(1),
    new String('ลาดพร้าว'),
    new Date(),
  ]

  it.each(junkValues.map((v, i) => [String(i), v]))(
    'searchThaiAddress returns [] for junk query %#',
    (_label, query) => {
      expect(searchThaiAddress(defaultIndex, query as never)).toEqual([])
    },
  )

  it.each(junkValues.map((v, i) => [String(i), v]))(
    'lookupByZipCode returns [] for junk zip %#',
    (_label, zip) => {
      expect(lookupByZipCode(defaultIndex, zip as never)).toEqual([])
    },
  )

  it('searchThaiAddress returns [] for a junk index instead of crashing deep inside', () => {
    expect(searchThaiAddress({} as never, 'ลาดพร้าว')).toEqual([])
    expect(searchThaiAddress(null as never, 'ลาดพร้าว')).toEqual([])
  })

  it('lookupByZipCode returns [] for a junk index', () => {
    expect(lookupByZipCode({} as never, '10900')).toEqual([])
    expect(lookupByZipCode(null as never, '10900')).toEqual([])
  })

  it('falsy queries (0, false, NaN, empty string) still return []', () => {
    expect(searchThaiAddress(defaultIndex, 0 as never)).toEqual([])
    expect(searchThaiAddress(defaultIndex, false as never)).toEqual([])
    expect(searchThaiAddress(defaultIndex, NaN as never)).toEqual([])
    expect(searchThaiAddress(defaultIndex, '')).toEqual([])
  })

  it('enumerate APIs return [] for a junk index', () => {
    expect(listProvinces(null as never)).toEqual([])
    expect(listAmphures({} as never, 1)).toEqual([])
    expect(listTambons(null as never, 1001)).toEqual([])
  })

  it('normalizeThaiAddressText throws a descriptive TypeError for non-string input', () => {
    expect(() => normalizeThaiAddressText(null as never)).toThrow(
      '[thaizip] normalizeThaiAddressText expected string, got null',
    )
    expect(() => normalizeThaiAddressText(undefined as never)).toThrow(
      '[thaizip] normalizeThaiAddressText expected string, got undefined',
    )
    expect(() => normalizeThaiAddressText(123 as never)).toThrow(
      '[thaizip] normalizeThaiAddressText expected string, got number',
    )
    expect(() => normalizeThaiAddressText([] as never)).toThrow(
      '[thaizip] normalizeThaiAddressText expected string, got object',
    )
    expect(() => normalizeThaiAddressText(Symbol('x') as never)).toThrow(
      '[thaizip] normalizeThaiAddressText expected string, got symbol',
    )
    expect(() => normalizeThaiAddressText(BigInt(1) as never)).toThrow(
      '[thaizip] normalizeThaiAddressText expected string, got bigint',
    )
  })

  it('normalizeThaiAddressText still returns "" for an empty string', () => {
    expect(normalizeThaiAddressText('')).toBe('')
  })

  it('validateRawData throws descriptive errors for junk payloads', () => {
    expect(() => validateRawData(null as never)).toThrow(
      '[thaizip] validateRawData expected a RawData object, got null',
    )
    expect(() => validateRawData(undefined as never)).toThrow(
      '[thaizip] validateRawData expected a RawData object, got undefined',
    )
    expect(() => validateRawData({} as never)).toThrow(
      '[thaizip] RawData.provinces must be an array, got undefined',
    )
    expect(() => validateRawData({ provinces: [], amphures: null, tambons: [] } as never)).toThrow(
      '[thaizip] RawData.amphures must be an array, got null',
    )
    expect(() => validateRawData({ provinces: [null], amphures: [], tambons: [] } as never)).toThrow(
      '[thaizip] province[0]: expected object, got null',
    )
    expect(() => validateRawData({ provinces: [], amphures: [], tambons: ['x'] } as never)).toThrow(
      '[thaizip] tambon[0]: expected object, got string',
    )
  })

  it('buildThaiAddressIndex surfaces the descriptive validation error for junk data', () => {
    expect(() => buildThaiAddressIndex({} as never)).toThrow('[thaizip] RawData.provinces must be an array')
  })
})

// ---------------------------------------------------------------------------
// SEC-7 / Phase 4 — limit / zipLimit clamping
// ---------------------------------------------------------------------------

describe('limit and zipLimit clamping', () => {
  let index: TrigramIndex
  beforeAll(() => {
    // 3 tambons share province 1 → text query 'กรุงเทพ' scores all of them;
    // zip prefix '109' matches 3 records.
    index = buildThaiAddressIndex(baseData)
  })

  it('negative limits return [] instead of slice-style "all but the last"', () => {
    expect(searchThaiAddress(index, 'กรุงเทพ', { limit: -1 })).toEqual([])
    expect(searchThaiAddress(index, 'กรุงเทพ', { limit: -100 })).toEqual([])
  })

  it('NaN limit returns [] (matches previous slice(0, NaN) behavior)', () => {
    expect(searchThaiAddress(index, 'กรุงเทพ', { limit: NaN })).toEqual([])
  })

  it('limit 0 returns []', () => {
    expect(searchThaiAddress(index, 'กรุงเทพ', { limit: 0 })).toEqual([])
  })

  it('fractional limits floor (1.9 → 1 result)', () => {
    expect(searchThaiAddress(index, 'กรุงเทพ', { limit: 1.9 })).toHaveLength(1)
  })

  it('limit Infinity returns everything', () => {
    expect(searchThaiAddress(index, 'กรุงเทพ', { limit: Infinity })).toHaveLength(3)
  })

  it('negative zipLimit returns [] instead of slice-style truncation', () => {
    expect(lookupByZipCode(index, '109', { zipLimit: -1 })).toEqual([])
    expect(searchThaiAddress(index, '109', { zipLimit: -1 })).toEqual([])
  })

  it('NaN zipLimit returns []', () => {
    expect(lookupByZipCode(index, '109', { zipLimit: NaN })).toEqual([])
    expect(searchThaiAddress(index, '109', { zipLimit: NaN })).toEqual([])
  })

  it('zipLimit 0 returns []', () => {
    expect(lookupByZipCode(index, '109', { zipLimit: 0 })).toEqual([])
  })

  it('fractional zipLimit floors (1.9 → 1 result)', () => {
    expect(lookupByZipCode(index, '109', { zipLimit: 1.9 })).toHaveLength(1)
  })

  it('zipLimit Infinity (the default) returns all matches', () => {
    expect(lookupByZipCode(index, '109', { zipLimit: Infinity })).toHaveLength(3)
    expect(lookupByZipCode(index, '109')).toHaveLength(3)
  })
})

// ---------------------------------------------------------------------------
// SEC-4 / Phase 5 — mutation isolation of shared index records
// ---------------------------------------------------------------------------

describe('search results cannot corrupt the shared index', () => {
  it('mutating every field of a search result leaves the index intact', () => {
    const first = searchThaiAddress(defaultIndex, 'ลาดพร้าว')
    expect(first.length).toBeGreaterThan(0)
    const original = { ...first[0] }

    // Hostile/buggy consumer writes through the returned reference
    const r = first[0] as unknown as Record<string, unknown>
    for (const key of Object.keys(r)) {
      r[key] = key === 'provinceId' || key === 'amphureId' || key === 'tambonId' ? -1 : 'PWNED'
    }

    const second = searchThaiAddress(defaultIndex, 'ลาดพร้าว')
    expect(second[0]).toEqual(original)
    const stored = defaultIndex.records.find(rec => rec.tambonId === original.tambonId)!
    expect(stored).toEqual(original)
  })

  it('mutating zip-lookup results leaves the index intact', () => {
    const first = lookupByZipCode(defaultIndex, '10500')
    expect(first.length).toBeGreaterThan(0)
    const original = { ...first[0] }

    const r = first[0] as unknown as Record<string, unknown>
    for (const key of Object.keys(r)) {
      r[key] = 'PWNED'
    }

    const second = lookupByZipCode(defaultIndex, '10500')
    expect(second[0]).toEqual(original)
  })

  it('returned records are not the same objects stored in the index', () => {
    const results = searchThaiAddress(defaultIndex, 'ลาดพร้าว')
    for (const record of results) {
      expect(defaultIndex.records).not.toContain(record)
    }
  })
})

// ---------------------------------------------------------------------------
// SEC-11 / Phase 6 — Unicode NFC/NFD consistency
// ---------------------------------------------------------------------------

describe('Unicode normalization consistency', () => {
  it('NFD and NFC forms of the same Latin string normalize identically', () => {
    expect(normalizeThaiAddressText('Café')).toBe(normalizeThaiAddressText('Cafe\u0301'))
  })

  it('an NFD query matches an NFC-indexed name', () => {
    const data: RawData = {
      provinces: [
        { id: 1, name_th: 'ทดสอบ', name_en: 'Café District', geography_id: 1, deleted_at: null },
      ],
      amphures: [
        { id: 1001, name_th: 'ทดสอบ', name_en: 'Café', province_id: 1, deleted_at: null },
      ],
      tambons: [
        { id: 100101, zip_code: 10900, name_th: 'ทดสอบ', name_en: 'Café', amphure_id: 1001, deleted_at: null },
      ],
    }
    const index = buildThaiAddressIndex(data)
    // NFD decomposed query must find the NFC-composed indexed name
    const results = searchThaiAddress(index, 'Cafe\u0301')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].tambonNameEn).toBe('Café')
  })

  it('Thai text is unaffected by NFC (no canonical compositions in the Thai block)', () => {
    expect('ลาดพร้าว'.normalize('NFC')).toBe('ลาดพร้าว'.normalize('NFD'))
    expect(normalizeThaiAddressText('ลาดพร้าว')).toBe('ลาดพราว')
  })

  it('zero-width characters in a query do not crash and do not corrupt results', () => {
    expect(Array.isArray(searchThaiAddress(defaultIndex, 'ลาด\u200Bพร้าว'))).toBe(true)
  })

  it('emoji queries do not crash', () => {
    expect(searchThaiAddress(defaultIndex, '😀😀😀')).toEqual([])
  })

  it('combining-mark soup is rejected by the length guards', () => {
    expect(searchThaiAddress(defaultIndex, '\u0300'.repeat(100_000))).toEqual([])
  })

  it('Turkish İ (lowercases to i + combining dot) is bounded by the normalized-length guard', () => {
    // 200 × 'İ' → 400 normalized chars > 300 → rejected, not searched
    expect(searchThaiAddress(defaultIndex, '\u0130'.repeat(200))).toEqual([])
  })

  it('romanization aliases still apply after NFC normalization', () => {
    const results = searchThaiAddress(defaultIndex, 'lardprao')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].tambonNameTh).toBe('ลาดพร้าว')
  })
})

// ---------------------------------------------------------------------------
// Phase 10 — DoS guard permanence (real default index, huge inputs)
// ---------------------------------------------------------------------------

describe('DoS input guards against the real default index', () => {
  it('rejects a million-character ASCII query', () => {
    expect(searchThaiAddress(defaultIndex, 'a'.repeat(1_000_000))).toEqual([])
  })

  it('rejects a hundred-thousand-character combining-mark query', () => {
    expect(searchThaiAddress(defaultIndex, '\u0300'.repeat(100_000))).toEqual([])
  })

  it('rejects a hundred-thousand-character zero-width-space query', () => {
    expect(searchThaiAddress(defaultIndex, '\u200B'.repeat(100_000))).toEqual([])
  })

  it('rejects a hundred-thousand-character emoji query', () => {
    expect(searchThaiAddress(defaultIndex, '😀'.repeat(100_000))).toEqual([])
  })

  it('rejects lowercase-expanding İ input beyond the 300-char normalized bound', () => {
    expect(searchThaiAddress(defaultIndex, '\u0130'.repeat(200))).toEqual([])
  })

  it('rejects raw queries over 1000 chars before normalization', () => {
    expect(searchThaiAddress(defaultIndex, 'ลาดพร้าว'.repeat(300))).toEqual([])
  })

  it('rejects an over-long million-digit zip without scanning it', () => {
    expect(lookupByZipCode(defaultIndex, '1'.repeat(1_000_000))).toEqual([])
  })

  // Loose timing budgets, opt-in only (CI_SLOW=1): unit tests must not be
  // flaky on slow machines, so the default suite asserts results, not speed.
  describe.skipIf(!process.env.CI_SLOW)('timing smoke (loose budgets)', () => {
    it('million-char query is rejected in well under 50 ms', () => {
      const t0 = performance.now()
      expect(searchThaiAddress(defaultIndex, 'a'.repeat(1_000_000))).toEqual([])
      expect(performance.now() - t0).toBeLessThan(50)
    })

    it('worst legal 300-char high-entropy query completes under 50 ms', () => {
      const q = 'abcdefghijklmnopqrstuvwxyz0123456789'.repeat(9).slice(0, 300)
      const t0 = performance.now()
      searchThaiAddress(defaultIndex, q)
      expect(performance.now() - t0).toBeLessThan(50)
    })
  })
})

// ---------------------------------------------------------------------------
// Phase 11 — prototype-pollution resistance (Map/Set dictionaries)
// ---------------------------------------------------------------------------

describe('prototype-pollution resistance', () => {
  const protoData: RawData = {
    provinces: [
      { id: 1, name_th: '__proto__', name_en: 'constructor', geography_id: 1, deleted_at: null },
    ],
    amphures: [
      { id: 1001, name_th: 'prototype', name_en: 'toString', province_id: 1, deleted_at: null },
    ],
    tambons: [
      {
        id: 100101,
        zip_code: 'hasOwnProperty',
        name_th: 'hasOwnProperty',
        name_en: 'constructor.prototype',
        amphure_id: 1001,
        deleted_at: null,
      },
    ],
  }

  it('prototype-keyed names and zips build an index without polluting Object.prototype', () => {
    const index = buildThaiAddressIndex(protoData)
    const fresh: Record<string, unknown> = {}
    expect('tambonNameTh' in fresh).toBe(false)
    expect('provinceNameTh' in fresh).toBe(false)
    expect(({} as Record<string, unknown>).map).toBeUndefined()
    expect(index.records).toHaveLength(1)
  })

  it('prototype-keyed zip codes are retrievable from zipIndex', () => {
    const index = buildThaiAddressIndex(protoData)
    expect(index.zipIndex.get('hasOwnProperty')).toEqual([0])
  })

  it('searching with prototype-related query strings is safe', () => {
    const index = buildThaiAddressIndex(protoData)
    expect(Array.isArray(searchThaiAddress(index, '__proto__'))).toBe(true)
    expect(Array.isArray(searchThaiAddress(index, 'hasOwnProperty'))).toBe(true)
    expect(Array.isArray(searchThaiAddress(index, 'toString'))).toBe(true)
    // The real default index must stay unpolluted too
    expect(searchThaiAddress(defaultIndex, '__proto__')).toEqual([])
    expect(searchThaiAddress(defaultIndex, 'constructor')).toEqual([])
    expect(searchThaiAddress(defaultIndex, 'prototype')).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// SEC-1 / Phase 8 — GitHub Actions supply-chain pinning
// ---------------------------------------------------------------------------

describe('GitHub Actions are pinned to full commit SHAs', () => {
  const workflowsDir = resolve(process.cwd(), '.github/workflows')

  it('every uses: reference is a 40-hex commit SHA', () => {
    const files = readdirSync(workflowsDir).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'))
    expect(files.length).toBeGreaterThan(0)
    const offenders: string[] = []
    for (const file of files) {
      const content = readFileSync(join(workflowsDir, file), 'utf8')
      const lines = content.split('\n')
      for (let i = 0; i < lines.length; i++) {
        const match = lines[i].match(/^\s*-?\s*uses:\s*(\S+)\s*(?:#.*)?$/)
        if (!match) continue
        const ref = match[1].split('@')[1]
        if (!/^[0-9a-f]{40}$/.test(ref ?? '')) {
          offenders.push(`${file}:${i + 1} ${match[1]}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })
})
