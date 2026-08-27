// Index initialization benchmark: cold/warm build, phase breakdown, memory.
// Run: node --expose-gc --import tsx bench/init.ts
import { hrtime } from 'node:process'
import { buildThaiAddressIndex, validateRawData } from '../src/core/indexer'
import { normalizeThaiAddressText } from '../src/core/normalizer'
import { extractTrigrams, extractTrigramsNormalized } from '../src/core/trigrams'
import { defaultRawData, datasetCounts } from './data.ts'
import { header, benchSync, benchTotal, summarize, fmt, fmtBytes, forceGC, heapUsedAfterGC } from './harness.ts'

console.log(`dataset: ${datasetCounts.provinces} provinces, ${datasetCounts.amphures} amphures, ${datasetCounts.tambons} tambons`)

// ---------------------------------------------------------------------------
// 1. Warm full-build latency (JIT warmed, fresh index each call)
// ---------------------------------------------------------------------------
header('1. buildThaiAddressIndex — warm, repeated fresh builds')
const raw = defaultRawData()
const buildSummary = benchSync('buildThaiAddressIndex(raw)', () => buildThaiAddressIndex(raw, { validate: false }), {
  warmup: 20,
  samples: 100,
})
benchSync('buildThaiAddressIndex + validate', () => buildThaiAddressIndex(raw), { warmup: 20, samples: 100 })

// ---------------------------------------------------------------------------
// 2. Sub-component costs in isolation
// ---------------------------------------------------------------------------
header('2. Loader / validation sub-costs')
benchSync('tuple -> RawData mapping (loader)', () => defaultRawData(), { warmup: 20, samples: 100 })
benchSync('validateRawData(raw)', () => validateRawData(raw), { warmup: 20, samples: 200 })

// ---------------------------------------------------------------------------
// 3. Phase-instrumented build (instrumented copy of indexer.ts logic)
// ---------------------------------------------------------------------------
header('3. Phase breakdown (instrumented copy of buildThaiAddressIndex)')

type Phase = { name: string; ns: bigint }

function instrumentedBuild(data: RawData): { phases: Phase[] } {
  const phases: Phase[] = []
  const mark = (name: string, fn: () => void) => {
    const t0 = hrtime.bigint()
    fn()
    phases.push({ name, ns: hrtime.bigint() - t0 })
  }

  const { provinces, amphures, tambons } = data

  let provMap: Map<number, any>
  let ampMap: Map<number, any>
  mark('provMap/ampMap construction', () => {
    provMap = new Map(provinces.filter(p => !p.deleted_at).map(p => [p.id, p]))
    ampMap = new Map(amphures.filter(a => !a.deleted_at).map(a => [a.id, a]))
  })

  const provTrigrams = new Map<number, Set<string>>()
  const ampTrigrams = new Map<number, Set<string>>()
  mark('parent trigram precompute (norm+grams)', () => {
    for (const [id, prov] of provMap!) provTrigrams.set(id, combinedTrigrams(prov.name_th, prov.name_en))
    for (const [id, amp] of ampMap!) ampTrigrams.set(id, combinedTrigrams(amp.name_th, amp.name_en))
  })

  const records: any[] = []
  const map = new Map<string, Set<number>>()
  const zipIndex = new Map<string, number[]>()
  const normTambon: string[] = []
  const normTambonEn: string[] = []
  const byProvince = new Map<number, number[]>()
  const byAmphure = new Map<number, number[]>()

  let recordNs = 0n
  let zipNs = 0n
  let groupingNs = 0n
  let tambonNormNs = 0n
  let tambonTrigramNs = 0n
  let zipTrigramNs = 0n
  let parentAddNs = 0n

  for (const tambon of tambons) {
    if (tambon.deleted_at) continue
    const amphure = ampMap!.get(tambon.amphure_id)
    if (!amphure) continue
    const province = provMap!.get(amphure.province_id)
    if (!province) continue

    let t0 = hrtime.bigint()
    const record = {
      provinceId: province.id,
      provinceNameTh: province.name_th,
      provinceNameEn: province.name_en,
      amphureId: amphure.id,
      amphureNameTh: amphure.name_th,
      amphureNameEn: amphure.name_en,
      tambonId: tambon.id,
      tambonNameTh: tambon.name_th,
      tambonNameEn: tambon.name_en,
      zipCode: String(tambon.zip_code),
    }
    const idx = records.length
    records.push(record)
    let t1 = hrtime.bigint(); recordNs += t1 - t0

    t0 = hrtime.bigint()
    const existing = zipIndex.get(record.zipCode)
    if (existing) existing.push(idx)
    else zipIndex.set(record.zipCode, [idx])
    t1 = hrtime.bigint(); zipNs += t1 - t0

    t0 = hrtime.bigint()
    const provList = byProvince.get(province.id)
    if (provList) provList.push(idx)
    else byProvince.set(province.id, [idx])
    const ampList = byAmphure.get(amphure.id)
    if (ampList) ampList.push(idx)
    else byAmphure.set(amphure.id, [idx])
    t1 = hrtime.bigint(); groupingNs += t1 - t0

    t0 = hrtime.bigint()
    const normTh = normalizeThaiAddressText(record.tambonNameTh)
    normTambon.push(normTh)
    const normEn = normalizeThaiAddressText(record.tambonNameEn)
    normTambonEn.push(normEn)
    t1 = hrtime.bigint(); tambonNormNs += t1 - t0

    t0 = hrtime.bigint()
    addTrigrams(map, extractTrigramsNormalized(normTh), idx)
    addTrigrams(map, extractTrigramsNormalized(normEn), idx)
    t1 = hrtime.bigint(); tambonTrigramNs += t1 - t0

    t0 = hrtime.bigint()
    addTrigrams(map, extractTrigrams(record.zipCode), idx)
    t1 = hrtime.bigint(); zipTrigramNs += t1 - t0

    t0 = hrtime.bigint()
    addTrigrams(map, provTrigrams.get(province.id)!, idx)
    addTrigrams(map, ampTrigrams.get(amphure.id)!, idx)
    t1 = hrtime.bigint(); parentAddNs += t1 - t0
  }

  phases.push({ name: 'record object construction', ns: recordNs })
  phases.push({ name: 'zipIndex update', ns: zipNs })
  phases.push({ name: 'byProvince/byAmphure grouping', ns: groupingNs })
  phases.push({ name: 'tambon normalize (th+en)', ns: tambonNormNs })
  phases.push({ name: 'tambon trigram add (th+en)', ns: tambonTrigramNs })
  phases.push({ name: 'zip trigram add', ns: zipTrigramNs })
  phases.push({ name: 'parent trigram add (prov+amp)', ns: parentAddNs })
  return { phases }
}

function combinedTrigrams(nameTh: string, nameEn: string): Set<string> {
  const s = new Set<string>()
  for (const tg of extractTrigrams(nameTh)) s.add(tg)
  for (const tg of extractTrigrams(nameEn)) s.add(tg)
  return s
}

function addTrigrams(map: Map<string, Set<number>>, trigrams: Set<string>, idx: number): void {
  for (const trigram of trigrams) {
    let set = map.get(trigram)
    if (!set) {
      set = new Set()
      map.set(trigram, set)
    }
    set.add(idx)
  }
}

// Run instrumented build several times, average the phase numbers
const RUNS = 30
const totals = new Map<string, number>()
for (let i = 0; i < RUNS + 5; i++) {
  const { phases } = instrumentedBuild(raw)
  if (i < 5) continue // discard warmup
  for (const ph of phases) totals.set(ph.name, (totals.get(ph.name) ?? 0) + Number(ph.ns) / 1e6)
}
const phaseRows = [...totals.entries()].map(([name, totalMs]) => ({ name, ms: totalMs / RUNS })).sort((a, b) => b.ms - a.ms)
const phaseSum = phaseRows.reduce((a, b) => a + b.ms, 0)
for (const { name, ms } of phaseRows) {
  console.log(`  ${name.padEnd(38)} ${fmt(ms).padStart(10)}  ${(100 * ms / phaseSum).toFixed(1).padStart(5)}%`)
}
console.log(`  ${'Σ phases'.padEnd(38)} ${fmt(phaseSum).padStart(10)}   (vs warm full-build p50 ${fmt(buildSummary.p50)})`)

// ---------------------------------------------------------------------------
// 4. Memory retained by the index
// ---------------------------------------------------------------------------
header('4. Index memory (heapUsed delta, forced GC)')
forceGC()
const before = heapUsedAfterGC()
const index = buildThaiAddressIndex(raw, { validate: false })
const after = heapUsedAfterGC()
console.log(`  index retained heap ≈ ${fmtBytes(after - before)}`)
forceGC()
const afterSettle = heapUsedAfterGC()
console.log(`  after settle          ≈ ${fmtBytes(afterSettle - before)}`)

// Structural stats
let totalPostings = 0
let maxPosting = 0
let sumSq = 0
for (const set of index.map.values()) {
  totalPostings += set.size
  if (set.size > maxPosting) maxPosting = set.size
  sumSq += set.size * set.size
}
const numTrigrams = index.map.size
console.log(`  records=${index.records.length}  uniqueTrigrams=${numTrigrams}  totalPostings=${totalPostings}`)
console.log(`  avg posting=${(totalPostings / numTrigrams).toFixed(1)}  max posting=${maxPosting}`)
console.log(`  zipIndex entries=${index.zipIndex.size}  byProvince=${index.byProvince.size}  byAmphure=${index.byAmphure.size}`)

// Approximate JS-heap bytes per posting (Set entry ≈ 16-24B) for context
console.log(`  postings per record avg=${(totalPostings / index.records.length).toFixed(1)}`)

// ---------------------------------------------------------------------------
// 5. loadDefaultIndex cold — fresh subprocess (module parse + tuple map + build)
// ---------------------------------------------------------------------------
header('5. loadDefaultIndex cold (fresh subprocess) + warm')
import { execFileSync } from 'node:child_process'
const coldScript = `
const t0 = performance.now()
const { loadDefaultIndex } = await import('./src/data/loader.ts')
const idx = await loadDefaultIndex()
const t1 = performance.now()
console.log(JSON.stringify({ coldMs: t1 - t0, records: idx.records.length }))
`
for (let i = 0; i < 5; i++) {
  const out = execFileSync('node', ['--expose-gc', '--import', 'tsx', '-e', coldScript], {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  })
  const parsed = JSON.parse(out.trim().split('\n').pop()!)
  console.log(`  run ${i + 1}: cold loadDefaultIndex = ${fmt(parsed.coldMs)}  (records=${parsed.records})`)
}

// Warm path: loadDefaultIndex called again returns cached promise synchronously-ish
console.log('\n  (warm cached call is a resolved-promise await — sub-microsecond; measured in bench/search via direct index reuse)')

// ---------------------------------------------------------------------------
// 6. Module parse cost of defaultData.ts alone
// ---------------------------------------------------------------------------
header('6. defaultData.ts module parse (fresh subprocess)')
for (let i = 0; i < 3; i++) {
  const out = execFileSync(
    'node',
    ['--import', 'tsx', '-e', `const t0=performance.now(); const m = await import('./src/data/defaultData.ts'); const t1=performance.now(); console.log(JSON.stringify({parseMs: t1-t0, t: m.t.length}))`],
    { cwd: process.cwd(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
  )
  const parsed = JSON.parse(out.trim().split('\n').pop()!)
  console.log(`  run ${i + 1}: parse+eval defaultData = ${fmt(parsed.parseMs)}  (t=${parsed.t})`)
}

// ---------------------------------------------------------------------------
// 7. Individual primitive costs (per-call)
// ---------------------------------------------------------------------------
header('7. Primitive costs')
const sampleName = raw.tambons[0].name_th
const sampleEn = raw.tambons[0].name_en
benchSync('normalizeThaiAddressText (th)', () => normalizeThaiAddressText(sampleName), { warmup: 1000 })
benchSync('normalizeThaiAddressText (en)', () => normalizeThaiAddressText(sampleEn), { warmup: 1000 })
const normTh = normalizeThaiAddressText(sampleName)
benchSync('extractTrigramsNormalized (th name)', () => extractTrigramsNormalized(normTh), { warmup: 1000 })
console.log(`\nsamples: tambon th="${sampleName}" en="${sampleEn}"`)
