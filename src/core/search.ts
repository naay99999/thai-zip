import { normalizeThaiAddressText } from './normalizer'
import { extractTrigramsNormalized } from './trigrams'
import { applyRomanizationAliases } from './romanize'
import type { SearchOptions, ThaiAddressRecord, TrigramIndex } from '../types'

const ZIP_CODE_RE = /^\d+$/
const HAS_LATIN_RE = /[a-z]/i

// Constructing Intl.Collator is expensive; build it once at module load rather
// than on every comparator invocation inside a hot sort loop.
const TH_COLLATOR = new Intl.Collator('th')

/** Plain, allocation-free string comparison. Zip codes in the bundled dataset
 * are fixed-width zero-padded 5-digit strings, so lexical order already
 * matches numeric order — no need for `localeCompare`'s Intl machinery. */
function compareZip(a: string, b: string): number {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

function sortZipMatches(matches: ThaiAddressRecord[], exactZip: string): ThaiAddressRecord[] {
  matches.sort((a, b) => {
    if (a.zipCode === exactZip && b.zipCode !== exactZip) return -1
    if (b.zipCode === exactZip && a.zipCode !== exactZip) return 1
    return compareZip(a.zipCode, b.zipCode)
  })
  return matches
}

/**
 * Normalize a user-supplied limit near the public boundary so that
 * `Array.prototype.slice` never sees a value with surprising semantics:
 * negative values mean "drop from the end" in slice (`limit: -1` would return
 * everything except the last result), so they clamp to `0`; fractional values
 * floor (slice's own ToIntegerOrInfinity behavior); `NaN` and `-Infinity`
 * collapse to `0` (slice's ToIntegerOrInfinity(NaN) is `0`, i.e. empty).
 * `Infinity` passes through — it is the default and a meaningful value for
 * `zipLimit`.
 */
function normalizeLimit(value: number): number {
  if (Number.isNaN(value) || value === -Infinity) return 0
  if (value === Infinity) return value
  return Math.max(0, Math.floor(value))
}

/**
 * Look up records by zip code (exact or prefix match). Exact matches are
 * returned before prefix matches; ties are ordered by ascending zip code.
 *
 * Uses the build-time `sortedZipKeys`/`sortedZipPostings` arrays with a
 * binary search for the first key ≥ the query, then walks the contiguous
 * prefix range — O(log n_zips + matches). Ascending key order places an
 * exact match before any longer prefix match automatically, so no explicit
 * exact-first sort is needed. Indexes without the sorted arrays (older
 * shape, hand-built) fall back to the original O(n_zips) scan + sort.
 *
 * Returned records are shallow copies: mutating them cannot corrupt the
 * shared index (see `searchThaiAddress`).
 *
 * Unlike `searchThaiAddress`, results are NOT capped by `options.limit` —
 * only by `options.zipLimit` (defaults to `Infinity`), since a zip code can
 * legitimately map to dozens of tambons (e.g. `45000` → 33 records).
 *
 * Malformed runtime input (non-string `zip`, missing index shape) returns
 * `[]` rather than crashing deep inside the library.
 */
export function lookupByZipCode(
  index: TrigramIndex,
  zip: string,
  options?: SearchOptions,
): ThaiAddressRecord[] {
  if (!index || !index.zipIndex || !index.records || typeof zip !== 'string') return []
  const normalized = zip.trim()
  if (!ZIP_CODE_RE.test(normalized) || normalized.length < 2) return []

  const zipLimit = normalizeLimit(options?.zipLimit ?? Infinity)

  const matches: ThaiAddressRecord[] = []
  const keys = index.sortedZipKeys
  const postings = index.sortedZipPostings
  if (keys !== undefined && postings !== undefined) {
    // lower_bound: first index whose key is >= normalized
    let lo = 0
    let hi = keys.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (keys[mid] < normalized) lo = mid + 1
      else hi = mid
    }
    for (let i = lo; i < keys.length && keys[i].startsWith(normalized); i++) {
      const indices = postings[i]
      for (let j = 0; j < indices.length; j++) matches.push(index.records[indices[j]])
    }
  } else {
    for (const [z, indices] of index.zipIndex) {
      if (z.startsWith(normalized)) {
        for (const idx of indices) matches.push(index.records[idx])
      }
    }
    sortZipMatches(matches, normalized)
  }
  // Shallow-copy after slicing so only the returned records are cloned.
  return matches.slice(0, zipLimit).map(record => ({ ...record }))
}

function rankAgainstName(name: string | undefined, query: string): number {
  if (name === undefined || name.length === 0) return 0
  if (name === query) return 3
  if (name.startsWith(query)) return 2
  if (name.includes(query)) return 1
  return 0
}

/** `3` = exact tambon name match, `2` = prefix match, `1` = substring match,
 * `0` = no match on the tambon's own (normalized) name. Used to rank a
 * record whose OWN name matches the query above a record that only matches
 * via its parent amphure/province.
 *
 * Both the Thai and the English name are checked: a Latin-script query can
 * never match the Thai name, so without the English side every romanized
 * query would fall back to alphabetical order and reproduce exactly the
 * ranking bug this function exists to fix. */
function computeMatchRank(index: TrigramIndex, idx: number, query: string): number {
  const th = rankAgainstName(index.normTambon?.[idx], query)
  if (th === 3) return 3
  const en = rankAgainstName(index.normTambonEn?.[idx], query)
  return en > th ? en : th
}

/**
 * Per-index scratch buffers for hit counting. A `Map<number, number>` keyed
 * by record index was measured at 2-2.6× slower than flat `Uint32Array`
 * counters on the heaviest queries (the posting-union loop runs up to
 * ~11k increments per query): integer-array indexing avoids hash lookups
 * and number boxing. `touched` lists the records with a non-zero count, in
 * first-touch order — the exact iteration order the previous Map produced,
 * so downstream stable-sort tie order is unchanged.
 *
 * Kept in a WeakMap so multiple indexes (custom datasets) each get their
 * own buffers, and so the buffers are collected together with their index.
 */
const scratchByIndex = new WeakMap<TrigramIndex, { counts: Uint32Array; touched: Int32Array }>()

function getScratch(index: TrigramIndex): { counts: Uint32Array; touched: Int32Array } {
  const n = index.records.length
  let s = scratchByIndex.get(index)
  if (s === undefined || s.counts.length < n) {
    s = { counts: new Uint32Array(n), touched: new Int32Array(n) }
    scratchByIndex.set(index, s)
  }
  return s
}

export function searchThaiAddress(
  index: TrigramIndex,
  query: string,
  options?: SearchOptions,
): ThaiAddressRecord[] {
  const limit = normalizeLimit(options?.limit ?? 10)
  const threshold = options?.threshold ?? 0.4

  // Runtime guard for JS consumers: a non-string query or junk index returns
  // [] instead of an opaque `TypeError` deep inside the normalizer.
  if (!index || !index.map || !index.records || typeof query !== 'string') return []
  // Bound the raw query before running the (multi-pass) normalizer over it.
  if (query.length > 1000) return []
  const normalized = normalizeThaiAddressText(query)
  if (normalized.length === 0) return []
  if (normalized.length > 300) return []

  // Special case: zip code query (require at least 2 digits to avoid overly broad matches)
  if (ZIP_CODE_RE.test(normalized)) {
    if (normalized.length < 2) return []
    return lookupByZipCode(index, normalized, {
      zipLimit: options?.zipLimit ?? Infinity,
    })
  }

  // Queries shorter than 3 chars produce a single-element trigram set where every
  // partial hit scores 1.0 — meaningless for text search. The index never contains
  // trigram keys shorter than 3 chars for names of length >= 3, so a sub-3-char
  // query can never usefully match anything.
  if (normalized.length < 3) return []

  // Expand common non-RTGS romanizations (e.g. "lardprao" -> "lat phrao") for
  // Latin-script queries. Thai-script queries are passed through untouched.
  const searchText =
    options?.romanizationAliases !== false && HAS_LATIN_RE.test(normalized)
      ? applyRomanizationAliases(normalized)
      : normalized

  const queryTrigrams = extractTrigramsNormalized(searchText)

  // Accumulate hit counts per record index using the flat scratch counters.
  // Every touched entry is reset during scoring below, so the scratch is
  // all-zero again by the time the function returns.
  const { counts, touched } = getScratch(index)
  let touchedLen = 0
  for (const trigram of queryTrigrams) {
    const candidates = index.map.get(trigram)
    if (!candidates) continue
    for (const idx of candidates) {
      if (counts[idx] === 0) touched[touchedLen++] = idx
      counts[idx]++
    }
  }

  const scored: { idx: number; score: number; matchRank: number }[] = []
  const totalTrigrams = queryTrigrams.size
  for (let i = 0; i < touchedLen; i++) {
    const idx = touched[i]
    const score = counts[idx] / totalTrigrams
    counts[idx] = 0
    if (score >= threshold) {
      scored.push({ idx, score, matchRank: computeMatchRank(index, idx, searchText) })
    }
  }

  // Cheap numeric pre-sort (score, then matchRank) — no collator, no string
  // comparisons. This must include matchRank, not just score: an exact-name
  // match that ties on score with many parent-only matches could otherwise
  // fall outside the re-sorted window below and be lost.
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return b.matchRank - a.matchRank
  })

  // Only the top window is worth the expense of a locale-aware tie-break;
  // re-sort just that slice with the full comparator (including the
  // module-level cached collator) before truncating to `limit`.
  const windowSize = Math.max(limit * 4, 50)
  const window = scored.slice(0, windowSize)
  window.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (b.matchRank !== a.matchRank) return b.matchRank - a.matchRank
    const ra = index.records[a.idx]
    const rb = index.records[b.idx]
    return (
      TH_COLLATOR.compare(ra.provinceNameTh, rb.provinceNameTh) ||
      TH_COLLATOR.compare(ra.amphureNameTh, rb.amphureNameTh) ||
      TH_COLLATOR.compare(ra.tambonNameTh, rb.tambonNameTh)
    )
  })

  // Return shallow copies: `index.records` is shared (the default index is a
  // module-level singleton), so handing out live references would let one
  // consumer's mutation corrupt every other consumer's results. Copying at
  // most `limit` (~10) small flat objects is negligible next to the search
  // itself — measured within noise on the benchmark suite.
  return window.slice(0, limit).map(({ idx }) => ({ ...index.records[idx] }))
}
