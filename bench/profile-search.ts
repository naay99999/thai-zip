// CPU profile runner — mixed search workload.
// Run: node --cpu-prof --cpu-prof-dir=bench/.profiles --cpu-prof-name=search.cpuprofile --import tsx bench/profile-search.ts
import { buildThaiAddressIndex } from '../src/core/indexer'
import { searchThaiAddress } from '../src/core/search'
import { formatThaiAddressSuggestion } from '../src/core/formatter'
import { defaultRawData } from './data.ts'

const raw = defaultRawData()
const index = buildThaiAddressIndex(raw, { validate: false })

// Mixed workload weighted like a real autocomplete session:
// heavy English queries (worst case), common Thai, zip, misses.
const WORKLOAD: [string, number][] = [
  ['bang rak', 3],
  ['bang', 2],
  ['ban', 2],
  ['lat phrao', 2],
  ['lardprao', 2],
  ['ladkrabang', 2],
  ['krungthep', 2],
  ['chatuchak', 2],
  ['ลาดพร้าว', 3],
  ['ลาดพร', 2],
  ['บางรัก', 2],
  ['บาง', 2],
  ['เชียงใหม่', 2],
  ['นครราชสีมา', 2],
  ['เมือง', 2],
  ['10500', 2],
  ['45000', 2],
  ['450', 2],
  ['xyzxyzxyz', 1],
]

let sink = 0
const t0 = performance.now()
let iter = 0
// ~3 seconds of work
while (performance.now() - t0 < 3000) {
  for (const [q, w] of WORKLOAD) {
    for (let i = 0; i < w; i++) {
      const res = searchThaiAddress(index, q)
      sink += res.length
      // include formatter cost (the React hook formats every result)
      if (iter % 3 === 0) for (const r of res) sink += formatThaiAddressSuggestion(r).id.length
    }
  }
  iter++
}
console.log(`profile-search done: ${iter} workload passes, sink=${sink}`)
