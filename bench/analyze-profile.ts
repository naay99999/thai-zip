// .cpuprofile analyzer — aggregates self time per function.
// Run: node --import tsx bench/analyze-profile.ts bench/.profiles/search.cpuprofile
import { readFileSync } from 'node:fs'

type ProfileNode = {
  id: number
  callFrame: { functionName: string; url?: string; lineNumber?: number }
  hitCount?: number
  children?: number[]
}

const file = process.argv[2]
const profile = JSON.parse(readFileSync(file, 'utf8')) as {
  nodes: ProfileNode[]
  samples?: number[]
  timeDeltas?: number[]
  startTime: number
  endTime: number
}

const byId = new Map<number, ProfileNode>()
for (const n of profile.nodes) byId.set(n.id, n)

// If samples/timeDeltas exist, compute per-node time precisely; otherwise use hitCount × interval.
const totalDurationUs = profile.endTime - profile.startTime
const hasSamples = profile.samples?.length && profile.timeDeltas?.length

const selfUs = new Map<number, number>()
if (hasSamples) {
  for (let i = 0; i < profile.samples!.length; i++) {
    const id = profile.samples![i]
    const dt = profile.timeDeltas![i]
    if (dt > 0) selfUs.set(id, (selfUs.get(id) ?? 0) + dt)
  }
} else {
  const interval = totalDurationUs / (profile.nodes.reduce((a, n) => a + (n.hitCount ?? 0), 0) || 1)
  for (const n of profile.nodes) selfUs.set(n.id, (n.hitCount ?? 0) * interval)
}

// Aggregate per functionName (dedupe by name across urls)
const perFn = new Map<string, number>()
let totalUs = 0
for (const [id, us] of selfUs) {
  const node = byId.get(id)
  if (!node) continue
  // Ignore idle GC roots / program nodes that carry no function name context
  let name = node.callFrame.functionName
  if (!name) {
    // identify anonymous functions by file:line
    const url = (node.callFrame.url ?? '').replace(/^.*\/thai-zip\//, '')
    name = `(anon @ ${url}:${(node.callFrame.lineNumber ?? 0) + 1})`
  }
  totalUs += us
  perFn.set(name, (perFn.get(name) ?? 0) + us)
}

console.log(`profile: ${file}`)
console.log(`total sampled: ${(totalUs / 1000).toFixed(1)} ms\n`)
const rows = [...perFn.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40)
for (const [name, us] of rows) {
  console.log(`  ${(100 * us / totalUs).toFixed(1).padStart(5)}%  ${(us / 1000).toFixed(1).padStart(8)} ms  ${name}`)
}

// Also aggregate by category using the call tree: attribute self time of each node
// to the top-level phase it runs under (searchThaiAddress / buildThaiAddressIndex).
console.log('\n--- by ancestor phase ---')
function ancestorsOf(id: number): string[] {
  // build parent map lazily
  const chain: string[] = []
  let cur = byId.get(id)
  const guard = new Set<number>()
  while (cur && !guard.has(cur.id)) {
    guard.add(cur.id)
    chain.push(cur.callFrame.functionName || '(anonymous)')
    cur = byId.get(parentOf.get(cur.id) ?? -1)
  }
  return chain
}
const parentOf = new Map<number, number>()
for (const n of profile.nodes) for (const c of n.children ?? []) parentOf.set(c, n.id)

const PHASES = [
  'searchThaiAddress',
  'lookupByZipCode',
  'buildThaiAddressIndex',
  'formatThaiAddressSuggestion',
  'validateRawData',
]
const perPhase = new Map<string, number>()
for (const [id, us] of selfUs) {
  const node = byId.get(id)
  if (!node) continue
  const chain = ancestorsOf(id)
  const phase = PHASES.find(p => chain.includes(p))
  if (phase) perPhase.set(phase, (perPhase.get(phase) ?? 0) + us)
  else perPhase.set('(other/GC)', (perPhase.get('(other/GC)') ?? 0) + us)
}
for (const [name, us] of [...perPhase.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${(100 * us / totalUs).toFixed(1).padStart(5)}%  ${(us / 1000).toFixed(1).padStart(8)} ms  ${name}`)
}
