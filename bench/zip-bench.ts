// Postal-code lookup benchmark + prototype (sorted keys + binary-search prefix range).
// Run: node --expose-gc --import tsx bench/zip-bench.ts
import { buildThaiAddressIndex } from '../src/core/indexer'
import { lookupByZipCode } from '../src/core/search'
import { defaultRawData } from './data.ts'
import { header, benchSync, fmt } from './harness.ts'
import type { ThaiAddressRecord } from '../src/types'

const raw = defaultRawData()
const index = buildThaiAddressIndex(raw, { validate: false })

// --- Prototype: sorted zip keys + binary search for prefix ranges -----------
const sortedZips = [...index.zipIndex.keys()].sort() // 953 keys, lexical == numeric (fixed width)
const zipPostings = sortedZips.map(z => index.zipIndex.get(z)!)

/** lower_bound: first index whose key >= prefix */
function lowerBound(prefix: string): number {
  let lo = 0
  let hi = sortedZips.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (sortedZips[mid] < prefix) lo = mid + 1
    else hi = mid
  }
  return lo
}

function prototypeLookup(prefix: string, zipLimit = Infinity): ThaiAddressRecord[] {
  if (prefix.length < 2) return []
  const matches: ThaiAddressRecord[] = []
  let i = lowerBound(prefix)
  // iterate while key startsWith prefix — ascending key order
  while (i < sortedZips.length && sortedZips[i].startsWith(prefix)) {
    for (const idx of zipPostings[i]) matches.push(index.records[idx])
    i++
  }
  // exact match sorts before any other prefix match automatically (equal string < longer string)
  return zipLimit === Infinity ? matches : matches.slice(0, zipLimit)
}

header('Correctness: prototype vs current implementation')
let allOk = true
for (const z of ['10500', '45000', '450', '10', '50', '11', '1', '99', '9', '89', '8', '44', '444', '44444', '00000']) {
  const a = lookupByZipCode(index, z)
  const b = prototypeLookup(z)
  const ok = JSON.stringify(a.map(r => r.tambonId)) === JSON.stringify(b.map(r => r.tambonId))
  if (!ok) allOk = false
  console.log(`  zip="${z.padEnd(5)}"  n=${String(a.length).padStart(3)}  identical=${ok}`)
}
console.log(`  → all identical: ${allOk}`)

header('Latency: current O(n_zips) scan vs binary-search prototype')
for (const z of ['10500', '45000', '450', '10', '50', '11', '44']) {
  console.log(`  zip="${z}"`)
  benchSync('    current full scan', () => lookupByZipCode(index, z), { warmup: 300, samples: 3000 })
  benchSync('    sorted+binary search', () => prototypeLookup(z), { warmup: 300, samples: 3000 })
}

header('Prefix fan-out (how many zips match a prefix)')
for (const z of ['1', '10', '105', '1050', '10500', '45', '450', '4500', '45000', '4', '44']) {
  if (z.length < 2) { console.log(`  prefix "${z}": rejected (<2 digits)`); continue }
  let count = 0
  let tambons = 0
  let i = lowerBound(z)
  while (i < sortedZips.length && sortedZips[i].startsWith(z)) {
    tambons += zipPostings[i].length
    count++
    i++
  }
  console.log(`  prefix "${z}": ${count} zip codes, ${tambons} tambons`)
}
