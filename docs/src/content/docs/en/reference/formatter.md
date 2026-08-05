---
title: formatter
description: API reference for formatThaiAddressSuggestion — turns a ThaiAddressRecord into a ThaiAddressSuggestion for display
---

`import { formatThaiAddressSuggestion } from 'thaizip'`

## `formatThaiAddressSuggestion`

```ts
function formatThaiAddressSuggestion(
  record: ThaiAddressRecord,
  options?: FormatSuggestionOptions,
): ThaiAddressSuggestion
```

Converts a `ThaiAddressRecord` (a raw result from `searchThaiAddress`) into a `ThaiAddressSuggestion` with a ready-to-render label for a dropdown.

### Parameters

| Name | Type | Default | Description |
|---|---|---|---|
| `record` | `ThaiAddressRecord` | — (required) | One record from a `searchThaiAddress` result |
| `options?` | `FormatSuggestionOptions` | `undefined` | Controls the language of `label` |

**`FormatSuggestionOptions`:**

| Name | Type | Default | Description |
|---|---|---|---|
| `locale?` | `'th' \| 'en'` | `'th'` | Language for the `label` field — anything other than exactly `'en'` produces a Thai `label` |

### Returns

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

### Notes

- `id` is `String(record.tambonId)` — the same value `selectSuggestion` on `useThaiAddressAutocomplete` uses to look the original record back up in O(1)
- `labelTh` and `labelEn` are always both built, regardless of the chosen `locale` — the format is `` `${tambon} > ${amphure} > ${province} ${zipCode}` `` (using the matching language at all three levels)
- `label` follows `options.locale`: it's `labelEn` only when `options?.locale === 'en'` exactly; every other case (including no `options` at all) yields `labelTh`
- The remaining fields (`tambon`, `amphure`, `province`, `zipCode`, and their `...En` counterparts) are copied straight from `record` with no further transformation

### Example

```ts
import { formatThaiAddressSuggestion, searchThaiAddress } from 'thaizip'

const records = searchThaiAddress(index, 'ลาดพร้าว')
const suggestions = records.map((r) => formatThaiAddressSuggestion(r))
// suggestions[0].label === suggestions[0].labelTh (default locale is 'th')

const enSuggestions = records.map((r) => formatThaiAddressSuggestion(r, { locale: 'en' }))
// enSuggestions[0].label === enSuggestions[0].labelEn
```
