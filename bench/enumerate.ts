// Enumeration API + cold first-call latency.
// Run: node --expose-gc --import tsx bench/enumerate.ts
import { buildThaiAddressIndex } from '../src/core/indexer'
import { listProvinces, listAmphures, listTambons } from '../src/core/enumerate'
import { searchThaiAddress } from '../src/core/search'
import { defaultRawData } from './data.ts'
import { header, benchSync, fmt } from './harness.ts'

const raw = defaultRawData()
const index = buildThaiAddressIndex(raw, { validate: false })

header('Enumeration API (cascade selects)')
benchSync('listProvinces()', () => listProvinces(index), { warmup: 100, samples: 2000 })
console.log(`      → ${listProvinces(index).length} provinces`)

// largest province by tambon count
const provSizes = [...index.byProvince.entries()].map(([id, v]) => [id, v.length] as const).sort((a, b) => b[1] - a[1])
console.log(`  biggest province (tambons): ${provSizes[0][0]} → ${provSizes[0][1]}`)
benchSync('listAmphures(bangkok)', () => listAmphures(index, provSizes[0][0]), { warmup: 100, samples: 2000 })
const bangkokAmphures = listAmphures(index, provSizes[0][0])
console.log(`      → ${bangkokAmphures.length} amphures`)

const ampSizes = [...index.byAmphure.entries()].map(([id, v]) => [id, v.length] as const).sort((a, b) => b[1] - a[1])
console.log(`  biggest amphure (tambons): ${ampSizes[0][0]} → ${ampSizes[0][1]}`)
benchSync('listTambons(biggest amphure)', () => listTambons(index, ampSizes[0][0]), { warmup: 100, samples: 2000 })
console.log(`      → ${listTambons(index, ampSizes[0][0]).length} tambons`)

// full cascade drill-down (province -> amphures -> tambons for first amphure)
benchSync('full cascade drill-down', () => {
  const provinces = listProvinces(index)
  const amphures = listAmphures(index, provinces[0].id)
  return listTambons(index, amphures[0].id)
}, { warmup: 100, samples: 2000 })

header('Complexity notes')
console.log('  listProvinces:  O(P·log P) sort, P=77 — builds 77 summary objects per call, not cached')
console.log('  listAmphures:   O(k + A·log A) where k = tambons in province — builds A summary objects per call')
console.log('  listTambons:    O(T·log T) where T = tambons in amphure — builds T objects per call')
console.log('  → all called once per dropdown open (not per keystroke); costs are µs-scale')

header('Cold first-call latency (fresh subprocess, first search after import)')
import { execFileSync } from 'node:child_process'
const script = `
const { buildThaiAddressIndex } = await import('./src/core/indexer')
const { searchThaiAddress } = await import('./src/core/search')
const { defaultRawData } = await import('./bench/data.ts')
const index = buildThaiAddressIndex(await defaultRawData(), { validate: false })
const t0 = performance.now()
const r = searchThaiAddress(index, process.argv[1])
const t1 = performance.now()
console.log(JSON.stringify({ query: process.argv[1], firstMs: t1 - t0, n: r.length }))
`
for (const q of ['ลาดพร้าว', 'bang rak', '10500', 'bang']) {
  const runs: number[] = []
  for (let i = 0; i < 7; i++) {
    const out = execFileSync('node', ['--import', 'tsx', '-e', script, q], {
      cwd: process.cwd(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    })
    runs.push(JSON.parse(out.trim().split('\n').pop()!).firstMs)
  }
  runs.sort((a, b) => a - b)
  const median = runs[Math.floor(runs.length / 2)]
  console.log(`  first call "${q}": median=${fmt(median)}  min=${fmt(runs[0])}  max=${fmt(runs[runs.length - 1])}  (7 fresh processes)`)
}
