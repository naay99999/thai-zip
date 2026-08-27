// Fine-grained search phase instrumentation — splits searchThaiAddress internals.
// Run: node --expose-gc --import tsx bench/search-phases.ts
import { hrtime } from 'node:process'
import { buildThaiAddressIndex } from '../src/core/indexer'
import { normalizeThaiAddressText } from '../src/core/normalizer'
import { extractTrigramsNormalized } from '../src/core/trigrams'
import { applyRomanizationAliases } from '../src/core/romanize'
import { defaultRawData } from './data.ts'
import { header, fmt } from './harness.ts'

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

const phases = {
  normalize: 0,
  alias: 0,
  trigrams: 0,
  hitAccumulate: 0,
  scoreMatchRank: 0,
  presort: 0,
  collatorWindow: 0,
  materialize: 0,
}

function instrumentedSearch(query: string, limit = 10, threshold = 0.4) {
  let t0 = hrtime.bigint()
  const normalized = normalizeThaiAddressText(query)
  const searchText = /[a-z]/i.test(normalized) ? applyRomanizationAliases(normalized) : normalized
  let t1 = hrtime.bigint(); phases.normalize += Number(t1 - t0) / 1e6; t0 = t1

  const queryTrigrams = extractTrigramsNormalized(searchText)
  t1 = hrtime.bigint(); phases.trigrams += Number(t1 - t0) / 1e6; t0 = t1

  const hits = new Map<number, number>()
  for (const trigram of queryTrigrams) {
    const candidates = index.map.get(trigram)
    if (!candidates) continue
    for (const idx of candidates) {
      hits.set(idx, (hits.get(idx) ?? 0) + 1)
    }
  }
  t1 = hrtime.bigint(); phases.hitAccumulate += Number(t1 - t0) / 1e6; t0 = t1

  const scored: { idx: number; score: number; matchRank: number }[] = []
  for (const [idx, count] of hits) {
    const score = count / queryTrigrams.size
    if (score >= threshold) {
      scored.push({ idx, score, matchRank: computeMatchRank(idx, searchText) })
    }
  }
  t1 = hrtime.bigint(); phases.scoreMatchRank += Number(t1 - t0) / 1e6; t0 = t1

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return b.matchRank - a.matchRank
  })
  t1 = hrtime.bigint(); phases.presort += Number(t1 - t0) / 1e6; t0 = t1

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
  t1 = hrtime.bigint(); phases.collatorWindow += Number(t1 - t0) / 1e6; t0 = t1

  const out = window.slice(0, limit).map(({ idx }) => index.records[idx])
  t1 = hrtime.bigint(); phases.materialize += Number(t1 - t0) / 1e6
  return out
}

const QUERIES = ['bang rak', 'bang', 'ban', 'lat phrao', 'ladkrabang', 'krungthep', 'chatuchak', 'ลาดพร้าว', 'บางรัก', 'เชียงใหม่', 'นครราชสีมา', 'บาง', 'เมือง']

for (const q of QUERIES) {
  header(`Phase breakdown: "${q}" (avg of 300 runs)`)
  for (const k of Object.keys(phases) as (keyof typeof phases)[]) phases[k] = 0
  for (let i = 0; i < 305; i++) {
    const r = instrumentedSearch(q)
    if (i === 0 && r.length === -1) console.log(r)
  }
  const total = Object.values(phases).reduce((a, b) => a + b, 0)
  const order: (keyof typeof phases)[] = ['normalize', 'alias', 'trigrams', 'hitAccumulate', 'scoreMatchRank', 'presort', 'collatorWindow', 'materialize']
  for (const k of order) {
    if (phases[k] === 0) continue
    console.log(`  ${k.padEnd(16)} ${fmt(phases[k] / 300).padStart(10)}  ${(100 * phases[k] / total).toFixed(1).padStart(5)}%`)
  }
  console.log(`  ${'Σ'.padEnd(16)} ${fmt(total / 300).padStart(10)}`)
}
