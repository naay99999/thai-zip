// Precomputed-index prototype: ship the built index vs building at runtime.
// Run: node --expose-gc --import tsx bench/precompute.ts
import { gzipSync, brotliCompressSync } from 'node:zlib'
import { writeFileSync, statSync } from 'node:fs'
import { performance } from 'node:perf_hooks'
import { buildThaiAddressIndex } from '../src/core/indexer'
import { searchThaiAddress } from '../src/core/search'
import { defaultRawData } from './data.ts'
import { p, a, t } from '../src/data/defaultData'
import { header, benchSync, fmt, fmtBytes, forceGC, heapUsedAfterGC } from './harness.ts'
import type { TrigramIndex, ThaiAddressRecord } from '../src/types'

// ---------------------------------------------------------------------------
// Build the reference index once
// ---------------------------------------------------------------------------
const raw = defaultRawData()
const reference = buildThaiAddressIndex(raw, { validate: false })

// ---------------------------------------------------------------------------
// Artifact A: current shipped representation (compact tuples, as JSON)
// ---------------------------------------------------------------------------
const tuplesJson = JSON.stringify({ p, a, t })

// ---------------------------------------------------------------------------
// Artifact B: precomputed index (JSON-serializable)
// ---------------------------------------------------------------------------
type PackedIndex = {
  keys: string[]
  postings: number[][]
  records: (typeof reference.records[number] extends object ? any : never)[]
  zips: string[]
  zipPostings: number[][]
  normTambon: string[]
  normTambonEn: string[]
  provIds: number[]
  provGroups: number[][]
  ampIds: number[]
  ampGroups: number[][]
}

const packed: PackedIndex = {
  keys: [...reference.map.keys()],
  postings: [...reference.map.values()].map(s => [...s]),
  records: reference.records, // objects JSON-serialize fine
  zips: [...reference.zipIndex.keys()],
  zipPostings: [...reference.zipIndex.values()],
  normTambon: reference.normTambon,
  normTambonEn: reference.normTambonEn,
  provIds: [...reference.byProvince.keys()],
  provGroups: [...reference.byProvince.values()],
  ampIds: [...reference.byAmphure.keys()],
  ampGroups: [...reference.byAmphure.values()],
}
const packedJson = JSON.stringify(packed)

header('Artifact sizes (bytes)')
const gz = (b: Buffer | string) => gzipSync(Buffer.from(b)).length
const br = (b: Buffer | string) => brotliCompressSync(Buffer.from(b), { quality: 11 }).length
console.log(`  tuples JSON (current data):  raw=${fmtBytes(tuplesJson.length)}  gzip=${fmtBytes(gz(tuplesJson))}  brotli=${fmtBytes(br(tuplesJson))}`)
console.log(`  packed index JSON:           raw=${fmtBytes(packedJson.length)}  gzip=${fmtBytes(gz(packedJson))}  brotli=${fmtBytes(br(packedJson))}`)

// ---------------------------------------------------------------------------
// Reconstruction from packed JSON
// ---------------------------------------------------------------------------
function reconstructFromPacked(parsed: PackedIndex): TrigramIndex {
  const map = new Map<string, Set<number>>()
  for (let i = 0; i < parsed.keys.length; i++) map.set(parsed.keys[i], new Set(parsed.postings[i]))
  const zipIndex = new Map<string, number[]>()
  for (let i = 0; i < parsed.zips.length; i++) zipIndex.set(parsed.zips[i], parsed.zipPostings[i])
  const byProvince = new Map<number, number[]>()
  for (let i = 0; i < parsed.provIds.length; i++) byProvince.set(parsed.provIds[i], parsed.provGroups[i])
  const byAmphure = new Map<number, number[]>()
  for (let i = 0; i < parsed.ampIds.length; i++) byAmphure.set(parsed.ampIds[i], parsed.ampGroups[i])
  return {
    map,
    records: parsed.records,
    zipIndex,
    normTambon: parsed.normTambon,
    normTambonEn: parsed.normTambonEn,
    byProvince,
    byAmphure,
  }
}

header('Load-time comparison (per fresh load)')
// Current path: JSON.parse of tuples + RawData mapping + full build
benchSync('current: JSON.parse tuples', () => JSON.parse(tuplesJson), { warmup: 5, samples: 30 })
const parsedTuples = JSON.parse(tuplesJson)
benchSync('current: tuples->RawData + buildThaiAddressIndex', () => {
  const rawData = {
    provinces: parsedTuples.p.map(([id, name_th, name_en]: any) => ({ id, name_th, name_en, geography_id: 0, deleted_at: null })),
    amphures: parsedTuples.a.map(([id, name_th, name_en, province_id]: any) => ({ id, name_th, name_en, province_id, deleted_at: null })),
    tambons: parsedTuples.t.map(([id, name_th, name_en, amphure_id, zip_code]: any) => ({ id, name_th, name_en, amphure_id, zip_code, deleted_at: null })),
  }
  return buildThaiAddressIndex(rawData, { validate: false })
}, { warmup: 5, samples: 30 })

benchSync('precomputed: JSON.parse packed', () => JSON.parse(packedJson), { warmup: 5, samples: 30 })
const parsedPacked = JSON.parse(packedJson)
benchSync('precomputed: reconstruct Maps/Sets', () => reconstructFromPacked(parsedPacked), { warmup: 5, samples: 30 })

header('End-to-end load (parse + build/reconstruct), single pass timing')
for (let i = 0; i < 5; i++) {
  let t0 = performance.now()
  const pt = JSON.parse(tuplesJson)
  const rawData = {
    provinces: pt.p.map(([id, name_th, name_en]: any) => ({ id, name_th, name_en, geography_id: 0, deleted_at: null })),
    amphures: pt.a.map(([id, name_th, name_en, province_id]: any) => ({ id, name_th, name_en, province_id, deleted_at: null })),
    tambons: pt.t.map(([id, name_th, name_en, amphure_id, zip_code]: any) => ({ id, name_th, name_en, amphure_id, zip_code, deleted_at: null })),
  }
  const idx = buildThaiAddressIndex(rawData, { validate: false })
  const t1 = performance.now()
  const pp = JSON.parse(packedJson)
  const idx2 = reconstructFromPacked(pp)
  const t2 = performance.now()
  console.log(`  run ${i + 1}: current=${fmt(t1 - t0)}   precomputed=${fmt(t2 - t1)}   (records equal: ${idx.records.length === idx2.records.length})`)
}

header('Search speed on reconstructed index (should be identical structures)')
const reconstructed = reconstructFromPacked(JSON.parse(packedJson))
let ok = true
for (const q of ['bang rak', 'ลาดพร้าว', 'chatuchak', 'krungthep', '45000']) {
  const r1 = searchThaiAddress(reference, q).map(r => r.tambonId)
  const r2 = searchThaiAddress(reconstructed, q).map(r => r.tambonId)
  if (JSON.stringify(r1) !== JSON.stringify(r2)) ok = false
}
console.log(`  identical search results on rebuilt vs reconstructed: ${ok}`)
benchSync('search "bang rak" (reference-built)', () => searchThaiAddress(reference, 'bang rak'), { warmup: 100, samples: 1000 })
benchSync('search "bang rak" (reconstructed)', () => searchThaiAddress(reconstructed, 'bang rak'), { warmup: 100, samples: 1000 })

header('Memory after load (heapUsed delta, forced GC)')
forceGC()
const m0 = heapUsedAfterGC()
const idxCurrent = buildThaiAddressIndex(raw, { validate: false })
const m1 = heapUsedAfterGC()
const idxPre = reconstructFromPacked(JSON.parse(packedJson))
const m2 = heapUsedAfterGC()
console.log(`  current path:     ${fmtBytes(m1 - m0)}`)
console.log(`  precomputed path: ${fmtBytes(m2 - m1)}`)

// ---------------------------------------------------------------------------
// Variant C: flat typed-array postings (fastest possible reconstruction +
// iteration) — measures the ceiling of a representation change.
// ---------------------------------------------------------------------------
header('Variant: flat Uint32Array postings (representation ceiling)')
let totalPostings = 0
for (const s of reference.map.values()) totalPostings += s.size
const keys = [...reference.map.keys()]
const offsets = new Uint32Array(keys.length + 1)
const flat = new Uint32Array(totalPostings)
{
  let o = 0
  let i = 0
  for (const s of reference.map.values()) {
    for (const idx of s) flat[o++] = idx
    offsets[++i] = o
  }
}
console.log(`  flat postings: ${flat.byteLength} bytes + offsets ${offsets.byteLength} + ${keys.length} keys`)
// search via subarray views
const flatMap = new Map<string, Uint32Array>()
for (let i = 0; i < keys.length; i++) flatMap.set(keys[i], flat.subarray(offsets[i], offsets[i + 1]))
forceGC()
const m3 = heapUsedAfterGC()
console.log(`  flatMap retained heap: ${fmtBytes(m3 - m2)}`)

function searchFlat(query: string, limit = 10, threshold = 0.4) {
  const N = reference.records.length
  const counts = new Uint32Array(N)
  const touched: number[] = []
  const normalized = query // assume pre-normalized for this micro-test
  const grams = [...normalized].length >= 3 ? normalized : normalized
  // use extractTrigramsNormalized equivalent inline for fair timing
  const qgrams = new Set<string>()
  for (let i = 0; i <= grams.length - 3; i++) qgrams.add(grams.slice(i, i + 3))
  for (const g of qgrams) {
    const cands = flatMap.get(g)
    if (!cands) continue
    for (let i = 0; i < cands.length; i++) {
      const idx = cands[i]
      if (counts[idx] === 0) touched.push(idx)
      counts[idx]++
    }
  }
  return touched.length // just measure the counting core
}
benchSync('flat-array counting core (bang rak)', () => searchFlat('bang rak'), { warmup: 200, samples: 2000 })

// equivalent counting core with Set iteration for comparison
function countingCoreSet(query: string) {
  const hits = new Map<number, number>()
  const qgrams = new Set<string>()
  for (let i = 0; i <= query.length - 3; i++) qgrams.add(query.slice(i, i + 3))
  for (const g of qgrams) {
    const cands = reference.map.get(g)
    if (!cands) continue
    for (const idx of cands) hits.set(idx, (hits.get(idx) ?? 0) + 1)
  }
  return hits.size
}
benchSync('Set-iteration counting core (bang rak)', () => countingCoreSet('bang rak'), { warmup: 200, samples: 2000 })
