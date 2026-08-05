---
title: data
description: API reference for loadDefaultIndex, clearDefaultIndex, buildThaiAddressIndex, and validateRawData
---

The functions on this page come from two different entry points — note the import path in each section:

- `loadDefaultIndex` and `clearDefaultIndex` come from **`thaizip/data`** (the bundled national dataset, ~132 KB gzip, split into its own entry point so it can be tree-shaken)
- `buildThaiAddressIndex` and `validateRawData` come from **`thaizip`** (the core, dataset-agnostic entry point)

## `loadDefaultIndex`

```ts
function loadDefaultIndex(): Promise<TrigramIndex>
```

`import { loadDefaultIndex } from 'thaizip/data'`

Lazily loads the bundled national address dataset (`src/data/defaultData.ts`) via a dynamic `import()`, then builds a `TrigramIndex` with `buildThaiAddressIndex({ validate: false })`. The result is cached as a module-level singleton.

### Parameters

None.

### Returns

`Promise<TrigramIndex>` — resolves to the same index every time after the first successful load (module-level singleton)

### Notes

- The first call costs roughly 30–40 ms of synchronous main-thread work (building the actual index, after `import()` resolves) — call it at component mount or route load, not on the user's first keystroke
- Multiple concurrent calls (e.g. from several components) share the same not-yet-resolved `Promise` — the index is never built twice
- The index is built with `{ validate: false }` because the bundled data has already been validated at generate time

### Example

```ts
import { loadDefaultIndex } from 'thaizip/data'
import { searchThaiAddress } from 'thaizip'

const index = await loadDefaultIndex()
searchThaiAddress(index, 'ลาดพร้าว')
```

## `clearDefaultIndex`

```ts
function clearDefaultIndex(): void
```

`import { clearDefaultIndex } from 'thaizip/data'`

Clears the singleton cached by `loadDefaultIndex`, so the next call to `loadDefaultIndex()` builds a fresh index.

### Parameters

None.

### Returns

`void`

### Notes

- Mainly used in tests, to isolate state between test cases so one test doesn't see an index cached by a previous one
- If a `loadDefaultIndex()` call is already in flight when `clearDefaultIndex()` runs, that in-flight load's result will not be committed to the (new) cache once it finishes — this guards against a race between a pending load and a clear

### Example

```ts
import { loadDefaultIndex, clearDefaultIndex } from 'thaizip/data'

afterEach(() => {
  clearDefaultIndex()
})
```

## `buildThaiAddressIndex`

```ts
function buildThaiAddressIndex(data: RawData, options?: BuildIndexOptions): TrigramIndex
```

`import { buildThaiAddressIndex } from 'thaizip'`

Builds a `TrigramIndex` from your own data (instead of the bundled default) — joins the `provinces`/`amphures`/`tambons` tables, skips soft-deleted rows, and builds the trigram inverted index, `zipIndex`, `normTambon`/`normTambonEn`, and the `byProvince`/`byAmphure` groupings used by the enumeration API.

### Parameters

| Name | Type | Default | Description |
|---|---|---|---|
| `data` | `RawData` | — (required) | The four raw tables (`geographies?`, `provinces`, `amphures`, `tambons`) — see field details on the [types](../types/) page |
| `options?` | `BuildIndexOptions` | `undefined` | Index-building options |

**`BuildIndexOptions`:**

| Name | Type | Default | Description |
|---|---|---|---|
| `onSkip?` | `(tambon: RawTambon) => void` | `undefined` | Called for each tambon skipped because its `amphure_id` points at a district that doesn't exist or was soft-deleted (also covers the case where the district itself is found but its `province_id` points at a province that doesn't exist or was deleted) |
| `validate?` | `boolean` | `true` | Whether to run `validateRawData(data)` before building. Measured against the full dataset, this has no detectable performance cost, so it's worth leaving on for any data you didn't generate yourself |

### Returns

`TrigramIndex` — see the full shape on the [types](../types/) page

### Notes

- Rows where `deleted_at` is not `null` in any of the three tables are skipped (provinces/amphures are filtered out of the lookup maps up front; tambons are skipped directly with a `continue`)
- A tambon whose `amphure_id` can't be found in the map of non-deleted districts, or whose district's `province_id` can't be found in the map of non-deleted provinces, is skipped and passed to `onSkip` (if provided) in either case
- Province and district trigrams are precomputed once per unique parent, not recomputed for every tambon that shares the same parent

### Example

```ts
import { buildThaiAddressIndex } from 'thaizip'

const index = buildThaiAddressIndex(
  { provinces, amphures, tambons },
  { onSkip: (tambon) => console.warn('skipped', tambon.name_th) },
)
```

## `validateRawData`

```ts
function validateRawData(data: RawData): void
```

`import { validateRawData } from 'thaizip'`

Checks that a `RawData` payload has the runtime shapes `buildThaiAddressIndex` expects. Intended for consumers building an index from their own data (CSV, CMS, private datasets) who want a readable error up front instead of an opaque crash deep in the normalizer, or silent `"undefined"` labels.

### Parameters

| Name | Type | Default | Description |
|---|---|---|---|
| `data` | `RawData` | — (required) | The raw data to validate |

### Returns

`void` — returns nothing if everything is valid

### Notes

- Throws a `TypeError` (message prefixed `[thaizip]`) as soon as it hits the first bad field, naming the table, the offending row's `id`, the field, and the actual type found — e.g. `[thaizip] province 12: expected string for name_th, got number`
- Checks: `provinces[].id` (`number`), `name_th`/`name_en` (`string`); `amphures[].id` (`number`), `name_th`/`name_en` (`string`), `province_id` (`number`); `tambons[].id` (`number`), `name_th`/`name_en` (`string`), `zip_code` (`string` or `number`), `amphure_id` (`number`)
- **Does not** filter soft-deleted rows (`deleted_at`) first — every row supplied is checked, deleted or not
- `buildThaiAddressIndex` calls this automatically whenever `options.validate !== false`

### Example

```ts
import { validateRawData } from 'thaizip'

try {
  validateRawData({ provinces, amphures, tambons })
} catch (err) {
  // TypeError: [thaizip] tambon 100101: expected number for amphure_id, got string
}
```
