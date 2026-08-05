---
title: search
description: API reference for searchThaiAddress, lookupByZipCode, and the helper functions behind them
---

`import { searchThaiAddress, lookupByZipCode } from 'thaizip'`

## `searchThaiAddress`

```ts
function searchThaiAddress(
  index: TrigramIndex,
  query: string,
  options?: SearchOptions,
): ThaiAddressRecord[]
```

Fuzzy address search by subdistrict/district/province name (Thai or English) or postal code. Returns `ThaiAddressRecord[]` directly — no extra transformation needed before use.

### Parameters

| Name | Type | Default | Description |
|---|---|---|---|
| `index` | `TrigramIndex` | — (required) | An index built by `buildThaiAddressIndex` or `loadDefaultIndex` |
| `query` | `string` | — (required) | The search text, or a postal code (all digits, at least 2) |
| `options?` | `SearchOptions` | `undefined` | Additional options (see table below) |

**`SearchOptions`:**

| Name | Type | Default | Description |
|---|---|---|---|
| `limit?` | `number` | `10` | Caps the number of results — only applies to text queries, not postal-code queries |
| `threshold?` | `number` | `0.4` | Minimum score (0–1) a result must reach to count as a match — only applies to text queries |
| `zipLimit?` | `number` | `Infinity` | Caps the number of results when the query is all digits. Unlimited by default because a single postal code can map to dozens of tambons |
| `romanizationAliases?` | `boolean` | `true` | Expands non-RTGS English spellings (e.g. `lardprao`) to match what's in the dataset before searching — only applies to Latin-script queries |

### Returns

`ThaiAddressRecord[]`, sorted by relevance (see Ranking below). Always returns an empty array `[]` when nothing matches — never throws.

### Notes

- Returns `[]` immediately if `index` or `query` is empty/falsy, if `query.length > 1000` before normalization, or if the normalized text exceeds 300 characters
- `query` is always run through `normalizeThaiAddressText` before matching (see below)
- If the normalized text is all digits (`/^\d+$/`) and at least 2 digits long, it's automatically routed to `lookupByZipCode`, forwarding only `zipLimit` (`limit`, `threshold`, and `romanizationAliases` have no effect on this path) — an all-digit string shorter than 2 digits returns `[]`
- Normalized text shorter than 3 characters (and not a postal code) always returns `[]`, since trigrams from a string shorter than 3 chars would match meaninglessly
- If the normalized query contains a Latin letter (`/[a-z]/i`) and `romanizationAliases !== false`, `applyRomanizationAliases` runs before trigram extraction
- **Ranking** happens in three passes, in order: (1) `score = hits / queryTrigrams.size` descending, (2) `matchRank` descending — `3` when the query exactly matches the tambon's own name (Thai or English), `2` for a prefix match, `1` for a substring match, `0` when it doesn't match the tambon's own name at all (only matched via its parent district/province), (3) Thai-locale sort on `provinceNameTh` → `amphureNameTh` → `tambonNameTh` using a module-level cached `Intl.Collator('th')` (never constructed inside the loop)
- For performance, step (3) (the collator tie-break) only runs over the top window of `Math.max(limit * 4, 50)` results after a cheap numeric pre-sort on (1)+(2) — not over the full result set

### Example

```ts
import { searchThaiAddress } from 'thaizip'

searchThaiAddress(index, 'ลาดพร้าว', { limit: 5 })
searchThaiAddress(index, 'bang rak')
searchThaiAddress(index, '10500') // automatically routed to the zip path
```

## `lookupByZipCode`

```ts
function lookupByZipCode(
  index: TrigramIndex,
  zip: string,
  options?: SearchOptions,
): ThaiAddressRecord[]
```

Looks up records by postal code directly (exact or prefix match). `searchThaiAddress` calls this automatically when the query is all digits, but you can call it directly too.

### Parameters

| Name | Type | Default | Description |
|---|---|---|---|
| `index` | `TrigramIndex` | — (required) | The index to search |
| `zip` | `string` | — (required) | A full or partial postal code. Must be all digits, at least 2 characters long, or `[]` is returned |
| `options?` | `SearchOptions` | `undefined` | Only the `zipLimit` field is used; the rest are ignored |

### Returns

`ThaiAddressRecord[]`, with records whose `zipCode` exactly matches `zip` sorted first, followed by prefix matches in ascending order, then truncated to `options.zipLimit` (default `Infinity` — **not** `limit`)

### Notes

- The lookup scans every postal code in `index.zipIndex` and checks whether it starts with `zip` (`startsWith`) — this is always the case, whether `zip` is a full 5-digit code or a partial prefix. Its time complexity is therefore always O(total postal codes in the index), never O(1), even for a full code
- Results are **not** capped by `options.limit` — only `zipLimit`, since a single postal code can legitimately map to dozens of tambons (e.g. `45000` maps to 33)
- Returns `[]` if `index` or `zip` is empty, or if `zip` fails `/^\d+$/` or is shorter than 2 characters

### Example

```ts
import { lookupByZipCode } from 'thaizip'

lookupByZipCode(index, '45000')              // exact match first
lookupByZipCode(index, '450')                // prefix scan
lookupByZipCode(index, '45000', { zipLimit: 10 })
```

## Helper functions

These two functions run internally as part of `searchThaiAddress`'s pipeline and are exported separately in case you need them on their own (for example, normalizing text before storing it, or expanding an alias yourself).

### `normalizeThaiAddressText`

```ts
function normalizeThaiAddressText(input: string): string
```

Strips Thai address prefixes from the start of the text — both full-form (`จังหวัด`/`อำเภอ`/`ตำบล`/`แขวง`/`เขต`) and abbreviated (`จ.`/`อ.`/`ต.`/`ข.`) — strips Thai tone marks, then lowercases everything. Used both when building the index (against the data) and when searching (against the query), so both sides end up in the same shape.

| Name | Type | Default | Description |
|---|---|---|---|
| `input` | `string` | — (required) | The raw text |

**Returns:** `string` — the normalized text, or `''` if `input` is empty/falsy

```ts
normalizeThaiAddressText('จังหวัดลาดพร้าว') // strips the 'จังหวัด' prefix and tone marks
```

### `applyRomanizationAliases`

```ts
function applyRomanizationAliases(normalized: string): string
```

Rewrites common non-RTGS English spellings (e.g. `lardprao`, `krungthep`) onto the exact RTGS string that actually appears in the dataset, before trigram extraction. Only applies to Latin-script queries (`searchThaiAddress` calls it automatically when `romanizationAliases !== false`).

| Name | Type | Default | Description |
|---|---|---|---|
| `normalized` | `string` | — (required) | Text already run through `normalizeThaiAddressText` (lowercased, prefixes/tone marks already stripped) |

**Returns:** `string` — if `normalized` matches a key in the alias dictionary, returns the mapped RTGS string immediately. Otherwise it tries stripping a few English administrative words (`district`, `province`, `changwat`, `amphoe`, `amphur`, `sub-district`) and looks the result up again. If it still doesn't match, returns the original text (or the cleaned-up text, if that differs from the original).

### Notes

- Must be a pure function — it runs on every keystroke
- Thai-script text is returned unchanged
- A few aliases deliberately map onto typos that actually exist in the dataset (`loburi`, `buogkan`), because that's what's really indexed

```ts
applyRomanizationAliases('lardprao') // 'lat phrao'
applyRomanizationAliases('ลาดพร้าว') // 'ลาดพร้าว' (Thai text is untouched)
```
