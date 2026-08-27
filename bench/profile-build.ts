// CPU profile runner — index build workload.
// Run: node --cpu-prof --cpu-prof-dir=bench/.profiles --cpu-prof-name=build.cpuprofile --import tsx bench/profile-build.ts
import { buildThaiAddressIndex } from '../src/core/indexer'
import { defaultRawData } from './data.ts'

const raw = defaultRawData()
const t0 = performance.now()
let n = 0
while (performance.now() - t0 < 3000) {
  const idx = buildThaiAddressIndex(raw, { validate: false })
  if (idx.records.length === 0) throw new Error('bad')
  n++
}
console.log(`profile-build done: ${n} builds`)
