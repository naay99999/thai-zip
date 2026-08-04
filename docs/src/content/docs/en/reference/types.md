---
title: types
description: Reference for every type thaizip exports — ThaiAddressRecord, TrigramIndex, SearchOptions, and more
---

`import type { ... } from 'thaizip'`

Every type on this page is exported from the main `thaizip` entry point, except `UseThaiAddressAutocompleteOptions`, which comes from `thaizip/react` (`import type { UseThaiAddressAutocompleteOptions } from 'thaizip/react'`) — see the full hook reference on the [react](../react/) page.

## `ThaiAddressRecord`

A single address record (one tambon) — the base unit returned by `searchThaiAddress`, `lookupByZipCode`, and every enumeration function.

```ts
type ThaiAddressRecord = {
  provinceId: number
  provinceNameTh: string
  provinceNameEn: string

  amphureId: number
  amphureNameTh: string
  amphureNameEn: string

  tambonId: number
  tambonNameTh: string
  tambonNameEn: string

  zipCode: string
}
```

All 10 fields: `provinceId`, `provinceNameTh`, `provinceNameEn`, `amphureId`, `amphureNameTh`, `amphureNameEn`, `tambonId`, `tambonNameTh`, `tambonNameEn`, `zipCode` — `zipCode` is always a `string` (never a `number`), even though the raw data's `RawTambon.zip_code` can be `string | number`.

## `TrigramIndex`

The search index shape, built only by `buildThaiAddressIndex` or `loadDefaultIndex` — treat it as opaque and **never construct one by hand**.

```ts
type TrigramIndex = {
  map: Map<string, Set<number>>
  records: ThaiAddressRecord[]
  zipIndex: Map<string, number[]>
  normTambon: string[]
  normTambonEn: string[]
  byProvince: Map<number, number[]>
  byAmphure: Map<number, number[]>
}
```

- `map` — the inverted index from a 3-character trigram to the set of matching `records` indices
- `records` — every record (after soft-deleted and orphaned rows are filtered out)
- `zipIndex` — postal code to the array of `records` indices carrying that code (used by `lookupByZipCode`)
- `normTambon` / `normTambonEn` — normalized tambon names (Thai/English), parallel to `records` (same index), used by the search ranker
- `byProvince` / `byAmphure` — `records` indices grouped by `provinceId`/`amphureId` (in insertion order), used by `listProvinces`/`listAmphures`/`listTambons`

## `ThaiAddressSuggestion`

A result after it's been through `formatThaiAddressSuggestion`, ready to render in a dropdown.

```ts
type ThaiAddressSuggestion = {
  id: string
  label: string
  labelTh: string
  labelEn: string
  tambon: string
  tambonEn: string
  amphure: string
  amphureEn: string
  province: string
  provinceEn: string
  zipCode: string
}
```

See field-by-field behavior on the [formatter](../formatter/) page.

## `ResolvedThaiAddress`

A resolved address, carrying two sets of field names (Thai/English) — returned by `resolveThaiAddress` and by `useThaiAddressAutocomplete`'s `selectSuggestion`.

```ts
type ResolvedThaiAddress = {
  tambon: string
  tambonEn: string
  amphure: string
  amphureEn: string
  province: string
  provinceEn: string
  zipCode: string
  subdistrict: string
  subdistrictEn: string
  district: string
  districtEn: string
  postalCode: string
}
```

See behavior details on the [resolver](../resolver/) page.

## `ProvinceSummary` / `AmphureSummary` / `TambonSummary`

The types returned by the enumeration functions (`listProvinces`/`listAmphures`/`listTambons`) — see details on the [enumerate](../enumerate/) page.

```ts
type ProvinceSummary = {
  id: number
  nameTh: string
  nameEn: string
}

type AmphureSummary = {
  id: number
  nameTh: string
  nameEn: string
  provinceId: number
}

type TambonSummary = {
  id: number
  nameTh: string
  nameEn: string
  amphureId: number
  zipCode: string
}
```

## `SearchOptions`

Options for `searchThaiAddress` and `lookupByZipCode` — see defaults and behavior on the [search](../search/) page.

```ts
type SearchOptions = {
  limit?: number
  threshold?: number
  zipLimit?: number
  romanizationAliases?: boolean
}
```

## `BuildIndexOptions`

Options for `buildThaiAddressIndex` — see details on the [data](../data/) page.

```ts
type BuildIndexOptions = {
  onSkip?: (tambon: RawTambon) => void
  validate?: boolean
}
```

## `RawData` and the raw row types

The shape `buildThaiAddressIndex`/`validateRawData` accept — fields are snake_case, matching the source government data (unlike `ThaiAddressRecord`, which is camelCase).

```ts
type RawData = {
  geographies?: RawGeography[] // optional — entirely unused by buildThaiAddressIndex
  provinces: RawProvince[]
  amphures: RawAmphure[]
  tambons: RawTambon[]
}

type RawGeography = {
  id: number
  name: string
  deleted_at: string | null
}

type RawProvince = {
  id: number
  name_th: string
  name_en: string
  geography_id: number
  deleted_at: string | null
}

type RawAmphure = {
  id: number
  name_th: string
  name_en: string
  province_id: number
  deleted_at: string | null
}

type RawTambon = {
  id: number
  zip_code: number | string
  name_th: string
  name_en: string
  amphure_id: number
  deleted_at: string | null
}
```

`deleted_at` is a soft-delete marker — either a date string or `null`. Rows where `deleted_at` is not `null` are skipped when the index is built (see the [data](../data/) page for details).

## A couple of smaller supporting types

Two small types used to build the ones above:

```ts
/** Language for a formatted label field */
type AddressLocale = 'th' | 'en'

/** Options for formatThaiAddressSuggestion */
type FormatSuggestionOptions = {
  locale?: AddressLocale
}
```
