import { performance } from 'node:perf_hooks'

export type Summary = {
  n: number
  min: number
  p50: number
  p75: number
  p95: number
  p99: number
  max: number
  mean: number
  stddev: number
  opsPerSec: number
}

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))
  return sorted[idx]
}

export function summarize(samplesMs: number[]): Summary {
  const sorted = [...samplesMs].sort((a, b) => a - b)
  const n = sorted.length
  const min = sorted[0]
  const max = sorted[n - 1]
  const p50 = percentile(sorted, 50)
  const p75 = percentile(sorted, 75)
  const p95 = percentile(sorted, 95)
  const p99 = percentile(sorted, 99)
  const mean = sorted.reduce((a, b) => a + b, 0) / n
  const variance = sorted.reduce((a, b) => a + (b - mean) ** 2, 0) / n
  return { n, min, p50, p75, p95, p99, max, mean, stddev: Math.sqrt(variance), opsPerSec: 1000 / mean }
}

/** Auto-scale milliseconds to a human-readable unit. */
export function fmt(x: number): string {
  if (x >= 1) return `${x.toFixed(2)} ms`
  if (x >= 0.001) return `${(x * 1000).toFixed(2)} µs`
  return `${(x * 1_000_000).toFixed(0)} ns`
}

export function fmtBytes(x: number): string {
  if (x >= 1024 * 1024) return `${(x / 1024 / 1024).toFixed(2)} MB`
  if (x >= 1024) return `${(x / 1024).toFixed(2)} KB`
  return `${x.toFixed(0)} B`
}

export function benchSync(
  name: string,
  fn: () => unknown,
  opts: { warmup?: number; samples?: number } = {},
): Summary {
  const warmup = opts.warmup ?? 300
  const samples = opts.samples ?? 2000
  for (let i = 0; i < warmup; i++) fn()
  const out: number[] = []
  out.length = samples
  for (let i = 0; i < samples; i++) {
    const t0 = performance.now()
    fn()
    const t1 = performance.now()
    out[i] = t1 - t0
  }
  const s = summarize(out)
  console.log(
    `  ${name.padEnd(34)} p50=${fmt(s.p50).padStart(10)}  p95=${fmt(s.p95).padStart(10)}  p99=${fmt(s.p99).padStart(10)}  min=${fmt(s.min).padStart(10)}  max=${fmt(s.max).padStart(10)}  ops/s=${s.opsPerSec.toFixed(0).padStart(8)}`,
  )
  return s
}

/** Total-time benchmark (fewer, longer ops) — measures aggregate wall time. */
export function benchTotal(name: string, fn: () => unknown, iterations: number, warmup = 3): Summary {
  for (let i = 0; i < warmup; i++) fn()
  const out: number[] = []
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now()
    fn()
    const t1 = performance.now()
    out.push(t1 - t0)
  }
  return summarize(out)
}

export function forceGC(): boolean {
  if (typeof globalThis.gc !== 'function') return false
  globalThis.gc()
  globalThis.gc()
  return true
}

/** Heap used (bytes) after forcing GC. Requires --expose-gc. */
export function heapUsedAfterGC(): number {
  forceGC()
  return process.memoryUsage().heapUsed
}

export function header(title: string): void {
  console.log(`\n=== ${title} ===`)
}
