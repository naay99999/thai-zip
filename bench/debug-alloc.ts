// Debug: why does typed-array variant differ from Map variant?
import { buildThaiAddressIndex } from '../src/core/indexer'
import { normalizeThaiAddressText } from '../src/core/normalizer'
import { extractTrigramsNormalized } from '../src/core/trigrams'
import { applyRomanizationAliases } from '../src/core/romanize'
import { defaultRawData } from './data.ts'

const raw = defaultRawData()
const index = buildThaiAddressIndex(raw, { validate: false })

const q = 'ลาดพร้าว'
const normalized = normalizeThaiAddressText(q)
const searchText = /[a-z]/i.test(normalized) ? applyRomanizationAliases(normalized) : normalized
const queryTrigrams = [...extractTrigramsNormalized(searchText)]
console.log('trigrams:', queryTrigrams)

// Map version
const hits = new Map<number, number>()
for (const trigram of queryTrigrams) {
  const candidates = index.map.get(trigram)
  if (!candidates) continue
  for (const idx of candidates) hits.set(idx, (hits.get(idx) ?? 0) + 1)
}
const mapOrder = [...hits.keys()]

// Typed version
const N = index.records.length
const counts = new Uint32Array(N)
const touched: number[] = []
for (const trigram of queryTrigrams) {
  const candidates = index.map.get(trigram)
  if (!candidates) continue
  for (const idx of candidates) {
    if (counts[idx] === 0) touched.push(idx)
    counts[idx]++
  }
}

console.log('map first-touch order == typed touched order?', JSON.stringify(mapOrder) === JSON.stringify(touched))
console.log('mapOrder :', mapOrder.slice(0, 12))
console.log('touched  :', touched.slice(0, 12))

// score comparison
let diff = 0
for (let i = 0; i < mapOrder.length; i++) {
  const idx = mapOrder[i]
  if (hits.get(idx) !== counts[idx]) diff++
}
console.log('count mismatches:', diff, 'of', mapOrder.length)

// Now: what are the top records by (score, matchRank)?
function rankAgainstName(name: string | undefined, query: string): number {
  if (name === undefined || name.length === 0) return 0
  if (name === query) return 3
  if (name.startsWith(query)) return 2
  if (name.includes(query)) return 1
  return 0
}
function computeMatchRank(idx: number): number {
  const th = rankAgainstName(index.normTambon?.[idx], searchText)
  if (th === 3) return 3
  const en = rankAgainstName(index.normTambonEn?.[idx], searchText)
  return en > th ? en : th
}
for (const idx of [103801, 103802]) {
  const rec = index.records.find(r => r.tambonId === idx)!
  const i = index.records.indexOf(rec)
  console.log(`record ${idx} (idx=${i}): score=${hits.get(i)}/${queryTrigrams.length} matchRank=${computeMatchRank(i)} th="${rec.tambonNameTh}" amphure="${rec.amphureNameTh}"`)
}
