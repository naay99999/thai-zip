// Ranking regression suite: guards against silent ranking drift.
//
// `ranking-baseline.json` is a frozen snapshot of tambonId order for a broad
// query set (36 Thai/romanized/zip queries x 5 search variants each), verified
// byte-identical across the performance-audit optimization work (see
// docs/reports/performance-audit.md). Any change to trigram scoring, sorting,
// or the collator tie-break that shifts result order for any of these queries
// fails this suite loudly.
//
// To intentionally update the baseline after a deliberate ranking change:
//   node --import tsx bench/ranking-snapshot.ts > bench/ranking-baseline.json
import { describe, it, expect, beforeAll } from 'vitest'
import { buildThaiAddressIndex } from '../src/core/indexer'
import { searchThaiAddress, lookupByZipCode } from '../src/core/search'
import type { TrigramIndex } from '../src/types'
import { defaultRawData } from './data'
import baseline from './ranking-baseline.json'

type BaselineEntry = {
  search: number[]
  search_limit5: number[]
  search_limit50: number[]
  search_thr0: number[]
  zip: number[]
}

const fixture = baseline as unknown as Record<string, BaselineEntry>

let index: TrigramIndex

beforeAll(() => {
  // Same construction as src/data/loader.ts and bench/ranking-snapshot.ts.
  index = buildThaiAddressIndex(defaultRawData(), { validate: false })
})

describe('ranking regression (frozen baseline)', () => {
  for (const query of Object.keys(fixture)) {
    it(`ranks "${query}" identically to the committed baseline`, () => {
      const expected = fixture[query]
      expect(searchThaiAddress(index, query).map((r) => r.tambonId)).toEqual(expected.search)
      expect(searchThaiAddress(index, query, { limit: 5 }).map((r) => r.tambonId)).toEqual(expected.search_limit5)
      expect(searchThaiAddress(index, query, { limit: 50 }).map((r) => r.tambonId)).toEqual(expected.search_limit50)
      expect(searchThaiAddress(index, query, { threshold: 0 }).map((r) => r.tambonId)).toEqual(expected.search_thr0)
      expect(lookupByZipCode(index, query).map((r) => r.tambonId)).toEqual(expected.zip)
    })
  }
})
