# thaizip — Performance Audit

**Date:** 2026-08-27
**Author:** Automated performance audit
**Environment:** Apple M4, 16 GB, macOS 26.5.2, Node v26.4.0 (V8)
**Library version:** 0.7.2
**Dataset:** 77 provinces · 920 amphures (918 in index) · 7,412 tambons (7,385 records)

---

## 1. Executive summary

`thaizip` is already **fast for its primary use case**: per-keystroke autocomplete work is
well under 1 ms on the worst measured query, and a full typing session costs ~1.3 ms total.
The library does **not** block the UI frame budget on any realistic input. The two places
where meaningful time is spent are:

1. **One-time index initialization** — ~41 ms cold (`loadDefaultIndex()` on a real device),
   ~30 ms warm build. This is the single largest cost a user ever pays, but it happens once.
2. **Posting-union + hit counting during text search** — for English queries with huge
   inverted-index postings, this accounts for 60–80% of search time.

Three optimizations were implemented and measured. Two cut worst-case text-search latency by
up to **5×** with byte-for-byte identical ranking; one shrinks the shipped data bundle by
**26% raw / 5% gzip**. The expensive architectural ideas that were prototyped (shipping a
precomputed index, replacing the full sort with top-K selection) were **rejected by
measurement** — they either inflate the bundle or silently change ranking.

> **Bottom line:** a small, low-complexity set of changes delivers ~2.6–5× faster text
> search, ~20× faster zip lookup, and a ~5% smaller gzipped data bundle with **zero change
> to any public API and zero ranking changes.** No further optimization is warranted.

---

## 2. Methodology

- **Percentile-based** (p50/p95/p99/min/max), never average-only, to surface tail latency.
- Each hot path is **JIT-warmed** before sampling (steady-state is what a long-lived SPA
  hits); first-call latency is measured separately in fresh subprocesses.
- **CPU profiles** via `--cpu-prof` with a custom analyzer attributing self-time per function
  and per ancestor phase.
- **Memory** via `--expose-gc` `heapUsed` deltas and inverted-index structural counts.
- **Bundle** sizes measured raw / gzip-9 / brotli-11 on the real `dist/` output and the npm
  tarball.
- Ranking regression: a 36-query × 5-variant result-ID snapshot diffed before/after each
  change; full suite (186 tests) run after every change.

Reproducible harness lives in [`bench/`](../bench/). Run with
`node --expose-gc --import tsx bench/<name>.ts`.

---

## 3. Index initialization

### 2.1 Cold / warm / build-time

| Measurement | Result |
|---|---|
| `buildThaiAddressIndex` (warm, fresh build) | p50 **30.3 ms**, p99 34.9 ms |
| `loadDefaultIndex()` **cold** (production `dist/`, fresh process) | **45–48 ms** (module parse+eval + tuple→RawData map + build) |
| `loadDefaultIndex()` **warm** (cached) | **~0.003 ms** (resolved promise) |
| Tuple→RawData mapping (loader step) | 58 µs |
| `validateRawData` | 13 µs |

The "~40 ms" figure in the task brief matches reality. Real users pay this once, on the
page where autocomplete first mounts. It is a **synchronous main-thread block** — the
CLAUDE.md guidance to call `loadDefaultIndex()` at route/mount time (not on the first
keystroke) is correct and important.

### 2.2 Where the ~30 ms build time goes (instrumented phase breakdown)

```
tambon trigram add (th+en)         13.1 ms   45%   ← addTrigrams: Map.get + Set.add × 288k postings
parent trigram add (prov+amp)      9.7 ms   33%   ← the province/amphure postings dominate
zip trigram add                    2.7 ms    9%
parent trigram precompute (norm)   1.6 ms    5%
tambon normalize (th+en)           1.2 ms    4%
record construction / grouping     0.8 ms    3%
```

**~79% of build time is inverted-index construction (`addTrigrams` + `extractTrigrams`),
not normalization.** Normalization is only ~5–10%. Validation is negligible (13 µs).

### 2.3 Memory

| Metric | Value |
|---|---|
| Index retained heap | **~11.3 MB** |
| Unique trigrams | 9,404 |
| Total postings | 288,663 |
| Postings per record (avg) | 39.1 |
| Zip codes / byProvince / byAmphure | 953 / 77 / 918 |

---

## 4. Search latency

Steady-state `searchThaiAddress` p50 (worst p99 in parentheses). All results counted as
returned (no dead-code elimination).

### Thai queries

| Query | p50 | p95 | p99 | ops/s |
|---|---|---|---|---|
| ลาดพร้าว | 12.1 µs | 16.1 | 27.8 | 76k |
| ลาดพร | 1.1 µs | 2.0 | 2.5 | 818k |
| บางรัก | 21.3 µs | 24.0 | 29.3 | 46k |
| เชียงใหม่ | 39.1 µs | 43.3 | 50.0 | 25k |
| นครราชสีมา | 38.6 µs | 42.3 | 46.7 | 25k |

### English (RTGS + alias) queries

| Query | p50 | p95 | p99 | ops/s |
|---|---|---|---|---|
| bang rak | 109.7 µs | 141.9 | 275.3 | 8.6k |
| chatuchak | 13.8 µs | 16.0 | 18.0 | 71k |
| lat phrao | 40.3 µs | 44.3 | 51.6 | 24k |
| lardprao | 39.9 µs | 43.4 | 49.3 | 25k |
| ladkrabang | 35.8 µs | 40.8 | 59.7 | 27k |
| krungthep | 87.6 µs | 97.9 | 165.0 | 11k |

### Postal-code queries

| Query | p50 | p95 | p99 | ops/s |
|---|---|---|---|---|
| 10500 | 0.21 µs | 0.46 | 0.54 | 3.6M |
| 45000 (33 records) | 0.21 µs | 0.25 | 0.29 | 4.8M |
| 450 | 0.21 µs | 0.21 | 0.29 | 5.0M |
| 10 (230 records) | 0.79 µs | 0.96 | 1.25 | 1.1M |

### Edge cases

| Query | p50 | Notes |
|---|---|---|
| ก / c / ba / กร (≤2 chars) | 0.04–0.13 µs | returns `[]` immediately — effectively free |
| long query (~60 chars) | 13.2 µs | |
| no result (xyzxyzxyz) | 0.4 µs | trigram miss → fast exit |
| บาง / ban (3-char, many hits) | 67 / 121 µs | single-gram, everything scores 1.0 |
| **bang** (worst common) | **225.8 µs** (p99 617) | 4,127 candidates |
| เมือง | 85.8 µs | |
| khet / khwang | 49.8 / 50.8 µs | |

**Worst measured steady-state query (`bang`) is ~226 µs p50 / 617 µs p99** — ~1/4 of a
16 ms frame. Nothing in the library can drop a frame.

### Cold first-call (fresh process, first search after import)

| Query | median |
|---|---|
| ลาดพร้าว | 0.58 ms |
| bang rak | 3.5 ms |
| bang | 4.4 ms |

First call is ~10× slower than steady-state (JIT cold) but still ≤5 ms.

---

## 5. Autocomplete workload

Simulated one-character-at-a-time typing (200 rounds, per-step + totals):

| Sequence | Total p50 (all 8 keystrokes) |
|---|---|
| ล → ลาดพร้าว | **83 µs** |
| b → bang rak | **1.25 ms** (worst-case English) |

Per-step: the first two keystrokes (sub-3-char) return `[]` at ~100 ns; the remaining
steps are the queries in §4.

**Work-reuse analysis:** nothing is cached between keystrokes except the index. Each search
recomputes query normalize (O(q)), alias lookup (O(1)), trigram extraction (O(q)), the
posting union + hit count (O(Σ postings)), scoring (O(candidates)), and sort. The debounced
React hook normally runs **only 1 search per fast typing burst**, so reuse is moot. There is
one genuine but tiny duplicate: typing `ลาดพร` then `ลาดพร้` normalizes to the same string
(tone marks are stripped) and re-searches identically (~10 µs wasted). Not worth caching.

---

## 6. CPU profile (hot paths)

### Search workload (`--cpu-prof`, ~3 s mixed)

By ancestor phase (excluding the harness driver loop, ~24%):

```
searchThaiAddress subtree                    65.8%
├─ searchThaiAddress self (hit-accumulate
│    + scoring loops)                       57.7%   ← THE hot path
├─ sort comparators + result map (anon)      23.6%
├─ matchRank (rankAgainstName)               17.8%
├─ trigram extract / normalize / zip          2.5%
GC                                           1.5%
```

Phase-instrumented per-query breakdown confirms it (avg of 300 runs, "bang rak"):

```
hitAccumulate  (posting iteration + hit counting)  62.6%
scoreMatchRank (threshold + matchRank scoring)     21.3%
presort        (numeric sort of scored array)      11.1%
collatorWindow (locale tie-break, top 50)           4.5%
normalize+trigram+materialize                      <0.5%
```

For **fast Thai queries** the collator window dominates (~35–58%) but is bounded to 50 items
and cheap; for **slow English queries** hit accumulation dominates. This is precisely what
the typed-array optimization targets (§16).

### Build workload

```
addTrigrams                     51%
extractTrigramsNormalized       24%
normalizeThaiAddressText         4%
GC                               9%
```

---

## 7. Algorithmic complexity

| Function | Effective complexity | Every keystroke? |
|---|---|---|
| `searchThaiAddress` | O(q·q + Σ\|postings\| + k + k log k + 50 log 50), k=candidates | yes |
| `lookupByZipCode` | **now O(log n_zips + matches)** (was O(n_zips)) | yes (zip input) |
| `listProvinces` | O(77 log 77) | no (cascade open) |
| `listAmphures` | O(k + A log A) | no |
| `listTambons` | O(T log T) | no |
| `loadDefaultIndex` | O(records · trigrams) ≈ 30 ms | no (once) |

No accidental O(n²). The posting-union loop over `Σ|postings|` (up to ~11k per "bang rak")
is the only large per-keystroke loop, and it is now backed by flat arrays.

---

## 8. Candidate generation

**Inverted-index statistics**

- Median posting length: **4** (many tiny sets).
- **Skewed tails:** top Latin trigrams are enormous — `"ng "` = 4,133 records, `"ang"` =
  3,702, `"ong"` = 2,379. 1,605 Latin trigrams hold 156k of 289k postings.
- 1–2 char queries never reach the index (return `[]` before trigram extraction).

**Candidate funnel** for representative queries:

| Query | trigrams | posting sizes | union | scored(≥0.4) | returned |
|---|---|---|---|---|---|
| ลาดพร้าว | 5 | 143,6,4,62,31 | 211 | 29 | 10 |
| เชียงใหม่ | 6 | 425,425,522,208,300,289 | 696 | 399 | 10 |
| นครราชสีมา | 8 | 1406,289,290,852,… | 1787 | 289 | 10 |
| bang rak | 6 | 1374,3702,4133,305,1129,324 | **5531** | 1320 | 10 |
| bang | 2 | 1374,3702 | 4127 | 4127 | 10 |
| ban | 1 | 1374 | 1374 | 1374 | 10 |

English queries pull unions of thousands because Latin trigram space is small (~1,000
distinct) and common ("ang" appears in half the dataset). Thai queries stay small.

**Findings:** scoring is union-based (score = matched/total ≥ threshold), so
intersection-pruning is invalid for threshold < 1; the candidate set is necessarily the
union. Posting iteration dominates, so the highest-value change is making that iteration
cheap (flat arrays — §16), which was done. No duplicate candidates; one `Set` per candidate
record is the only per-record allocation in the hot loop.

---

## 9. Sorting / top-K

**Key finding: `Array.sort` on the full `scored` array is a minor cost, and replacing it
with bounded top-K is NOT a safe drop-in.**

Benchmarked on real candidate arrays (n = 4127 for "bang"):

| Strategy | "bang" n=4127 | "ban" n=1374 | "bang rak" n=1320 |
|---|---|---|---|
| full `sort` + slice (current) | 72.5 µs | 44.5 µs | 37.2 µs |
| bounded insertion top-K | 16.7 µs | 8.5 µs | 10.0 µs |
| quickselect top-W + sort | 12.7 µs | 5.4 µs | 7.3 µs |

The current pre-sort is only ~11–22% of total query time (§6). Even though top-K is
4–6× faster than full sort, adopting it is **rank-dangerous**:

- Ties on `(score, matchRank)` **straddle the window boundary** on heavy queries.
- Quickselect **changed the final top-10** in 4 of 7 benchmark queries.
- Bounded insertion happened to match (it mimics stable order) but relies on luck.

Safely adopting it requires extending the window to absorb all boundary ties — added
complexity for ~15–60 µs on worst-case queries. **Tier C (rejected).**

The collator tie-break (module-level cached `Intl.Collator`) costs only ~41 ns/call — the
existing "never build a Collator in a comparator" guidance is correct and already applied.

---

## 10. Short queries

Sub-3-character queries are handled by an early return `[]` and cost **~0.1 µs**. A
3-character query is the smallest that reaches the index; worst case (`bang`) is ~226 µs
p50. A prefix/first-character/bigram special index would add memory and code for a case
that is already far inside the frame budget. **Not warranted (Tier C).**

> Note this is a deliberate product behavior (tests assert empty results for ≤2 chars).

---

## 11. Postal-code search

Before the change, every `lookupByZipCode` scanned **all 953 zips** (`O(n_zips)`), even for
exact 5-digit hits. After the change it binary-searches a sorted key array and walks the
contiguous prefix range:

| Zip | Before | After | Speedup |
|---|---|---|---|
| 10500 (5 records) | 4.3 µs | 0.21 µs | 20× |
| 45000 (33) | 4.3 µs | 0.21 µs | 20× |
| 10 (230) | 17.3 µs | 0.79 µs | 22× |
| 50 | 16.3 µs | 0.67 µs | 24× |

Output is **identical** (exact-match-first + ascending is preserved automatically because a
prefix string sorts before any longer string sharing it). Fan-out is heavy: 230 of 953 zips
map to >10 tambons (max 33), which is exactly why `zipLimit` (not `limit`) governs them.

---

## 12. Precomputed index & data representation (rejected)

**Precomputed full index — rejected (Tier C).**

| Artifact | raw | gzip-9 | brotli-11 | load time |
|---|---|---|---|---|
| Current tuples (data) | 355 KB | 115 KB | 83 KB | ~41 ms (incl. build) |
| Packed precomputed index | 3.35 MB | 661 KB | 315 KB | ~16 ms (parse+reconstruct) |

Shipping the built index would shrink warm-load time by ~20 ms but cost **+5.7× gzip
(+546 KB download)** and **+4.3 MB heap**, and it does not change search speed at all
(identical structures). Not a favorable trade-off.

**Flat `Uint32Array` postings** (representation ceiling) measured a **~10× faster counting
core** than `Set`+`Map` (20.5 µs vs 198 µs). This is the same trick as the implemented hit
counter, taken further by storing postings in typed arrays. It is a bigger change (the
public `TrigramIndex.map` type) and was **not** applied — the typed-array hit counter (§16)
captures most of the benefit with zero API change. **Tier B.**

**Repeated-string memory:** province/amphure names are duplicated across records as full
strings, but these are JS string interning (V8 dedups identical strings), so the marginal
memory is small; the index is already 11.3 MB total. Tuples vs objects are both in use
(tuples on disk, objects in the index). Not worth changing.

---

## 13. Bundle analysis

| File | raw | gzip-9 | brotli-11 |
|---|---|---|---|
| `dist/index.js` (core) | 17.6 KB | 4.8 KB | 4.3 KB |
| `dist/index.cjs` | 17.9 KB | 4.8 KB | 4.3 KB |
| `dist/react.js` | 13.4 KB | 3.9 KB | 3.6 KB |
| `dist/react.cjs` | 13.5 KB | 3.9 KB | 3.5 KB |
| `dist/data.js` | **536.9 KB** | **119.6 KB** | **88.1 KB** |
| `dist/data.cjs` | 537.0 KB | 119.6 KB | 88.1 KB |

**npm tarball:** package size 315.1 KB, unpacked 1.7 MB.

Findings:
1. **`charset: 'utf8'`** (implemented) — esbuild's ASCII default was emitting every Thai
   byte as 6-byte `\uXXXX` escapes. The data entry is now **-187 KB raw, -6.1 KB gzip,
   -4.6 KB brotli** (~5%). Core/react entries shrank slightly too. tsup has no top-level
   `charset`; it must be set via `esbuildOptions`. Implemented and verified.
2. **Source maps ship in the tarball** (`dist/index.*.map` ×2 at 49 KB each, `react.*.map`
   ×2 at 41 KB). They don't affect app bundle size but add ~170 KB to the npm download.
   Consider `files`-exclusion or `npm ignore` if download size matters (common in some
   ecosystems). The data entry correctly has none.
3. `react` entry re-bundles its own copy of `search`/`format`/`resolve` (~2.5 KB gzip of
   the 3.9 KB), which is expected for a per-entry bundle and harmless.

Data composition (approx): numbers ~40% (repeated IDs), Thai strings ~19% (raw), Latin
strings ~11%, syntax the rest.

---

## 14. Browser responsiveness

Mapped to the frame-budget thresholds:

| Work item | Typical | Budget | Verdict |
|---|---|---|---|
| Per-keystroke search (Thai) | 1–40 µs | <16 ms | **excellent** |
| Per-keystroke search (English, worst `bang`) | 226 µs p50 / 617 µs p99 | <16 ms | **excellent** |
| Full 8-keystroke burst (English) | 1.25 ms | — | **excellent** |
| React search+format+commit | ~70–80 µs | <16 ms | **excellent** |
| **Cold `loadDefaultIndex()`** | **~45 ms** | >16 ms | **long task** — the only blocker |

The only synchronous operation that can block the UI is cold index initialization
(~45 ms). Everything else is sub-millisecond. The existing advice to call
`loadDefaultIndex()` at mount/route-load (not first keystroke) is exactly right; doing so
moves the long task to load time.

---

## 15. React autocomplete

Measured with `@testing-library/react` + `act` + a counting proxy on the index:

| Scenario | Result |
|---|---|
| Fast typist (8 keys @50 ms) | **1 search**, 11 renders; suggestions list stays closed until debounce settles |
| Slow typist (8 keys @200 ms) | 6 searches (one per ≥3-char keystroke) |
| Strict Mode mount (empty query) | 0 spurious searches |
| Timer churn per keystroke | 1 `setTimeout`, 0 stray `clearTimeout` |
| Debounced search+format+commit | ~70–80 µs incl. re-render |

**Debounce verdict:** 200 ms is not compensating for slow search (search p99 < 1 ms).
It is genuinely appropriate for the UI reason — suppressing intermediate empty-list
flicker and render churn during fast typing (8 keys → 1 search). No change recommended.

---

## 16. Implemented optimizations (measured)

| Optimization | Before | After | Improvement | Memory | Bundle |
|---|---|---|---|---|---|
| **Typed-array hit counting** (search.ts) | bang rak 309 µs | 110 µs | **2.8×** | +29 KB/index | 0 |
|   (worst `bang`) | 342 µs | 226 µs | 1.5× | | |
|   (chatuchak) | 69 µs | 14 µs | 5.0× | | |
| **Sorted-zip binary lookup** | 4–17 µs | 0.2–0.8 µs | **20–34×** | ~7 KB | 0 |
| **`charset:'utf8'` data build** | 724 KB raw | 537 KB | **−26% raw** | 0 | −5% gzip |

All three: **ranking byte-for-byte identical** (36 queries × 5 variants), full suite 186/186
passes, typecheck clean, production `dist` smoke-tested (warm load 0.003 ms, cold 45 ms).

---

## 17. Rejected optimizations

| Optimization | Why rejected (evidence) |
|---|---|
| Precomputed full index | +5.7× gzip, +memory, no search gain |
| Top-K / quickselect sort | **changes final top-10** on 4/7 real queries (boundary ties) |
| Prefix/bigram/short-query index | sub-2-char already ~0 µs; 3-char worst 226 µs — no need |
| Query-level memoization | duplicate work is only ~10 µs and debounce already coalesces |
| Flat `Uint32Array` postings | ~10× on counting core but changes public `TrigramIndex` type (Tier B) |

---

## 18. Recommendations

### Tier A — Do now (implemented)
1. **Typed-array hit counting** — done (`src/core/search.ts`). 1.3–5× on text, identical
   ranking.
2. **Sorted-zip binary lookup** — done (`src/core/search.ts` + `indexer.ts` + `types.ts`).
   20–34× on zip, identical output.
3. **`charset:'utf8'`** — done (`tsup.config.ts` via `esbuildOptions`). −26% data raw /
   −5% gzip.

### Tier B — Worth considering
4. **Ship flat `Uint32Array` postings** inside the index for another ~10× on the counting
   core. Requires changing the public `TrigramIndex` type (additive: keep `map` for
   compatibility) or a new internal representation. Complexity + migration cost; the
   current gain already satisfies the budget.
5. **Call `loadDefaultIndex()` earlier / off critical path** — this is a consumer
   guidance/documented improvement, not a code change (the ~45 ms cold is the only long
   task).
6. **Stop shipping source maps** (or `data.*` maps note) to trim ~170 KB of tarball — minor
   but free.

### Tier C — Not worth it
7. Top-K/quickselect sort — changes ranking.
8. Precomputed index — bundle/memory worse.
9. Short-query special indexes — no need.
10. Object pools / micro-optimizations — allocation was only ~1.5% of CPU; GC pressure is
    not a bottleneck.

---

## 19. Recommended performance budget

Given current (optimized) measurements, a realistic and generous budget:

| Metric | Target | Measured (optimized) |
|---|---|---|
| Text search p50 | ≤ 50 µs | 1–110 µs (worst 226 µs `bang`) |
| Text search p99 | ≤ 1 ms | 18–617 µs |
| Zip lookup p95 | ≤ 5 µs | ≤ 1.25 µs |
| Per-keystroke burst (8 keys) | ≤ 2 ms | 0.08–1.25 ms |
| Cold `loadDefaultIndex()` | ≤ 60 ms | 45–48 ms |
| Warm load (cached) | ≤ 0.1 ms | ~0.003 ms |
| `thaizip` core gzip | ≤ 5 KB | 4.8 KB |
| `thaizip/data` gzip | ≤ 125 KB | 119.6 KB |
| Index retained memory | ≤ 12 MB | ~11.3 MB |

**Everything passes.** No further optimization is required to meet the budget.

---

## Reproducibility

Benchmarks live in `bench/`:
- `init.ts`, `search.ts`, `typing.ts`, `candidates.ts`, `sort-bench.ts`, `zip-bench.ts`,
  `alloc.ts`, `search-phases.ts`, `precompute.ts`, `enumerate.ts`, `ranking-snapshot.ts`
- `react.bench.test.tsx` (React workload, run with vitest)
- `bundle.sh` (bundle sizes)
- CPU profiles via `profile-search.ts` / `profile-build.ts` + `analyze-profile.ts`

Run: `node --expose-gc --import tsx bench/<name>.ts`, `./bench/bundle.sh`,
`npx vitest run bench/react.bench.test.tsx`.