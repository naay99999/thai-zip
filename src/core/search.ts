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
 * Look up records by zip code (exact or prefix match). Exact matches are
 * returned before prefix matches; ties are ordered by ascending zip code.
 *
 * Unlike `searchThaiAddress`, results are NOT capped by `options.limit` —
 * only by `options.zipLimit` (defaults to `Infinity`), since a zip code can
 * legitimately map to dozens of tambons (e.g. `45000` → 33 records).
 */
export function lookupByZipCode(
  index: TrigramIndex,
  zip: string,
  options?: SearchOptions,
): ThaiAddressRecord[] {
  if (!index || !zip) return []
  const normalized = zip.trim()
  if (!ZIP_CODE_RE.test(normalized) || normalized.length < 2) return []

  const zipLimit = options?.zipLimit ?? Infinity

  const matches: ThaiAddressRecord[] = []
  for (const [z, indices] of index.zipIndex) {
    if (z.startsWith(normalized)) {
      for (const idx of indices) matches.push(index.records[idx])
    }
  }
  sortZipMatches(matches, normalized)
  return matches.slice(0, zipLimit)
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

export function searchThaiAddress(
  index: TrigramIndex,
  query: string,
  options?: SearchOptions,
): ThaiAddressRecord[] {
  const limit = options?.limit ?? 10
  const threshold = options?.threshold ?? 0.4

  if (!index || !query) return []
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

  // Accumulate hit counts per record index
  const hits = new Map<number, number>()
  for (const trigram of queryTrigrams) {
    const candidates = index.map.get(trigram)
    if (!candidates) continue
    for (const idx of candidates) {
      hits.set(idx, (hits.get(idx) ?? 0) + 1)
    }
  }

  const scored: { idx: number; score: number; matchRank: number }[] = []
  for (const [idx, count] of hits) {
    const score = count / queryTrigrams.size
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

  return window.slice(0, limit).map(({ idx }) => index.records[idx])
}
