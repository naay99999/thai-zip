# Changelog

## [0.7.2](https://github.com/naay99999/thai-zip/compare/thaizip-v0.7.1...thaizip-v0.7.2) (2026-08-04)


### Bug Fixes

* correct repository/homepage/bugs URLs to match GitHub repo ([c27b90c](https://github.com/naay99999/thai-zip/commit/c27b90cf6e8368cd220eca854c3741b745b47ffc))

## [0.7.1](https://github.com/naay99999/thai-zip/compare/thaizip-v0.7.0...thaizip-v0.7.1) (2026-08-04)


### Bug Fixes

* sync package-lock.json with package.json ([2dcdfc1](https://github.com/naay99999/thai-zip/commit/2dcdfc1043871c94e084ad66bff20a2ae6568def))

## [0.7.0](https://github.com/naay99999/thai-zip/compare/thaizip-v0.6.0...thaizip-v0.7.0) (2026-08-04)


### ⚠ BREAKING CHANGES

* selectSuggestion returns ResolvedThaiAddress | null instead of throwing on an unknown suggestion id. SearchOptions.zipLimit defaults to Infinity, so all-digit queries can now return more rows than `limit`. TrigramIndex gained required fields (normTambon, normTambonEn, byProvince, byAmphure) and ThaiAddressSuggestion gained labelTh/labelEn, which affects callers that construct either type by hand.

### Features

* rank exact matches first, unlimited zip lookup, English aliases, cascade API ([ac36212](https://github.com/naay99999/thai-zip/commit/ac3621210b79785b631ede13bf50a95b9e30b2c5))

## [0.6.0](https://github.com/naay99999/thai-zip/compare/thaizip-v0.5.1...thaizip-v0.6.0) (2026-06-30)


### ⚠ BREAKING CHANGES

* useThaiAddressAutocomplete moved from thaizip → thaizip/react clearDefaultIndex removed from thaizip main entry → thaizip/data

### Features

* v1.0.0 — thaizip/react subpath, loader reliability, search fixes ([f1432d8](https://github.com/naay99999/thai-zip/commit/f1432d8c1a5de44a2acc7ed5e04b5c648029fe63))

## [0.5.1](https://github.com/naay99999/thai-zip/compare/thaizip-v0.5.0...thaizip-v0.5.1) (2026-06-02)


### Features

* **data:** add clearDefaultIndex() to reset the singleton cache ([a83fd06](https://github.com/naay99999/thai-zip/commit/a83fd06acaeb5155593e23b23eed83c3b4dc9579))

## [0.5.0](https://github.com/naay99999/thai-zip/compare/thaizip-v0.4.0...thaizip-v0.5.0) (2026-05-04)


### ⚠ BREAKING CHANGES

* replace sync defaultIndex with async loadDefaultIndex (132KB gzip vs 630KB)
* add English name fields to ThaiAddressSuggestion and ResolvedThaiAddress

### Features

* add English name fields to ThaiAddressSuggestion and ResolvedThaiAddress ([4212981](https://github.com/naay99999/thai-zip/commit/4212981c7af34fe79f0c5682c0c415804202b3c9))
* add typecheck script ([a6a15c8](https://github.com/naay99999/thai-zip/commit/a6a15c81dc714eeecd01dde059f8f58b43d2dcd3))
* make geographies optional in RawData type ([a6a15c8](https://github.com/naay99999/thai-zip/commit/a6a15c81dc714eeecd01dde059f8f58b43d2dcd3))
* query length guard — queries &gt;300 chars return [] for server-side safety ([a6a15c8](https://github.com/naay99999/thai-zip/commit/a6a15c81dc714eeecd01dde059f8f58b43d2dcd3))
* replace sync defaultIndex with async loadDefaultIndex (132KB gzip vs 630KB) ([3032ae3](https://github.com/naay99999/thai-zip/commit/3032ae31ae50c5a5c04d51e34b7b2ce994781dca))
* secondary sort for equal-score results (province → amphure → tambon) ([a6a15c8](https://github.com/naay99999/thai-zip/commit/a6a15c81dc714eeecd01dde059f8f58b43d2dcd3))


### Bug Fixes

* emit console.warn on orphaned tambons instead of silently dropping ([a6a15c8](https://github.com/naay99999/thai-zip/commit/a6a15c81dc714eeecd01dde059f8f58b43d2dcd3))
* guard against null/undefined index in searchThaiAddress ([a6a15c8](https://github.com/naay99999/thai-zip/commit/a6a15c81dc714eeecd01dde059f8f58b43d2dcd3))
* trim whitespace after stripping Thai address prefix ([dc8579b](https://github.com/naay99999/thai-zip/commit/dc8579b9c5b36b69a409be6662d9d687122814a3))

## [0.4.0](https://github.com/naay99999/thai-zip/compare/thaizip-v0.3.0...thaizip-v0.4.0) (2026-05-05)

### Features

* make `geographies` optional in `RawData` — custom-index callers no longer need to supply the unused field ([#audit](https://github.com/naay99999/thai-zip))
* add secondary sort for equal-score results — deterministic ordering by province → amphure → tambon name when trigram scores tie ([#audit](https://github.com/naay99999/thai-zip))
* add query length guard (>300 chars) — `searchThaiAddress` returns `[]` for oversized inputs, safe for server-side use ([#audit](https://github.com/naay99999/thai-zip))
* add `typecheck` script to package.json ([#audit](https://github.com/naay99999/thai-zip))

### Bug Fixes

* guard against null/undefined index in `searchThaiAddress` — returns `[]` instead of throwing TypeError ([#audit](https://github.com/naay99999/thai-zip))
* emit `console.warn` when active tambons reference deleted amphures, rather than silently dropping them from the index ([#audit](https://github.com/naay99999/thai-zip))

## [0.3.0](https://github.com/naay99999/thai-zip/compare/thaizip-v0.2.1...thaizip-v0.3.0) (2026-04-21)


### ⚠ BREAKING CHANGES

* replace sync defaultIndex with async loadDefaultIndex (132KB gzip vs 630KB)
* add English name fields to ThaiAddressSuggestion and ResolvedThaiAddress

### Features

* add English name fields to ThaiAddressSuggestion and ResolvedThaiAddress ([4212981](https://github.com/naay99999/thai-zip/commit/4212981c7af34fe79f0c5682c0c415804202b3c9))
* replace sync defaultIndex with async loadDefaultIndex (132KB gzip vs 630KB) ([3032ae3](https://github.com/naay99999/thai-zip/commit/3032ae31ae50c5a5c04d51e34b7b2ce994781dca))

## [0.2.1](https://github.com/naay99999/thai-address-lib/compare/thaizip-v0.2.0...thaizip-v0.2.1) (2026-04-07)


### Bug Fixes

* trim whitespace after stripping Thai address prefix ([dc8579b](https://github.com/naay99999/thai-address-lib/commit/dc8579b9c5b36b69a409be6662d9d687122814a3))

## [0.2.0](https://github.com/naay99999/thai-address-lib/compare/v0.1.0...v0.2.0) (2026-04-07)

### ⚠ BREAKING CHANGES

* `geographyId` and `geographyNameTh` fields removed from `ThaiAddressRecord`

### Features

* add `zipIndex` to `TrigramIndex` for O(1) zip code prefix lookup ([#audit](https://github.com/naay99999/thai-address-lib))
* sort zip code results by exact match first, then ascending ([#audit](https://github.com/naay99999/thai-address-lib))

### Bug Fixes

* eliminate double normalisation on every search call ([#audit](https://github.com/naay99999/thai-address-lib))
* replace O(n) `findIndex` in React hook with O(1) Map lookup ([#audit](https://github.com/naay99999/thai-address-lib))

### Performance Improvements

* compact JSON in generated index — data bundle reduced by ~900 KB ([#audit](https://github.com/naay99999/thai-address-lib))
* remove `as const` on generated records array to avoid ~96k TS literal-type inferences ([#audit](https://github.com/naay99999/thai-address-lib))
* remove unused `geographyId`/`geographyNameTh` fields — saves ~8.6% from data bundle ([#audit](https://github.com/naay99999/thai-address-lib))

### Miscellaneous

* add raw JSON shape validation in build pipeline ([#audit](https://github.com/naay99999/thai-address-lib))
* remove raw `data/` directory from published npm package ([#audit](https://github.com/naay99999/thai-address-lib))

## 0.1.0 (2026-04-07)

### Features

* initial release — trigram-based Thai address autocomplete library (`thaizip`)
* headless vanilla-JS API: `buildThaiAddressIndex`, `searchThaiAddress`, `formatThaiAddressSuggestion`, `resolveThaiAddress`
* optional React hook: `useThaiAddressAutocomplete` with debounce support
* pre-built `defaultIndex` exported from `thaizip/data` for zero build-cost at runtime
* dual ESM + CJS build output via tsup
