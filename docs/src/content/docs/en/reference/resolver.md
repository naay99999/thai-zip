---
title: resolver
description: API reference for resolveThaiAddress — turns a ThaiAddressRecord into a full address object with two naming conventions
---

`import { resolveThaiAddress } from 'thaizip'`

## `resolveThaiAddress`

```ts
function resolveThaiAddress(record: ThaiAddressRecord): ResolvedThaiAddress
```

Converts a `ThaiAddressRecord` into a `ResolvedThaiAddress` — a full address object carrying two sets of field names at once: the Thai convention (`tambon`/`amphure`/`province`) and the English convention (`subdistrict`/`district`/`postalCode`) — same values either way. Pick whichever you prefer when saving to a database.

### Parameters

| Name | Type | Default | Description |
|---|---|---|---|
| `record` | `ThaiAddressRecord` | — (required) | The record to convert (e.g. a `searchThaiAddress` result, or the value a user picked from a dropdown) |

### Returns

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

### Notes

- No text transformation happens here — it's a direct copy of `record`'s fields into both naming schemes
- Values that are duplicated in pairs: `tambon` = `subdistrict`, `tambonEn` = `subdistrictEn`, `amphure` = `district`, `amphureEn` = `districtEn`, `zipCode` = `postalCode`
- Province is shared between both conventions — `province`/`provinceEn` are the same names in either scheme (there's no separate `state`-style alias)
- Used internally by `selectSuggestion` on `useThaiAddressAutocomplete` to return the resolved address to the caller

### Example

```ts
import { resolveThaiAddress, searchThaiAddress } from 'thaizip'

const [record] = searchThaiAddress(index, 'ลาดพร้าว')
const address = resolveThaiAddress(record)

// Thai convention
address.tambon   // 'ลาดพร้าว'
address.amphure
address.province
address.zipCode

// English convention — same values
address.subdistrict // === address.tambon
address.district    // === address.amphure
address.postalCode  // === address.zipCode
```
