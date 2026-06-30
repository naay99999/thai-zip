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
- `thaizip` — core functions + React hook
- `thaizip/data` — exports `loadDefaultIndex()` (async, lazy-loads compact tuple arrays from `defaultData.ts` and builds the TrigramIndex at runtime; separate export so tree-shakers can isolate it)

**Data pipeline:**
- Raw JSON files in `data/` (thai_geographies, thai_provinces, thai_amphures, thai_tambons) are the source of truth
- `npm run generate-data` (`src/data/generate.ts`) reads raw JSON tables, filters soft-deleted rows *at generate time*, and writes compact tuple arrays to `src/data/defaultData.ts` — the generated file already contains only active records (no `deleted_at` filtering at runtime for the default index)
- Compact tuple formats: `CompactProvince = [id, nameTh, nameEn]`, `CompactAmphure = [id, nameTh, nameEn, provinceId]`, `CompactTambon = [id, nameTh, nameEn, amphureId, zipCode]`
- `loadDefaultIndex()` in `src/data/loader.ts` assembles the `TrigramIndex` at first call and caches the result as a module-level singleton; `clearDefaultIndex()` resets the singleton (exported from both `thaizip` and `thaizip/data` — use in tests to isolate state)

**Search engine (`src/core/`):**
- `normalizer.ts` — strips Thai address prefixes (full-form จังหวัด/อำเภอ/ตำบล/แขวง/เขต and abbreviated จ./อ./ต./ข.) and Thai tone marks, then lowercases; applied to both index and query
- `trigrams.ts` — `extractTrigrams(text)` normalises then extracts; `extractTrigramsNormalized(text)` skips normalisation for callers (e.g. `search.ts`) that already hold a normalised string. Strings shorter than 3 chars use the whole string as their own trigram key.
- `indexer.ts` — `buildThaiAddressIndex(RawData, options?)` joins the four tables, skips soft-deleted rows, builds a trigram inverted index (`Map<trigram, Set<recordIndex>>`), and a `zipIndex` (`Map<zipCode, number[]>`) for O(1) exact-zip lookup. Province and amphure trigrams are pre-computed once per unique parent to avoid redundant normalization. Pass `options.onSkip` to receive a callback for tambons that are skipped due to a missing/deleted amphure.
- `search.ts` — `searchThaiAddress(index, query, options?)` extracts trigrams from the normalised query, counts hits per record, scores as `hits/queryTrigrams`, filters by threshold (default 0.4), returns top-N. Non-digit queries shorter than 3 chars return empty immediately. Zip code queries (all-digit input, ≥ 2 digits) use `zipIndex` (O(n\_zips) prefix scan, O(1) only for exact zip); results are sorted exact-match-first then ascending zip.
- `formatter.ts` — converts a `ThaiAddressRecord` into a `ThaiAddressSuggestion`; `id` is `String(tambonId)` and is used as the key for `selectSuggestion`'s O(1) record lookup
- `resolver.ts` — converts a `ThaiAddressRecord` into a `ResolvedThaiAddress` with both Thai-conventional aliases (tambon/amphure/province) and English-conventional aliases (subdistrict/district/postalCode)

**React integration (`src/react/`):**
- `useThaiAddressAutocomplete` wraps `searchThaiAddress` with debounce (default 200 ms) and manages query/suggestions state
- Returns `{ query, setQuery, suggestions, isOpen, selectSuggestion, clear }`. `isOpen` is `query.length > 0 && suggestions.length > 0`.
- `selectSuggestion` does O(1) lookup via `Map<id, ThaiAddressRecord>`, calls `resolveThaiAddress`, and clears suggestions. `query` is intentionally left unchanged — call `clear()` to reset the input too.

**Build output (`tsup`):**
- Dual ESM + CJS, `react` and `react-dom` are external peers (optional peer dependency)
- Entry: `src/index.ts` re-exports everything consumers need
- CJS consumers cannot tree-shake the React hook out of `dist/index.cjs`; use the ESM build for tree-shaking

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
