// Allocation pressure: hits Map<number,number> vs Uint32Array counters.
// Run: node --expose-gc --import tsx bench/alloc.ts
import { buildThaiAddressIndex } from '../src/core/indexer'
import { searchThaiAddress } from '../src/core/search'
import { normalizeThaiAddressText } from '../src/core/normalizer'
import { extractTrigramsNormalized } from '../src/core/trigrams'
import { applyRomanizationAliases } from '../src/core/romanize'
import { defaultRawData } from './data.ts'
import { header, benchSync, fmt, forceGC } from './harness.ts'
import type { ThaiAddressRecord, TrigramIndex } from '../src/types'

const raw = defaultRawData()
const index = buildThaiAddressIndex(raw, { validate: false })

const TH_COLLATOR = new Intl.Collator('th')

function rankAgainstName(name: string | undefined, query: string): number {
  if (name === undefined || name.length === 0) return 0
  if (name === query) return 3
  if (name.startsWith(query)) return 2
  if (name.includes(query)) return 1
  return 0
}
function computeMatchRank(idx: number, query: string): number {
  const th = rankAgainstName(index.normTambon?.[idx], query)
  if (th === 3) return 3
  const en = rankAgainstName(index.normTambonEn?.[idx], query)
  return en > th ? en : th
}

/** Variant A (current): Map<number, number> hit counting. */
function searchMapHit(index: TrigramIndex, query: string, limit = 10, threshold = 0.4): ThaiAddressRecord[] {
  const normalized = normalizeThaiAddressText(query)
  const searchText = /[a-z]/i.test(normalized) ? applyRomanizationAliases(normalized) : normalized
  const queryTrigrams = extractTrigramsNormalized(searchText)
  const hits = new Map<number, number>()
  for (const trigram of queryTrigrams) {
    const candidates = index.map.get(trigram)
    if (!candidates) continue
    for (const idx of candidates) hits.set(idx, (hits.get(idx) ?? 0) + 1)
  }
  const scored: { idx: number; score: number; matchRank: number }[] = []
  for (const [idx, count] of hits) {
    const score = count / queryTrigrams.size
    if (score >= threshold) scored.push({ idx, score, matchRank: computeMatchRank(idx, searchText) })
  }
  return finalize(index, scored, limit)
}

// Shared scratch state for variant B
const N = index.records.length
const counts = new Uint32Array(N)
const touched = new Uint32Array(N)
let touchedLen = 0

/** Variant B (prototype): typed-array counters + touched list, reused across calls. */
function searchTypedHit(index: TrigramIndex, query: string, limit = 10, threshold = 0.4): ThaiAddressRecord[] {
  const normalized = normalizeThaiAddressText(query)
  const searchText = /[a-z]/i.test(normalized) ? applyRomanizationAliases(normalized) : normalized
  const queryTrigrams = extractTrigramsNormalized(searchText)
  touchedLen = 0
  for (const trigram of queryTrigrams) {
    const candidates = index.map.get(trigram)
    if (!candidates) continue
    for (const idx of candidates) {
      if (counts[idx] === 0) touched[touchedLen++] = idx
      counts[idx]++
    }
  }
  const scored: { idx: number; score: number; matchRank: number }[] = []
  const T = queryTrigrams.size
  for (let i = 0; i < touchedLen; i++) {
    const idx = touched[i]
    const score = counts[idx] / T
    counts[idx] = 0 // reset for next call
    if (score >= threshold) scored.push({ idx, score, matchRank: computeMatchRank(idx, searchText) })
  }
  return finalize(index, scored, limit)
}

function finalize(index: TrigramIndex, scored: { idx: number; score: number; matchRank: number }[], limit: number): ThaiAddressRecord[] {
  scored.sort((a, b) => (b.score - a.score) || (b.matchRank - a.matchRank))
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

header('Correctness: typed-array variant vs current searchThaiAddress')
const QUERIES = ['bang rak', 'bang', 'ban', 'lat phrao', 'lardprao', 'ladkrabang', 'krungthep', 'chatuchak', 'ลาดพร้าว', 'ลาดพร', 'บางรัก', 'เชียงใหม่', 'นครราชสีมา', 'บาง', 'เมือง', '10500', '45000', 'xyzxyzxyz']
let allOk = true
for (const q of QUERIES) {
  const a = searchThaiAddress(index, q)
  const b = searchTypedHit(index, q)
  const ok = JSON.stringify(a.map(r => r.tambonId)) === JSON.stringify(b.map(r => r.tambonId))
  if (!ok) { allOk = false; console.log(`  MISMATCH "${q}": current=[${a.map(r => r.tambonId)}] typed=[${b.map(r => r.tambonId)}]`) }
}
console.log(`  all queries identical: ${allOk}`)

header('Latency: Map-hit counting vs typed-array counting (full search)')
for (const q of ['bang rak', 'bang', 'ban', 'lat phrao', 'krungthep', 'ลาดพร้าว', 'บาง', 'เมือง', 'เชียงใหม่']) {
  console.log(`  query="${q}"`)
  benchSync('    current (Map hits)', () => searchMapHit(index, q), { warmup: 200, samples: 2000 })
  benchSync('    typed-array hits', () => searchTypedHit(index, q), { warmup: 200, samples: 2000 })
}

header('Allocation rate (heap growth per 1000 searches, forced GC before/after)')
for (const q of ['bang rak', 'bang', 'ลาดพร้าว']) {
  forceGC()
  const before = process.memoryUsage().heapUsed
  for (let i = 0; i < 1000; i++) searchThaiAddress(index, q)
  const after = process.memoryUsage().heapUsed
  console.log(`  "${q}": ${(after - before) / 1000} bytes/search (pre-GC garbage; Map+scored+window+result arrays)`)
}
