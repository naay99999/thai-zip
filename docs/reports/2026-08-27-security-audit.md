# Security Audit — `thaizip` 0.7.2

**Date:** 2026-08-27
**Scope:** entire repository — `src/` (core, React, data loader), build config, npm package, GitHub Actions, release automation, docs demos
**Method:** static source review + active adversarial testing (50 scratch tests + standalone timing harness against the real default index of **7,385 records / 9,404 trigram keys / 953 zip codes**). No production code was modified. All timings from Node 26 on macOS (jsdom/vitest for behavior, plain Node for benchmarks).

---

## Security Audit Summary

```txt
Critical:      0
High:          0
Medium:        0
Low:           8
Informational: 4
```

**Bottom line:** no exploitable vulnerability was found. The query path is well hardened against DoS (all million-character adversarial inputs are rejected in **≤ 0.1 ms**; worst legal 300-char query on the full default index runs in **≤ 0.9 ms**), all dictionaries are `Map`/`Set`-based so **prototype pollution is structurally impossible**, and **no regex in the library is vulnerable to ReDoS** (1M-char adversarial inputs complete in 1–4 ms, linear). The 8 Low findings are robustness/API-contract issues, none reachable by an end user beyond CPU cost already bounded by the library's own guards.

---

## 1. What is already hardened (verified, not assumed)

| Area | Evidence |
|---|---|
| **Query DoS guards** | `searchThaiAddress` rejects raw queries > 1000 chars and normalized queries > 300 chars (`src/core/search.ts:94-97`). Measured: 1M-char ASCII/Thai/combining-mark/zero-width/emoji queries all return `[]` in ≤ 0.1 ms on the default index. |
| **Worst legal query cost** | 300-char query with ~298 distinct trigrams against the 7,385-record default index: **0.2–0.9 ms**. Scoring is `O(Σ posting sizes)` + numeric sort + collator over a bounded window of `max(limit×4, 50)` (`src/core/search.ts:152-166`). |
| **ReDoS** | All 6 regexes (`TONE_MARKS`, `ADDRESS_PREFIXES`, `ZIP_CODE_RE`, `HAS_LATIN_RE`, `NOISE_WORDS_RE`, `WHITESPACE_RE`) are single-pass, alternation-of-literals, no nested quantifiers. 1M-char adversarial soups (`sub district `, `amphoeamphur`, `จ.` pairs, tone marks) all complete in 1.2–3.8 ms. |
| **Prototype pollution** | Every dictionary is a `Map`/`Set`: trigram map, `zipIndex`, `byProvince`, `byAmphure`, `ALIASES`, hook's `matchedRecordsMapRef`, scorer's `hits`. Verified: building an index whose names/zips are `__proto__`, `constructor`, `toString`, `hasOwnProperty` neither pollutes `Object.prototype` nor breaks retrieval (`zipIndex.get('__proto__')` works). |
| **Zip lookup** | 1M-digit zip passed directly to `lookupByZipCode`: **0.4 ms** (linear `^\d+$` test + per-key `startsWith` short-circuit over 953 keys). |
| **Loader concurrency** | `loadDefaultIndex()` dedupes concurrent calls via `inflightPromise`; `clearDefaultIndex()` during an in-flight load correctly forces a rebuild on the next call (generation counter, `src/data/loader.ts:26-33`). Verified by test. |
| **Hook hygiene** | No timer leaks (effect cleanup + explicit clears), no setState-after-unmount, `selectSuggestion` returns `null` (never throws) for stale ids, exactly one `onSelect` per successful select. Stress sequence *type → clear → type → swap index → select → unmount* and a 500-keystroke churn both pass cleanly. |
| **Package hygiene** | `npm pack` ships only `dist/` + README + package.json (18 files, 315 kB). Zero runtime dependencies, **no lifecycle scripts**, raw `data/` excluded, no `.env`/secrets anywhere in git history, `"use client"` only on the react entry, npm provenance enabled, publish job permissions narrowed to `contents: read` + `id-token: write`. |
| **Enumerate APIs** | `listAmphures`/`listTambons` return `[]` for junk ids (`'1'`, `NaN`, `Infinity`, `-0`). |

---

## 2. Findings

Severity classification is conservative: a malformed input causing a clean `TypeError` is a robustness issue, not a vulnerability. Findings are numbered SEC-1 … SEC-12 in rough priority order.

---

### SEC-1 — GitHub Actions pinned to mutable major-version tags in the npm-publish pipeline

**Severity:** Low (supply-chain hardening)
**Affected:** `.github/workflows/release-please.yml` (`googleapis/release-please-action@v4`, `actions/checkout@v4`, `actions/setup-node@v4`), `.github/workflows/docs.yml` (`upload-pages-artifact@v3`, `deploy-pages@v4`)

**Root cause:** All five actions are referenced by mutable tags. A compromise of any upstream action repo (tag re-pointed to malicious code) executes inside the `publish` job, which holds `NPM_TOKEN` (npm write access) and `id-token: write` (provenance signing). The job also runs `npm ci` / `npm run generate-data` / `npm run build`, i.e. arbitrary dev-dependency lifecycle code — a standard, accepted Node risk, but the tag pins are the one cheap thing that can be tightened.

**Attack scenario:** attacker compromises (or gains a maintainer on) any of the five action repos, repoints the major tag to exfiltrate `NODE_AUTH_TOKEN` during the next release. Purely hypothetical; likelihood very low, impact very high (malicious `thaizip` release with valid provenance).

**Reproduction:** static — no commit SHAs anywhere in `.github/workflows/`.

**Impact:** full npm-package takeover in the worst case.

**Recommended fix:** pin every `uses:` to a full 40-char commit SHA (e.g. `actions/checkout@<sha>`). Optional: add a `scorecard`/`zizmor` check to CI.

**Regression test:** CI-level check (e.g. a lint script or `zizmor` action) failing on non-SHA action refs.

---

### SEC-2 — Duplicate tambon IDs in custom data silently resolve the wrong address in the React hook

**Severity:** Low (data-integrity footgun; precondition: caller-supplied dataset with duplicate `id`s — `validateRawData` does not check uniqueness)
**Affected:** `src/react/useThaiAddressAutocomplete.ts:75-78` (id-keyed `Map`), `src/core/formatter.ts:15` (`id: String(record.tambonId)`), `src/core/indexer.ts:20-49` (`validateRawData` — no uniqueness check)

**Root cause:** suggestion identity is `String(tambonId)`; the hook's `recordMap.set(id, record)` overwrites duplicates, so *every* suggestion sharing that id resolves to whichever record was inserted last.

**Attack/abuse scenario:** an app ingests address data from an upstream API/CMS/CSV where two subdistricts share an id (or merges two datasets). Both render as separate suggestions with identical ids; picking one returns the *other* record's address. `onSelect` fires with the wrong subdistrict — silently.

**Minimal reproduction (verified):**

```ts
const idx = buildThaiAddressIndex({
  provinces: [{ id: 1, name_th: 'กทม', name_en: 'Bangkok', deleted_at: null }],
  amphures: [{ id: 1001, name_th: 'ลาดพร้าว', name_en: 'Lat Phrao', province_id: 1, deleted_at: null }],
  tambons: [
    { id: 100101, zip_code: 10900, name_th: 'อาทิ', name_en: 'Alpha', amphure_id: 1001, deleted_at: null },
    { id: 100101, zip_code: 10900, name_th: 'เบต้า', name_en: 'Beta',  amphure_id: 1001, deleted_at: null },
  ],
})
const results = searchThaiAddress(idx, 'ลาดพร้าว')   // 2 distinct records…
const recordMap = new Map()
for (const r of results) recordMap.set(String(r.tambonId), r)
recordMap.size // => 1 — one of the two displayed suggestions resolves wrong
```

**Impact:** wrong address delivered (shipping/forms) with no error anywhere.

**Recommended fix:** either (a) make `validateRawData` detect duplicate ids across provinces/amphures/tambons and throw (it already throws on first bad field, so this fits), or (b) decouple suggestion identity from data ids by keying the hook map on the record's index in `index.records` (opaque, always unique).

**Regression test:** see "Tests worth adding" #5.

---

### SEC-3 — `initialQuery` "never searches" contract is broken by StrictMode and by late index arrival

**Severity:** Low (functional bug, two manifestations, one root cause)
**Affected:** `src/react/useThaiAddressAutocomplete.ts:61` (`suppressNextSearchRef` one-shot flag), `:95-98`, `:114-127`

**Root cause:** suppression is a *one-shot boolean*, consumed by whichever effect pass runs first. StrictMode's second effect pass (React 18+ dev) and the `[index]` effect (production) then treat the seeded query as a real keystroke.

**Manifestation A — React StrictMode (verified):** render the hook inside `<React.StrictMode>` with `initialQuery: 'ลาดพร้าว'`, `debounce: 200`; after 1000 ms `suggestions.length === 2` — the documented "Does NOT trigger a search" (`src/react/useThaiAddressAutocomplete.ts:27-29`) is violated in every dev environment.

**Manifestation B — async index load (verified, production):** mount with an empty index plus `initialQuery`, then re-render with the real index (the documented `loadDefaultIndex()`-after-mount pattern): the `[index]` effect searches the seeded query **immediately and synchronously** → dropdown opens on page load with no user interaction. For forms pre-filled with a saved address this is a real production UX bug.

**Impact:** surprise dropdown / spurious search; no crash, no leak.

**Recommended fix:** replace the boolean with value-based suppression — remember the suppressed *string* (`suppressQueryRef.current = initialQuery`) and skip while `query === suppressQueryRef.current`, clearing it once a different query arrives. Both manifestations and the existing `setQuerySilent` edge cases collapse into one rule.

**Regression test:** see "Tests worth adding" #6.

---

### SEC-4 — Search results are live references into the shared cached index (cross-consumer mutation)

**Severity:** Low (requires hostile/buggy code already running in-process)
**Affected:** `src/core/search.ts:166` (returns `index.records[idx]` directly), `src/data/loader.ts:5,27` (module-level singleton)

**Root cause:** `searchThaiAddress` returns live record objects, and `loadDefaultIndex()` hands the *same* mutable instance to every caller.

**Verified reproduction:**

```ts
const a = await loadDefaultIndex()
searchThaiAddress(a, 'ลาดพร้าว')[0].tambonNameTh = 'PWNED'
const b = await loadDefaultIndex()           // === a (same cached instance)
b.records.find(r => r.tambonId === 100101).tambonNameTh // => 'PWNED'
```

**Impact:** one consumer (a buggy component, another bundle of the lib, a third-party script) corrupts the index for the whole page. Inherent to the public `TrigramIndex` type; not remotely exploitable.

**Recommended fix (choose one):** return shallow copies in the hot path (`window.slice(0, limit).map(({idx}) => ({...index.records[idx]}))` — limit ≤ 10, cost negligible); or `Object.freeze` records at build time (fails fast on mutation); or explicitly document records as read-only.

**Regression test:** mutate a returned record, assert the index copy is unaffected.

---

### SEC-5 — Non-string arguments crash with opaque `TypeError`s deep inside the library

**Severity:** Low (robustness / predictable-failure boundary)
**Affected:** `src/core/normalizer.ts:6` (`input.trim()`), `src/core/search.ts:46` (`zip.trim()`), `src/core/search.ts:92` (`!index || !query` only guards nullish), `src/core/enumerate.ts` (no index guard)

**Verified behavior (runtime JS, TypeScript types ignored):**

| Call | Result |
|---|---|
| `searchThaiAddress(index, null / undefined / NaN / '' / 0 / false)` | `[]` (falsy guard — good) |
| `searchThaiAddress(index, [] / {} / 123 / Symbol() / BigInt(1) / new Date())` | `TypeError: input.trim is not a function` (note: `[]` is truthy, so even an *empty* array crashes) |
| `searchThaiAddress(index, new String('ลาดพร้าว'))` | works (boxed String has `.trim`) |
| `lookupByZipCode(index, 12345)` | `TypeError: zip.trim is not a function` |
| `searchThaiAddress({}, 'ลาดพร้าว')` | `TypeError: Cannot read properties of undefined (reading 'get')` |
| `listProvinces(null)` / `buildThaiAddressIndex({} as any)` / `validateRawData({provinces:[null]})` | `TypeError` (various messages) |

All failures are `TypeError`s (fail-fast, never silent corruption), but none name the offending argument, and the crash site is far from the call site. Not a vulnerability — a boundary-polish issue.

**Recommended fix:** add `typeof query !== 'string' → return []` (and an equivalent for `zip`) at the top of both functions; guard `!index?.map` similarly. One line each.

**Regression test:** see "Tests worth adding" #3.

---

### SEC-6 — `validate: false` opt-out crashes in the normalizer; validation has no length/uniqueness bounds

**Severity:** Low (documented trust boundary; the crash itself is clean)
**Affected:** `src/core/indexer.ts:69-72`, `src/core/normalizer.ts:4-11`, `src/core/indexer.ts:20-49`

**Verified:** `buildThaiAddressIndex({…, name_th: 123}, { validate: false })` throws `TypeError: input.trim is not a function` from `normalizeThaiAddressText` instead of a descriptive `[thaizip]` error — exactly the "opaque crash deep inside the normalizer" the validation option exists to prevent, for anyone who opts out. Additionally `validateRawData` checks only `typeof`, not field length, id uniqueness (see SEC-2), or referential consistency.

**Recommended fix:** cheap `typeof input !== 'string' → throw new TypeError('[thaizip] normalizer expects a string')` guard in `normalizeThaiAddressText`; optionally document the trust boundary of `validate: false` more loudly in the README.

---

### SEC-7 — Negative `limit` / `zipLimit` produce truncated-but-nonempty results (slice semantics)

**Severity:** Low (API robustness)
**Affected:** `src/core/search.ts:152,166` (`window.slice(0, limit)`), `src/core/search.ts:57` (`matches.slice(0, zipLimit)`)

**Verified:** with 2 matching records, `{ limit: -1 }` returned **1** record and `{ zipLimit: -1 }` returned **1** record — `slice(0, -1)` keeps all but the last. `NaN` limits return `[]`; `limit: 0` correctly returns `[]`; `limit: Infinity` is safe.

**Impact:** none for correctly-typed callers; a negative value from misconfigured UI state silently returns *almost all* results instead of none.

**Recommended fix:** clamp once: `const limit = Math.max(0, Math.floor(options?.limit ?? 10))` (same for `zipLimit`, where `Infinity` must survive — clamp only finite values).

---

### SEC-8 — Custom-data index build is unbounded (linear) — no caps on field length or row count

**Severity:** Low (trust-boundary resource consumption; **linear**, not quadratic)
**Affected:** `src/core/indexer.ts:103-159`, `src/core/trigrams.ts`

**Measured scaling (all linear, no super-linear blowup anywhere):**

| Input | Build time |
|---|---|
| 1 province name of 10,000 chars (high entropy) | 2.9 ms |
| 1 province name of 100,000 chars → 16,411 distinct trigrams from that one name | 9.6 ms |
| 1 province name of 300,000 chars | 24.5 ms |
| 10,000 fake tambons | 30.7 ms |
| 50,000 fake tambons | 199.7 ms |

**Root cause:** by design `buildThaiAddressIndex` is `O(total content length)`. There is no maximum field length, row count, or resulting trigram-count check, so a 10 MB single name would allocate millions of `Set`/`Map` entries (~1 s build, hundreds of MB) on the main thread.

**Attack/abuse scenario:** only matters if an app feeds *end-user-controlled* data into `buildThaiAddressIndex` (e.g. admin CSV upload). The docs never endorse this, but also never warn about it.

**Recommended fix:** optional `maxFieldLength` (e.g. 512) and/or a total-trigram cap enforced during validation, plus one README sentence declaring `RawData` a trusted boundary. Document, don't silently truncate.

---

### SEC-9 — Docs CI executes PR-controlled `npm install` in the build job

**Severity:** Informational
**Affected:** `.github/workflows/docs.yml:49`

Fork PRs can modify `docs/package.json` + `docs/package-lock.json` and run arbitrary code in the `build` job. The workflow already does the right things: it uses `pull_request` (not `pull_request_target`), the build job has only `contents: read`, and the pages deploy (with `pages: write` / `id-token: write`) is skipped for PRs. Residual risk is sandbox-only code execution with no secret access — acceptable. Optional hardening: `npm ci` instead of `npm install` (attacker still controls the lockfile in their fork, so this is hygiene, not a fix).

---

### SEC-10 — No LICENSE file despite `"license": "MIT"`

**Severity:** Informational (legal hygiene)
**Affected:** repo root / `package.json:19`; `npm pack` output confirms the tarball ships no LICENSE.

**Fix:** add an MIT `LICENSE` file — npm includes it in the tarball automatically.

---

### SEC-11 — NFC/NFD normalization inconsistency causes silent search misses

**Severity:** Informational (correctness; no crash, no cache poisoning — nothing is keyed on raw query text)
**Affected:** `src/core/normalizer.ts`

**Verified:** an NFD query (`'Cafe\u0301'`) scores 0 hits against an NFC-indexed `'Café'`; inserting a zero-width joiner into an otherwise valid Thai query (`'ลาด\u200Bพร้าว'`) also breaks matching. Thai script itself is largely unaffected (sara am `ำ` has no canonical decomposition), so the practical impact is Latin-script edge cases. The 300-char guard bounds any Unicode-expansion trick (e.g. `'İ'.repeat(200)` → 400 normalized chars → correctly rejected).

**Recommended fix (optional):** `text = text.normalize('NFC')` as the first step of `normalizeThaiAddressText` — bounded by the existing 1000-char pre-guard, so cost is negligible.

---

### SEC-12 — `lookupByZipCode` accepts unbounded digit strings (linear cost only)

**Severity:** Informational
**Affected:** `src/core/search.ts:39-58`

Unlike `searchThaiAddress`, the direct zip entry point applies no length cap. Measured: a 1M-digit zip runs the `^\d+$` test plus 953 `startsWith` probes in **0.4 ms** — `startsWith` short-circuits against 5-char keys. No practical exploit even at 100 MB pastes (single linear pass). Optional: reject zip strings longer than ~10 chars.

---

## 3. Investigated and cleared (with evidence)

| Hypothesis | Verdict | Evidence |
|---|---|---|
| ReDoS in any regex / replace / split | **Cleared** | All 6 regexes linear; 1M-char adversarial inputs 1.2–3.8 ms (bench harness). No `.split()` on user input; no dynamic `RegExp` construction anywhere. |
| Prototype pollution via names/ids/keys | **Cleared** | 100% `Map`/`Set` dictionaries; `__proto__`/`constructor`/`toString`/`hasOwnProperty` keys tested end-to-end — no pollution, correct retrieval. |
| O(n²)+ in query path | **Cleared** | Scoring is `O(Σ postings)` bounded by ≤ 298 query trigrams; sort is `O(hits·log hits)` with numeric comparator; collator restricted to `max(limit×4, 50)` window. Worst measured on default index: 0.9 ms. |
| Trigram-set explosion from repeated Unicode | **Cleared** | `extractTrigramsNormalized` returns a `Set` — repeated content collapses to one key (`'a'.repeat(300)` → `{'aaa'}`). Query size bounded at 300 normalized chars. |
| Zip prefix scan blowup | **Cleared** | O(n_zips) scan over 953 keys; 1M-digit needle 0.4 ms (short-circuit). Custom-data variant is covered by SEC-8's trust boundary. |
| Loader races / duplicate work / wedged cache | **Cleared** | `inflightPromise` + generation counter verified: concurrent calls share one build; `clearDefaultIndex()` mid-flight forces a correct rebuild. |
| Hook timer leaks / unmount updates / stale selection / debounce abuse | **Cleared** | Effect cleanup cancels timers; stress sequence and 500-keystroke churn pass; `selectSuggestion` returns `null` for stale ids; exactly one `onSelect`. |
| XSS in library or docs demos | **Cleared** | No DOM APIs, no `innerHTML`/`dangerouslySetInnerHTML`/`eval`/`new Function` anywhere in `src/` or `docs/src/`. Labels are plain strings — rendering safety is the consumer's job. |
| Secrets in repo / git history / npm tarball | **Cleared** | `npm pack --dry-run`: 18 files, dist + README + package.json only. Git history scan for `.env`/`.pem`/`*token*`: clean. Untracked `.codex/`/`bench/` contain no secrets but are not gitignored (minor hygiene — add to `.gitignore`). |
| Getter-throwing / Proxy / TOCTOU custom data | **Cleared (acceptable)** | Throwing getters propagate the throw; proxies that return different values per read validate and build without crash. Re-reading fields between validate and build is a theoretical TOCTOU with no security consequence (index content only). |
| NaN / Infinity / 1e21 / `__proto__` zip codes | **Cleared** | Become `"NaN"` / `"Infinity"` / `"1e+21"` map keys; search unaffected; no crash. |
| Lone surrogates, emoji, RTL overrides, NBSP soup | **Cleared** | No crash anywhere; surrogate-splitting trigrams simply miss the index. |
| CJS/ESM export confusion / accidental file exposure | **Cleared** | Three exports map exactly to `dist/` bundles; `files: ["dist"]` prevents anything else from shipping. `"use client"` correctly only on `react` entry (verified in dist). |

---

## 4. Top fixes before next release

Ranked by `security impact × likelihood × implementation cost`:

1. **Pin all GitHub Actions to commit SHAs** (SEC-1) — minutes of work; closes the only path with npm-publish-level blast radius.
2. **Value-based `initialQuery` suppression in the hook** (SEC-3) — one small refactor (`suppressQueryRef` string instead of one-shot boolean) fixes both StrictMode and async-index contract violations that ship to production.
3. **Clamp `limit`/`zipLimit` + `typeof` guards on `query`/`zip`/`index`** (SEC-5, SEC-7) — ~6 lines total; eliminates the negative-slice quirk and every "crash deep in the normalizer" report.
4. **Duplicate-ID detection in `validateRawData`** (SEC-2) — silent wrong-address resolution is the worst failure mode in this report; a uniqueness pass at validation time (or index-keyed suggestion identity) removes it.
5. **Add LICENSE file + optional NFC normalization** (SEC-10, SEC-11) — trivial; legal hygiene and Latin-script search consistency.

(SEC-4 record freezing and SEC-8 documented caps are worthwhile follow-ups, not blockers.)

---

## 5. Tests worth adding (permanent regression suite)

1. **DoS guards:** `searchThaiAddress` returns `[]` (and stays under a loose time budget) for `'a'.repeat(1e6)`, `'\u0300'.repeat(1e5)`, `'\u200B'.repeat(1e5)`, `'😀'.repeat(1e5)`, `'\u0130'.repeat(200)` (lowercase-expansion probe), and any 301-char normalized / 1001-char raw query — against the *real* `loadDefaultIndex()` (the existing tests use tiny mocks).
2. **Prototype-key probes:** build an index whose `name_th`/`name_en`/`zip_code` are `__proto__`, `constructor`, `toString`, `hasOwnProperty`; assert `Object.prototype` unpolluted, `zipIndex.get('__proto__')` retrievable, and searches with those same query strings are safe.
3. **Junk typing:** `searchThaiAddress` / `lookupByZipCode` called with `[]`, `{}`, `123`, `Symbol()`, `BigInt(1)`, `new Date()` — assert `[]` or `TypeError` (characterization now; tighten to `[]` once SEC-5 lands). Include the `new String('…')` boxed case.
4. **Options clamping:** `{ limit: -1 }`, `{ limit: NaN }`, `{ zipLimit: -1 }` → `[]` after the SEC-7 fix (currently return truncated arrays).
5. **Duplicate tambon IDs:** dataset with two tambons sharing an id → assert `validateRawData` throws (after SEC-2 fix) or that both suggestions resolve to their own records.
6. **React contract:** (a) `<React.StrictMode>` + `initialQuery` → after `advanceTimersByTime(debounce * 5)`, `suggestions` is empty; (b) mount with empty index + `initialQuery`, re-render with real index → still empty; (c) the stress sequence type → clear → type → swap index → select → unmount, asserting exactly one `onSelect` and no throw after unmount; (d) 500 rapid `setQuery` churn → exactly one final search result set.
7. **Loader:** `loadDefaultIndex()` without awaiting, then `clearDefaultIndex()`, then `await` both + a third call → assert the third call returns a *fresh* instance (generation-counter regression).
8. **Mutation isolation (after SEC-4 fix):** mutate every field of a returned search result; re-search and assert the default index is unchanged.
9. **Timing smoke (optional, `describe.skipIf(!process.env.CI_SLOW)`):** worst-case 300-char high-entropy query on the default index completes in < 50 ms; 1M-char query returns `[]` in < 10 ms.

---

## Appendix — benchmark transcript (Node 26, macOS, default index = 7,385 records)

```txt
--- DoS probes: searchThaiAddress (default index) ---
  1M ascii query:                  0.0 ms   (rejected by 1000-char guard)
  300-char mixed query:            0.2 ms
  "กรุงเทพ" ×100 (300 chars):      0.0 ms
  repeated "bang" query:           0.9 ms   (worst observed)
  zip query "10" (worst prefix):   0.2 ms
--- lookupByZipCode direct ---
  1M-digit zip:                    0.4 ms
--- normalizer / romanizer (1M-char adversarial inputs) ---
  normalize Thai:                  1.4 ms
  normalize tone marks:            3.8 ms
  normalize "จ." pairs:            1.4 ms
  romanize "subdistrict " soup:    1.8 ms
  romanize "sub district " probe:  2.2 ms
  romanize "amphoeamphur" soup:    1.2 ms
--- custom-data build scaling (trust boundary) ---
  name of 10k / 100k / 300k chars: 2.9 / 9.6 / 24.5 ms
  10k / 50k fake tambons:          30.7 / 199.7 ms
```

*Audit performed without modifying any production code. Scratch test suite (50 tests) and benchmark harness were removed after evidence collection; the baseline suite (182 tests) passes.*
