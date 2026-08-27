// Sorting strategy benchmark on real candidate sets.
// Run: node --expose-gc --import tsx bench/sort-bench.ts
import { buildThaiAddressIndex } from '../src/core/indexer'
import { searchThaiAddress } from '../src/core/search'
import { normalizeThaiAddressText } from '../src/core/normalizer'
import { extractTrigramsNormalized } from '../src/core/trigrams'
import { applyRomanizationAliases } from '../src/core/romanize'
import { defaultRawData } from './data.ts'
import { header, benchSync, fmt } from './harness.ts'

const raw = defaultRawData()
const index = buildThaiAddressIndex(raw, { validate: false })

function rankAgainstName(name: string | undefined, query: string): number {
  if (name === undefined || name.length === 0) return 0
  if (name === query) return 3
  if (name.startsWith(query)) return 2
  if (name.includes(query)) return 1
  return 0
}
function computeMatchRank(idx: number, query: string): number {
  const th = rankAgainstName(index.normTambon?.[idx], query)
  if (th === 3) return 3
  const en = rankAgainstName(index.normTambonEn?.[idx], query)
  return en > th ? en : th
}

type Scored = { idx: number; score: number; matchRank: number }

/** Build the real scored array for a query (same logic as search.ts). */
function buildScored(query: string, threshold = 0.4): { scored: Scored[]; searchText: string } {
  const normalized = normalizeThaiAddressText(query)
  const searchText = /[a-z]/i.test(normalized) ? applyRomanizationAliases(normalized) : normalized
  const queryTrigrams = extractTrigramsNormalized(searchText)
  const hits = new Map<number, number>()
  for (const trigram of queryTrigrams) {
    const candidates = index.map.get(trigram)
    if (!candidates) continue
    for (const idx of candidates) hits.set(idx, (hits.get(idx) ?? 0) + 1)
  }
  const scored: Scored[] = []
  for (const [idx, count] of hits) {
    const score = count / queryTrigrams.size
    if (score >= threshold) scored.push({ idx, score, matchRank: computeMatchRank(idx, searchText) })
  }
  return { scored, searchText }
}

// --- Alternative 1: bounded top-K insertion (keeps best W items only) -------
function topKByInsertion(scored: Scored[], W: number): Scored[] {
  // Manual insertion into a bounded array, ordered by (score desc, matchRank desc).
  const best: Scored[] = []
  let worstIdx = 0
  for (let i = 0; i < scored.length; i++) {
    const cand = scored[i]
    if (best.length >= W) {
      const worst = best[best.length - 1]
      if (cand.score < worst.score || (cand.score === worst.score && cand.matchRank <= worst.matchRank)) continue
      // replace worst (last slot), then bubble down
      best[best.length - 1] = cand
      let j = best.length - 1
      while (j > 0) {
        const prev = best[j - 1]
        if (prev.score > cand.score || (prev.score === cand.score && prev.matchRank > cand.matchRank)) break
        best[j] = prev
        best[j - 1] = cand
        j--
      }
    } else {
      best.push(cand)
      let j = best.length - 1
      while (j > 0) {
        const prev = best[j - 1]
        if (prev.score > cand.score || (prev.score === cand.score && prev.matchRank > cand.matchRank)) break
        best[j] = prev
        best[j - 1] = cand
        j--
      }
    }
  }
  return best
}

// --- Alternative 2: quickselect partition to top W, then sort W ------------
function partitionTopW(scored: Scored[], W: number): Scored[] {
  const arr = scored.slice() // avoid mutating input
  const cmp = (a: Scored, b: Scored) => (b.score - a.score) || (b.matchRank - a.matchRank)
  // simple nth_element-style selection via repeated Hoare partition
  let lo = 0
  let hi = arr.length - 1
  const target = Math.min(W, arr.length) - 1
  while (lo < hi) {
    const pivot = arr[(lo + hi) >> 1]
    let i = lo
    let j = hi
    while (i <= j) {
      while (cmp(arr[i], pivot) < 0) i++
      while (cmp(arr[j], pivot) > 0) j--
      if (i <= j) {
        const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp
        i++; j--
      }
    }
    if (target <= j) hi = j
    else if (target >= i) lo = i
    else break
  }
  const top = arr.slice(0, target + 1)
  top.sort(cmp)
  return top
}

function verifyEquivalence(query: string) {
  const { scored } = buildScored(query)
  const W = Math.max(10 * 4, 50)
  const TH_COLLATOR = new Intl.Collator('th')
  const finalSort = (arr: Scored[]) => {
    const w = arr.slice(0, W)
    w.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      if (b.matchRank !== a.matchRank) return b.matchRank - a.matchRank
      const ra = index.records[a.idx]
      const rb = index.records[b.idx]
      return (
        TH_COLLATOR.compare(ra.provinceNameTh, rb.provinceNameTh) ||
        TH_COLLATOR.compare(ra.amphureNameTh, rb.amphureNameTh) ||
        TH_COLLATOR.compare(ra.tambonNameTh, rb.tambonNameTh)
      )
    })
    return w.slice(0, 10)
  }
  const fullSort = () => {
    const copy = scored.slice()
    copy.sort((a, b) => (b.score - a.score) || (b.matchRank - a.matchRank))
    return finalSort(copy)
  }
  // Detect ties straddling the W boundary (the only way final output can differ)
  const copy = scored.slice()
  copy.sort((a, b) => (b.score - a.score) || (b.matchRank - a.matchRank))
  let boundaryTie = false
  if (copy.length > W) {
    const a = copy[W - 1]
    const b = copy[W]
    boundaryTie = a.score === b.score && a.matchRank === b.matchRank
  }
  const a = fullSort()
  const b = finalSort(topKByInsertion(scored, W))
  const c = finalSort(partitionTopW(scored, W))
  const key = (x: Scored[]) => x.map(e => e.idx).join('|')
  return { okInsert: key(a) === key(b), okQuick: key(a) === key(c), n: scored.length, boundaryTie }
}

header('Correctness check: top-K variants vs full sort (order + values)')
for (const q of ['bang', 'ban', 'bang rak', 'บาง', 'เมือง', 'ลาดพร้าว', 'krungthep']) {
  const { okInsert, okQuick, n, boundaryTie } = verifyEquivalence(q)
  console.log(`  ${q.padEnd(12)} scored=${String(n).padStart(5)}  final-top10 identical: insertion=${okInsert} quickselect=${okQuick}  tie-at-window-boundary=${boundaryTie}`)
}

header('Pre-sort benchmark (scored array -> top W=50, before collator stage)')
for (const q of ['bang', 'ban', 'bang rak', 'เมือง', 'krungthep', 'บาง', 'ลาดพร้าว']) {
  const { scored } = buildScored(q)
  const W = 50
  console.log(`  query="${q}"  scored.length=${scored.length}`)
  benchSync('    full Array.sort + slice', () => {
    const copy = scored.slice()
    copy.sort((a, b) => (b.score - a.score) || (b.matchRank - a.matchRank))
    return copy.slice(0, W)
  }, { warmup: 200, samples: 2000 })
  benchSync('    bounded insertion top-K', () => topKByInsertion(scored, W), { warmup: 200, samples: 2000 })
  benchSync('    quickselect top-W + sort', () => partitionTopW(scored, W), { warmup: 200, samples: 2000 })
}

header('Collator window sort cost (W=50, real records)')
const { scored } = buildScored('bang rak')
const copy = scored.slice()
copy.sort((a, b) => (b.score - a.score) || (b.matchRank - a.matchRank))
const window = copy.slice(0, 50)
const TH_COLLATOR = new Intl.Collator('th')
benchSync('collator sort of 50 items', () => {
  const w = window.slice()
  w.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (b.matchRank !== a.matchRank) return b.matchRank - a.matchRank
    const ra = index.records[a.idx]
    const rb = index.records[b.idx]
    return (
      TH_COLLATOR.compare(ra.provinceNameTh, rb.provinceNameTh) ||
      TH_COLLATOR.compare(ra.amphureNameTh, rb.amphureNameTh) ||
      TH_COLLATOR.compare(ra.tambonNameTh, rb.tambonNameTh)
    )
  })
  return w
}, { warmup: 200, samples: 2000 })

header('Collator.compare raw cost')
const s1 = index.records[0].provinceNameTh
const s2 = index.records[1].provinceNameTh
benchSync('TH_COLLATOR.compare (th names)', () => TH_COLLATOR.compare(s1, s2), { warmup: 2000, samples: 5000 })
benchSync('plain a<b string compare', () => (s1 < s2 ? -1 : s1 > s2 ? 1 : 0), { warmup: 2000, samples: 5000 })
