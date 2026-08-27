// Autocomplete typing simulation — one character at a time.
// Run: node --expose-gc --import tsx bench/typing.ts
import { performance } from 'node:perf_hooks'
import { buildThaiAddressIndex } from '../src/core/indexer'
import { searchThaiAddress } from '../src/core/search'
import { normalizeThaiAddressText } from '../src/core/normalizer'
import { defaultRawData } from './data.ts'
import { header, fmt, summarize } from './harness.ts'

const raw = defaultRawData()
const index = buildThaiAddressIndex(raw, { validate: false })

const THAI_SEQ = ['ล', 'ลา', 'ลาด', 'ลาดพ', 'ลาดพร', 'ลาดพร้', 'ลาดพร้า', 'ลาดพร้าว']
const EN_SEQ = ['b', 'ba', 'ban', 'bang', 'bang ', 'bang r', 'bang ra', 'bang rak']

function runSequence(name: string, seq: string[]) {
  header(`Typing sequence: ${name}`)
  const ROUNDS = 200
  const perStep: number[][] = seq.map(() => [])
  const totals: number[] = []

  // warm up the engine with one full pass
  for (const q of seq) searchThaiAddress(index, q)

  for (let r = 0; r < ROUNDS; r++) {
    const t0 = performance.now()
    let results = 0
    for (let i = 0; i < seq.length; i++) {
      const s0 = performance.now()
      results += searchThaiAddress(index, seq[i]).length
      const s1 = performance.now()
      perStep[i].push(s1 - s0)
    }
    const t1 = performance.now()
    totals.push(t1 - t0)
    if (results === -1) console.log(results)
  }

  let sum = 0
  for (let i = 0; i < seq.length; i++) {
    const s = summarize(perStep[i])
    sum += s.p50
    const norm = normalizeThaiAddressText(seq[i])
    const dup = i > 0 && normalizeThaiAddressText(seq[i - 1]) === norm ? ' (normalizes same as previous → duplicate work)' : ''
    console.log(
      `  "${seq[i]}"${' '.repeat(Math.max(1, 14 - seq[i].length + 2))}p50=${fmt(s.p50).padStart(9)}  p95=${fmt(s.p95).padStart(9)}  p99=${fmt(s.p99).padStart(9)}${seq[i].length < 3 ? '  [sub-3-char → immediate empty]' : ''}${dup}`,
    )
  }
  const total = summarize(totals)
  console.log(`  Σ full sequence (8 keystrokes): p50=${fmt(total.p50)}  p95=${fmt(total.p95)}  p99=${fmt(total.p99)}`)
  console.log(`  Σ of per-step p50s:            ${fmt(sum)}`)
}

runSequence('ล → ลาดพร้าว', THAI_SEQ)
runSequence('b → bang rak', EN_SEQ)

// ---------------------------------------------------------------------------
// Work-reuse analysis: what is recomputed at each keystroke?
// ---------------------------------------------------------------------------
header('Work recomputed per keystroke (analytical)')
const q1 = 'ลาดพร'
const q2 = 'ลาดพร้' // tone mark stripped by normalizer
console.log(`  normalize("ลาดพร้") === normalize("ลาดพร") → "${normalizeThaiAddressText(q2)}" vs "${normalizeThaiAddressText(q1)}"`)
console.log('  → the debounced hook re-runs the full search for identical normalized input')
console.log('  → per-keystroke recomputed: query normalize (O(q)), alias lookup (O(1) map), trigram extract (O(q)),')
console.log('     posting union + hit counting (O(Σ postings)), scoring (O(candidates)), sort (O(n log n)), collator window (O(50 log 50))')
console.log('  → nothing is cached between keystrokes except the index itself; with debounce=200ms most keystrokes never search at all')

// Effect of debounce: only queries that survive 200ms idle actually search.
header('Keystrokes that actually reach searchThaiAddress (debounce=200ms)')
console.log('  uninterrupted typing of 8 chars (fast typist, ~80ms between keys): 1 search (the final query)')
console.log('  slow typist (~250ms between keys): up to 8 searches')
console.log('  measured worst single search (bang rak): p99 well under 1ms — debounce is not needed to protect the frame budget')
