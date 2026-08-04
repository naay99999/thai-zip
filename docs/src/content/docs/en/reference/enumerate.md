---
title: enumerate
description: API reference for listProvinces, listAmphures, and listTambons — the cascade dropdown enumeration API
---

`import { listProvinces, listAmphures, listTambons } from 'thaizip'`

None of these three functions take a text query. They're for building cascade dropdowns (province → district → subdistrict), backed by the `byProvince`/`byAmphure` groupings precomputed when the index was built — no full scan of `records` on every call.

## `listProvinces`

```ts
function listProvinces(index: TrigramIndex): ProvinceSummary[]
```

### Parameters

| Name | Type | Default | Description |
|---|---|---|---|
| `index` | `TrigramIndex` | — (required) | The index to list provinces from |

### Returns

`ProvinceSummary[]` — all 77 provinces (in the bundled default dataset), deduplicated, sorted by Thai name with `Intl.Collator('th')`

```ts
type ProvinceSummary = {
  id: number
  nameTh: string
  nameEn: string
}
```

### Example

```ts
import { listProvinces } from 'thaizip'

const provinces = listProvinces(index) // 77 provinces, sorted by Thai name
```

## `listAmphures`

```ts
function listAmphures(index: TrigramIndex, provinceId: number): AmphureSummary[]
```

### Parameters

| Name | Type | Default | Description |
|---|---|---|---|
| `index` | `TrigramIndex` | — (required) | The index to list districts from |
| `provinceId` | `number` | — (required) | A province `id` (from `ProvinceSummary.id`) |

### Returns

`AmphureSummary[]` — all districts within that province, deduplicated, sorted by Thai name. Returns an empty array `[]` if `provinceId` doesn't exist (e.g. `0` before anything is selected).

```ts
type AmphureSummary = {
  id: number
  nameTh: string
  nameEn: string
  provinceId: number
}
```

### Example

```ts
import { listAmphures } from 'thaizip'

listAmphures(index, 1) // every district in Bangkok
```

## `listTambons`

```ts
function listTambons(index: TrigramIndex, amphureId: number): TambonSummary[]
```

### Parameters

| Name | Type | Default | Description |
|---|---|---|---|
| `index` | `TrigramIndex` | — (required) | The index to list subdistricts from |
| `amphureId` | `number` | — (required) | A district `id` (from `AmphureSummary.id`) |

### Returns

`TambonSummary[]` — all subdistricts within that district, sorted by Thai name, each with its `zipCode` attached. Returns an empty array `[]` if `amphureId` doesn't exist.

```ts
type TambonSummary = {
  id: number
  nameTh: string
  nameEn: string
  amphureId: number
  zipCode: string
}
```

### Example

```ts
import { listTambons } from 'thaizip'

listTambons(index, 1001) // every subdistrict in that district, with zipCode
```

## Shared notes

- All three functions always return an empty array `[]` for an unknown id — never throw — which makes it easy to write UI that resets child selections whenever a parent selection changes
- Each `byAmphure` entry already maps to exactly one tambon, so `listTambons` doesn't need to deduplicate the way `listProvinces`/`listAmphures` do
- If the `index` passed in lacks `byProvince`/`byAmphure` (for example, an older-shaped index built by hand), all three functions fall back to scanning `index.records` in full
