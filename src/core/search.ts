import { normalizeThaiAddressText } from './normalizer'
import { extractTrigramsNormalized } from './trigrams'
import type { SearchOptions, ThaiAddressRecord, TrigramIndex } from '../types'

const ZIP_CODE_RE = /^\d+$/

export function searchThaiAddress(
  index: TrigramIndex,
  query: string,
  options?: SearchOptions,
): ThaiAddressRecord[] {
  const limit = options?.limit ?? 10
  const threshold = options?.threshold ?? 0.4

  if (!index || !query) return []
  const normalized = normalizeThaiAddressText(query)
  if (normalized.length === 0) return []
  if (normalized.length > 300) return []

  // Special case: zip code query (require at least 2 digits to avoid overly broad matches)
  if (ZIP_CODE_RE.test(normalized)) {
    if (normalized.length < 2) return []
    const matches: ThaiAddressRecord[] = []
    for (const [zip, indices] of index.zipIndex) {
      if (zip.startsWith(normalized)) {
        for (const idx of indices) matches.push(index.records[idx])
      }
    }
    // exact match first, then ascending zip code
    matches.sort((a, b) => {
      if (a.zipCode === normalized && b.zipCode !== normalized) return -1
      if (b.zipCode === normalized && a.zipCode !== normalized) return 1
      return a.zipCode.localeCompare(b.zipCode)
    })
    return matches.slice(0, limit)
  }

  const queryTrigrams = extractTrigramsNormalized(normalized)

  // Accumulate hit counts per record index
  const hits = new Map<number, number>()
  for (const trigram of queryTrigrams) {
    const candidates = index.map.get(trigram)
    if (!candidates) continue
    for (const idx of candidates) {
      hits.set(idx, (hits.get(idx) ?? 0) + 1)
    }
  }

  const scored: { idx: number; score: number }[] = []
  for (const [idx, count] of hits) {
    const score = count / queryTrigrams.size
    if (score >= threshold) {
      scored.push({ idx, score })
    }
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    const ra = index.records[a.idx]
    const rb = index.records[b.idx]
    return (
      ra.provinceNameTh.localeCompare(rb.provinceNameTh) ||
      ra.amphureNameTh.localeCompare(rb.amphureNameTh) ||
      ra.tambonNameTh.localeCompare(rb.tambonNameTh)
    )
  })

  return scored.slice(0, limit).map(({ idx }) => index.records[idx])
}
