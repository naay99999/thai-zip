// Candidate generation analysis: posting sizes, candidate counts per query.
// Run: node --expose-gc --import tsx bench/candidates.ts
import { buildThaiAddressIndex } from '../src/core/indexer'
import { normalizeThaiAddressText } from '../src/core/normalizer'
import { extractTrigramsNormalized } from '../src/core/trigrams'
import { applyRomanizationAliases } from '../src/core/romanize'
import { defaultRawData } from './data.ts'
import { header, fmt } from './harness.ts'

const raw = defaultRawData()
const index = buildThaiAddressIndex(raw, { validate: false })

// ---------------------------------------------------------------------------
// Global posting-list statistics
// ---------------------------------------------------------------------------
header('Inverted index statistics')
let totalPostings = 0
let maxPosting = 0
const sizes: number[] = []
for (const set of index.map.values()) {
  sizes.push(set.size)
  totalPostings += set.size
  if (set.size > maxPosting) maxPosting = set.size
}
sizes.sort((a, b) => a - b)
const pct = (p: number) => sizes[Math.floor((p / 100) * (sizes.length - 1))]
console.log(`  unique trigrams:      ${index.map.size}`)
console.log(`  total postings:       ${totalPostings}`)
console.log(`  posting size: min=${sizes[0]} p25=${pct(25)} median=${pct(50)} p75=${pct(75)} p95=${pct(95)} p99=${pct(99)} max=${maxPosting}`)

// top-10 largest postings
const top = [...index.map.entries()].sort((a, b) => b[1].size - a[1].size).slice(0, 15)
console.log(`  largest postings (trigram -> records):`)
for (const [tg, set] of top) {
  const isLatin = /[a-z]/.test(tg)
  console.log(`    ${JSON.stringify(tg).padEnd(10)} ${String(set.size).padStart(5)} records ${isLatin ? '(latin)' : ''}`)
}

// Latin vs Thai trigram split
let latinTrigrams = 0
let latinPostings = 0
let thaiPostings = 0
for (const [tg, set] of index.map) {
  if (/[a-z]/.test(tg)) {
    latinTrigrams++
    latinPostings += set.size
  } else thaiPostings += set.size
}
console.log(`  latin trigrams: ${latinTrigrams} (${latinPostings} postings), non-latin: ${index.map.size - latinTrigrams} (${thaiPostings} postings)`)

// ---------------------------------------------------------------------------
// Per-query candidate funnel
// ---------------------------------------------------------------------------
header('Per-query candidate funnel (union of postings -> scored -> returned)')

function funnel(query: string) {
  const normalized = normalizeThaiAddressText(query)
  if (normalized.length < 3) {
    console.log(`  ${query.padEnd(12)} — sub-3-char: returns [] immediately (no index access)`)
    return
  }
  const searchText = /[a-z]/i.test(normalized) ? applyRomanizationAliases(normalized) : normalized
  const qgrams = [...extractTrigramsNormalized(searchText)]
  const postings = qgrams.map(g => index.map.get(g)?.size ?? 0)
  const union = new Set<number>()
  for (const g of qgrams) {
    const cands = index.map.get(g)
    if (!cands) continue
    for (const idx of cands) union.add(idx)
  }
  // scored count at default threshold 0.4
  const T = qgrams.length
  const hits = new Map<number, number>()
  for (const g of qgrams) {
    const cands = index.map.get(g)
    if (!cands) continue
    for (const idx of cands) hits.set(idx, (hits.get(idx) ?? 0) + 1)
  }
  let scored = 0
  for (const [, c] of hits) if (c / T >= 0.4) scored++
  console.log(
    `  ${query.padEnd(14)} grams=${String(T).padStart(3)}  postings=[${postings.join(',')}]  union=${String(union.size).padStart(5)}  scored(≥0.4)=${String(scored).padStart(5)}  returned≤10`,
  )
}

const queries = [
  'ลาดพร้าว', 'ลาดพร', 'บางรัก', 'เชียงใหม่', 'นครราชสีมา', 'บาง', 'เมือง',
  'bang rak', 'chatuchak', 'lat phrao', 'lardprao', 'ladkrabang', 'krungthep', 'ban', 'bang',
  '10500', '45000',
]
for (const q of queries) funnel(q)

// ---------------------------------------------------------------------------
// Minimum-viable (3-char) query worst cases
// ---------------------------------------------------------------------------
header('3-char queries (minimum text-search length) — candidate counts')
const threeChar = ['บาง', 'เมือ', 'nong', 'ban', 'khan', 'pho', 'wat', 'mai', 'si ', 'bang']
for (const q of threeChar) funnel(q)

// 2-char zip prefix scan cost (zipIndex scan is O(n_zips) regardless)
header('Zip index statistics')
const zipSizes = [...index.zipIndex.values()].map(v => v.length).sort((a, b) => a - b)
const zpct = (p: number) => zipSizes[Math.floor((p / 100) * (zipSizes.length - 1))]
console.log(`  zip codes: ${zipSizes.length}`)
console.log(`  tambons per zip: min=${zipSizes[0]} p50=${zpct(50)} p95=${zpct(95)} max=${zipSizes[zipSizes.length - 1]}`)
const bigZips = [...index.zipIndex.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 8)
console.log(`  biggest fan-out: ${bigZips.map(([z, v]) => `${z}→${v.length}`).join(', ')}`)
console.log(`  zips with >10 tambons: ${zipSizes.filter(s => s > 10).length} / ${zipSizes.length}`)
