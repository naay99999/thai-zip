# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run build          # Build ESM + CJS bundles with type declarations (tsup)
npm run generate-data  # Regenerate src/data/defaultData.ts from raw JSON data
npm test               # Run all tests once
npm run test:watch     # Run tests in watch mode
npm run test:coverage  # Run tests with coverage report
npm run typecheck      # TypeScript check only (no emit)
```

To run a single test file:
```bash
npx vitest run src/__tests__/search.test.ts
```

## Architecture

This is a headless Thai address autocomplete library published as `thaizip`. It ships both a vanilla-JS API and an optional React hook.

**Package exports:**
- `thaizip` — headless core only (search, enumeration, formatter, resolver, normalizer, romanization aliases, `validateRawData`). Contains **no** React code.
- `thaizip/react` — `useThaiAddressAutocomplete` and its types. `react`/`react-dom` are external optional peers. The built files carry a `"use client"` directive (prepended by a tsup `onSuccess` hook — esbuild strips module-level directives during bundling, so `banner` alone does not survive).
- `thaizip/data` — exports `loadDefaultIndex()` and `clearDefaultIndex()` (async, lazy-loads compact tuple arrays from `defaultData.ts` and builds the TrigramIndex at runtime; separate export so tree-shakers can isolate it)

**Data pipeline:**
- Raw JSON files in `data/` (thai_geographies, thai_provinces, thai_amphures, thai_tambons) are the source of truth
- `npm run generate-data` (`src/data/generate.ts`) reads raw JSON tables, filters soft-deleted rows *at generate time*, and writes compact tuple arrays to `src/data/defaultData.ts` — the generated file already contains only active records (no `deleted_at` filtering at runtime for the default index)
- Compact tuple formats: `CompactProvince = [id, nameTh, nameEn]`, `CompactAmphure = [id, nameTh, nameEn, provinceId]`, `CompactTambon = [id, nameTh, nameEn, amphureId, zipCode]`
- `loadDefaultIndex()` in `src/data/loader.ts` assembles the `TrigramIndex` at first call and caches the result as a module-level singleton; `clearDefaultIndex()` resets the singleton (exported from `thaizip/data` — use in tests to isolate state). It builds with `{ validate: false }` because the generated data is already validated at generate time.
- First call costs ~30 ms of synchronous main-thread work. Call it at mount/route load, not on the user's first keystroke.

**Search engine (`src/core/`):**
- `normalizer.ts` — strips Thai address prefixes (full-form จังหวัด/อำเภอ/ตำบล/แขวง/เขต and abbreviated จ./อ./ต./ข.) and Thai tone marks, then lowercases; applied to both index and query
- `trigrams.ts` — `extractTrigrams(text)` normalises then extracts; `extractTrigramsNormalized(text)` skips normalisation for callers (e.g. `search.ts`) that already hold a normalised string. Strings shorter than 3 chars use the whole string as their own trigram key.
- `indexer.ts` — `buildThaiAddressIndex(RawData, options?)` joins the four tables, skips soft-deleted rows, builds a trigram inverted index (`Map<trigram, Set<recordIndex>>`), a `zipIndex` (`Map<zipCode, number[]>`) for O(1) *exact*-zip lookup, `normTambon` (normalised Thai tambon names, parallel to `records`, used by the search ranker), and `byProvince`/`byAmphure` groupings for the enumeration API. Province and amphure trigrams are pre-computed once per unique parent to avoid redundant normalization. `options.onSkip` receives tambons skipped due to a missing/deleted amphure. `options.validate` (default `true`) runs `validateRawData` first — measured at no detectable cost on the full dataset, so leave it on for consumer-supplied data.
- `search.ts` — `searchThaiAddress(index, query, options?)` extracts trigrams from the normalised query, counts hits per record, scores as `hits/queryTrigrams`, filters by threshold (default 0.4), returns top-N. Ranking is `score` desc → `matchRank` desc → Thai collator on province/amphure/tambon, where `matchRank` is 3/2/1/0 for exact / prefix / substring / no match of the query against `normTambon[idx]`. Without `matchRank` a record matching only its *parent* district ties with the record whose own name is the query. **Never call `localeCompare` with a locale or options argument inside a comparator** — it constructs `Intl.Collator` machinery per call and was measured at 15-27× slowdown; use the module-level `TH_COLLATOR`. The collator tie-break runs only over a bounded window (`max(limit*4, 50)`) after a cheap numeric pre-sort on `(score, matchRank)`.
- `search.ts` zip path — all-digit input ≥ 2 digits goes through `lookupByZipCode`, an **O(n\_zips) prefix scan** (O(1) only for an exact `Map.get`), sorted exact-match-first then ascending. `options.zipLimit` defaults to `Infinity`, not `limit`: 230 of 953 zip codes map to more than 10 tambons, so capping the zip path at the text-autocomplete limit silently hides valid subdistricts.
- `romanize.ts` — `applyRomanizationAliases(normalized)` rewrites common non-RTGS Latin spellings (`lardprao` → `lat phrao`) onto the exact RTGS strings in the dataset. Called by `search.ts` for Latin-script queries only; disable via `options.romanizationAliases: false`. Alias *targets* must be verified against real `name_en` values — a few intentionally map onto typos baked into the dataset (`loburi`, `buogkan`).
- `enumerate.ts` — `listProvinces` / `listAmphures` / `listTambons` for cascade selects, backed by `byProvince`/`byAmphure` rather than scanning `records`.
- `formatter.ts` — converts a `ThaiAddressRecord` into a `ThaiAddressSuggestion`; always emits both `labelTh` and `labelEn`, with `label` following `options.locale` (default `'th'`). `id` is `String(tambonId)` and is used as the key for `selectSuggestion`'s O(1) record lookup
- `resolver.ts` — converts a `ThaiAddressRecord` into a `ResolvedThaiAddress` with both Thai-conventional aliases (tambon/amphure/province) and English-conventional aliases (subdistrict/district/postalCode)

**React integration (`src/react/`):**
- `useThaiAddressAutocomplete` wraps `searchThaiAddress` with debounce (default 200 ms) and manages query/suggestions state
- Returns `{ query, setQuery, setQuerySilent, suggestions, isOpen, selectSuggestion, clear }`. `isOpen` is `query.length > 0 && suggestions.length > 0`.
- `selectSuggestion` does O(1) lookup via `Map<id, ThaiAddressRecord>`, calls `resolveThaiAddress`, fires `onSelect`, and clears suggestions. It returns `null` (it does **not** throw) for an unknown/stale id. `query` is intentionally left unchanged — use `setQuerySilent(label)` to echo the choice back into the input without re-opening the dropdown, or `clear()` to reset it.
- `initialQuery` seeds the input without searching on mount. Two effects can fire a search (the debounced `[query]` one and the immediate `[index]` one); `initialQuery` and `setQuerySilent` must suppress **both**, and `setQuerySilent('')` must not leave the suppression flag armed.

**Build output (`tsup`):**
- Dual ESM + CJS, `react` and `react-dom` are external peers (optional peer dependency)
- Three entries: `src/index.ts` (core, React-free), `src/react/index.ts`, `src/data/index.ts`
- The react entry gets its `"use client"` directive from an `onSuccess` post-processing step, not `banner` — esbuild ignores module-level directives when bundling and warns about it

**Tests:** Vitest with jsdom environment, test files live in `src/__tests__/`.

## Releasing

This project uses [release-please](https://github.com/googleapis/release-please) with GitHub Actions for automated versioning and changelog generation.

**Commit message format (Conventional Commits):**

| Prefix | Effect |
|--------|--------|
| `feat:` | minor bump (0.2.x → 0.3.0) |
| `fix:` | patch bump (0.2.0 → 0.2.1) |
| `feat!:` or `BREAKING CHANGE:` in footer | major bump (0.x → 1.0.0) |
| `chore:` / `docs:` / `test:` / `refactor:` | no release triggered |

**Release flow:**
1. Push `feat:`/`fix:` commits to `main`
2. release-please bot opens a PR titled `chore(main): release X.Y.Z` with a CHANGELOG draft
3. Review and merge the PR → bot tags the release and publishes to npm automatically

**Required GitHub secret:** `NPM_TOKEN` (Settings → Secrets → Actions)
