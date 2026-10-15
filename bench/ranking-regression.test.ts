// Ranking regression suite: guards against silent ranking drift.
//
// `ranking-baseline.json` is a frozen snapshot of tambonId order for a broad
// query set (36 Thai/romanized/zip queries x 5 search variants each), verified
// refreshed after fixing incomplete alphabetical tie groups at the limit
// boundary. Any change to trigram scoring, sorting,
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

// The baseline predates capping partial zip prefixes (2–4 digits) at `limit`
// when no zipLimit is passed. Ordering is unchanged, so the expected result
// is the baseline truncated to that limit.
const PARTIAL_ZIP_RE = /^\d{2,4}$/
function capped(query: string, ids: number[], limit: number): number[] {
  return PARTIAL_ZIP_RE.test(query) ? ids.slice(0, limit) : ids
}

let index: TrigramIndex

beforeAll(() => {
  // Same construction as src/data/loader.ts and bench/ranking-snapshot.ts.
  index = buildThaiAddressIndex(defaultRawData(), { validate: false })
})

describe('ranking regression (frozen baseline)', () => {
  for (const query of Object.keys(fixture)) {
    it(`ranks "${query}" identically to the committed baseline`, () => {
      const expected = fixture[query]
      expect(searchThaiAddress(index, query).map((r) => r.tambonId)).toEqual(capped(query, expected.search, 10))
      expect(searchThaiAddress(index, query, { limit: 5 }).map((r) => r.tambonId)).toEqual(capped(query, expected.search_limit5, 5))
      expect(searchThaiAddress(index, query, { limit: 50 }).map((r) => r.tambonId)).toEqual(capped(query, expected.search_limit50, 50))
      expect(searchThaiAddress(index, query, { threshold: 0 }).map((r) => r.tambonId)).toEqual(capped(query, expected.search_thr0, 10))
      expect(lookupByZipCode(index, query).map((r) => r.tambonId)).toEqual(expected.zip)
    })
  }
})
