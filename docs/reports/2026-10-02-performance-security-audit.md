# `thaizip` performance and security audit

**Date:** 2026-10-02 (Asia/Bangkok)  
**Version and revision:** `thaizip` 0.7.4, `239cd95`  
**Scope:** `thai-zip/` core runtime, default-data loader, React hook, build and publish configuration, lockfile, and shipped package. This is a source and local-runtime audit, not a browser field study or penetration test.

> **Remediation update, 2026-10-02:** All three findings below have been addressed in the working tree. The measurements and descriptions in the original audit remain as the pre-fix baseline; see [Remediation and verification](#remediation-and-verification) for the current behavior.

## Summary

The bundled address index performs well in the measured normal case. The production ESM build loaded its 7,385-record default index in **44.7–46.4 ms** across five fresh Node processes. An isolated, warmed `bang` search measured **0.43–0.44 ms p50** and **0.74–1.00 ms p99** across three 1,000-search runs. The index retains about **11.36 MB** of JavaScript heap. The full test suite, typecheck, and build passed. `npm audit` reported **zero known advisories** for the lockfile on this date.

There is **no confirmed critical or high severity vulnerability** in the audited package. The main residual risk is a custom-data amplification path: long parent names are copied into the trigram postings of every child record. The input validator checks types and duplicate IDs but does not cap lengths or row counts. Applications that accept untrusted custom address data need to bound it before calling the index builder. A second, lower-risk issue is that the cached default index itself remains mutable and shared across callers. The performance harness also contains stale logic that can misstate production performance.

These findings are current as of this revision; the [August security audit](2026-08-27-security-audit.md) and [implementation report](2026-08-27-implementation-report.md) describe earlier code and should not be read as the current findings list.

## Findings

### 1. Custom parent names amplify index work and memory — Medium when input is untrusted

**Code:** [`src/core/indexer.ts:31`](../../src/core/indexer.ts), [`src/core/indexer.ts:125`](../../src/core/indexer.ts), [`src/core/indexer.ts:197`](../../src/core/indexer.ts), [`src/core/trigrams.ts:9`](../../src/core/trigrams.ts).

`validateRawData` checks field types and duplicate IDs, but accepts strings of any length and any number of rows. The builder computes each province/amphure trigram set once, then inserts that entire set into **every** child tambon's postings. Consequently, the relevant cost is approximately `sum(parent unique trigrams × active child records)`, plus each tambon's own trigrams; it is not merely linear in the source payload's byte count. A single oversized parent name with many children can consume substantial synchronous CPU time and heap.

**Reproduction (built ESM package, one process):** With 1,000 synthetic tambons under one province, changing only the province name from 30 to 300 to 1,000 Unicode characters produced **21,000 / 291,000 / 977,000 postings** and **3.5 / 13.3 / 75.0 ms** builds, respectively. The bundled data's longest province, amphure, and tambon names are only **24 / 26 / 31 characters**, so this is a custom-data risk. These timings are single-run demonstrations of scaling, not benchmark percentiles.

**Impact:** If an application passes user-controlled uploads or CMS rows into `buildThaiAddressIndex`, one accepted payload can block the JavaScript thread and allocate a much larger index than the input size suggests. The package [documents custom data as trusted input](../../README.md), so this is conditional on the consuming application's trust boundary; it is not a remote exploit of the default loader.

**Recommendation:** Enforce row-count and per-name limits before building from external data. For a library-level guard, account for each parent's fan-out when setting a total posting budget; a simple total-input-byte limit misses this amplification. Keep the default dataset's trusted fast path available.

### 2. The cached default index can be changed by any caller holding it — Low, process-local integrity

**Code:** [`src/data/loader.ts:5`](../../src/data/loader.ts), [`src/data/loader.ts:27`](../../src/data/loader.ts), [`src/data/loader.ts:31`](../../src/data/loader.ts), [`src/types.ts:17`](../../src/types.ts).

`loadDefaultIndex()` and `getDefaultIndexIfLoaded()` return the same writable `TrigramIndex` object. Search and zip-lookup results are copied, which protects against mutation through those *results*, but callers can still mutate `index.records` or its `Map`/`Set` structures directly. In a fresh process, changing `a.records[0].tambonNameTh` after `a = await loadDefaultIndex()` changed the value observed by a later `b = await loadDefaultIndex()`; `a === b` was `true`.

**Impact:** A buggy or otherwise untrusted in-process consumer can corrupt later search results for other consumers of the singleton. This does not create an external attack path on its own, because the attacker would already need JavaScript execution in the application.

**Recommendation:** State clearly that the returned index is shared and must be treated as read-only. If isolation is a product requirement, provide an explicitly immutable/default read-only API and guard the maps as well as records. `Object.freeze(map)` alone does not prevent `Map.set()`.

### 3. Two performance harnesses no longer model the shipped path — Low, measurement quality

**Code:** [`bench/init.ts:216`](../../bench/init.ts), [`bench/search-phases.ts:75`](../../bench/search-phases.ts), [`src/core/search.ts:228`](../../src/core/search.ts).

The “cold `loadDefaultIndex`” measurement in `bench/init.ts` imports TypeScript source through `tsx`, so its **51–91 ms** sample in this audit includes runtime TypeScript tooling. Five fresh-process imports of the built `dist/data.js` measured **44.7–46.4 ms** instead. `bench/search-phases.ts` still uses the old fixed `max(limit × 4, 50)` collator window, whereas production extends the window through the entire score/rank tie at the result boundary. Phase percentages from that script therefore do not describe the current search implementation.

**Impact:** Maintainers may attribute startup overhead to the library or optimize the wrong search phase. This is a tooling issue; it does not slow package consumers.

**Recommendation:** Add a production-dist cold-load benchmark, and update the phase harness to use the current tie-window algorithm (or share the production search implementation's instrumentation). Report process startup and module import separately.

## Measured performance and package surface

Measurements used macOS, Apple M4, Node 26.4.0, and the repository's generated 7,385-record dataset. Warm search numbers are from the built ESM package in three fresh processes after 300 warmups, with 1,000 timed calls per process. The broader `bench/search.ts` run gave noisier tails as it cycled through many queries, so the isolated result above is the more useful `bang` comparison.

| Check | Current observation |
|---|---:|
| Fresh built ESM default-index load, 5 processes | 44.7–46.4 ms |
| Fresh index build, 100 warmed samples, p50 / p95 | 28.69 / 33.60 ms |
| Retained index heap | ~11.36 MB |
| `bang` search, isolated 3 runs | p50 0.43–0.44 ms; p99 0.74–1.00 ms |
| `10500` / `10` zip search, broad harness p50 | ~0.38 / 4.12 µs |
| `dist/index.js` / `dist/defaultData.js`, raw | 20,089 / 529,182 bytes |
| Same files, gzip-9 | 5,285 / 117,075 bytes |
| `npm pack --dry-run --json` | 16 files; 146,966-byte tarball |

The data remains in the separate `dist/defaultData.js` chunk, referenced by a dynamic import from `dist/data.js`. Both ESM and CJS entry points loaded the built index and returned 10 results for `ลาดพร้าว`. The packed files include the internal data chunk and omit source maps and raw JSON tables.

## Security checks and limits of this audit

- The package has **no runtime `dependencies`** and an optional React peer. `npm audit --json` against `package-lock.json` returned zero known vulnerabilities across its reported dependency tree. This is a known-advisory check, not proof that every dependency or build script is safe. npm documents that its audit queries the configured registry's advisory data and that peer dependencies are not covered by this check: [npm audit reference](https://docs.npmjs.com/cli/audit/), [dependency audit guide](https://docs.npmjs.com/auditing-package-dependencies-for-security-vulnerabilities/).
- No dynamic code execution, DOM HTML insertion, network fetch, or shell execution was found in `src/`. Text/zip query lengths are bounded before normalization or scanning in [`src/core/search.ts`](../../src/core/search.ts). Runtime junk-input guards and duplicate-ID checks are present.
- The release and docs workflows pin external Actions to full 40-character commit SHAs. The publish job limits its GitHub token permissions and exposes `NPM_TOKEN` only to the publish step. SHA pinning matches [GitHub's secure-use guidance](https://docs.github.com/en/actions/how-tos/security-for-github-actions/security-guides/security-hardening-for-github-actions).
- This audit did not test malicious npm package behavior, browser bundler variants, or applications that render suggestion labels into HTML. The library returns plain strings; consumers remain responsible for safe rendering.

## Verification performed

| Command or probe | Result |
|---|---|
| `npm test` | 13 files passed; 312 tests passed, 2 intentionally skipped |
| `npm run typecheck` | Passed |
| `npm run build` | Passed; esbuild emitted its known directive warning, and both built React entries begin with `"use client"` |
| `npm audit --json` | 0 reported vulnerabilities |
| `npm_config_cache=/private/tmp/thaizip-npm-cache npm pack --dry-run --json` | 16 files; required data chunk included |
| Built ESM/CJS loader and search smoke tests | 7,385 records; 10 `ลาดพร้าว` results on each entry |
| Isolated cold-load, search, and custom-data probes | Results above |

The working tree was clean before this audit. Only this report was added.

## Remediation and verification

The following changes were made after the original audit, in response to a request to fix all three findings:

| Finding | Change | Verification |
|---|---|---|
| 1. Custom-data amplification | Default validation now rejects more than 50,000 combined rows, names over 256 UTF-16 code units, ZIP values over 32 code units, or an estimated posting cost over 1,000,000. The estimate counts each active parent's **unique** trigrams per child, so a repeated-letter name is not rejected just because it is long. Parent trigrams are computed lazily for active children, avoiding work on unused parents. `{ validate: false }` remains the explicit trusted-data opt-out. | New indexer tests first failed on the old behavior, then passed. A 5,000-child high-entropy parent is rejected; an 8,000-child repeated-letter parent passes validation. A 5,000-unused-parent reproduction now builds with zero trigram keys in ~2 ms including validation. |
| 2. Shared default index mutation | The default loader freezes records, arrays, and the index object, and gives its maps and trigram sets read-only mutator prototypes. Custom indexes built with `buildThaiAddressIndex` remain mutable. | New loader tests first failed on the old behavior, then passed. Ordinary record writes, array pushes, and `Map`/`Set` mutators now throw; a later loader call sees the original data. Built ESM and CJS loaders still return 7,385 records. |
| 3. Stale benchmarks | `bench/init.ts` now times the built ESM loader and built data chunk in plain Node subprocesses, and its build-phase copy follows first-use parent normalization. `bench/search-phases.ts` now follows the typed-array hit counter, score/rank tie window, and copied-result path. It checks instrumented result IDs against `searchThaiAddress` before reporting phase times. | Both scripts ran successfully after a build; the phase comparison passed for all 13 benchmark queries. |

**Current checks:** `npm test` — 319 passed, 2 skipped; `npm run typecheck` — passed; `npm run build` — passed; ranking regression suite — 36 passed; `npm pack --dry-run --json` — 16 files, 149,014-byte tarball with the data chunk present. Five fresh built-ESM cold loads measured **44.51–47.24 ms**. The new custom-data validation takes about **1.76 ms p50** on the full raw dataset; the default loader skips that validation for its generated trusted data.

The read-only guard addresses accidental mutation through ordinary JavaScript operations. It is not a sandbox against malicious code already executing in the same realm: direct calls such as `Map.prototype.set.call(map, ...)` can bypass an instance's overridden mutators. Applications requiring hostile-code isolation need a separate realm or process.
