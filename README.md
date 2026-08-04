# thaizip

Fast fuzzy autocomplete for Thai addresses — subdistrict, district, province, and postal code. Supports Thai names, English names, and zip code search. No dependencies except an optional React peer.

## Install

```bash
npm install thaizip
```

## Package exports

| import path | contents |
|---|---|
| `thaizip` | core functions + types (no React code) |
| `thaizip/react` | `useThaiAddressAutocomplete` hook + types (ships `"use client"`) |
| `thaizip/data` | `loadDefaultIndex`, `clearDefaultIndex` |

## Vanilla JS / TypeScript

```ts
import { loadDefaultIndex } from 'thaizip/data'
import { searchThaiAddress, formatThaiAddressSuggestion, resolveThaiAddress } from 'thaizip'

const index = await loadDefaultIndex() // ~40ms of synchronous work on first call, cached after

const results = searchThaiAddress(index, 'ลาดพร้าว')
const results2 = searchThaiAddress(index, 'chiang mai')
const results3 = searchThaiAddress(index, '10900')

// For dropdown display
const suggestion = formatThaiAddressSuggestion(results[0])
// label:   'ลาดพร้าว > เขตลาดพร้าว > กรุงเทพมหานคร 10230'
// labelTh: same as above — always present
// labelEn: 'Lat Phrao > Khet Lat Phrao > Bangkok 10230' — always present

// English-facing UI: pick the locale for `label`
const en = formatThaiAddressSuggestion(results[0], { locale: 'en' })

// For saving after user selects
const resolved = resolveThaiAddress(results[0])
// { tambon, tambonEn, amphure, amphureEn, province, provinceEn, zipCode, subdistrict, district, postalCode, ... }
```

`searchThaiAddress` options (all optional):

```ts
searchThaiAddress(index, query, {
  limit: 10,                 // default: 10 — applies to text queries
  threshold: 0.4,            // match quality 0–1, default: 0.4
  zipLimit: Infinity,        // default: unlimited — see "Postal code lookup"
  romanizationAliases: true, // default: true — see "English / romanized queries"
})
```

Results are ranked by trigram score, then by how well the query matches the subdistrict's **own** name (exact → prefix → substring), then alphabetically. That second key matters: without it a subdistrict that merely sits *inside* เขตลาดพร้าว outranks ตำบลลาดพร้าว itself.

> Searching a combined text + zip code in one query (e.g. `"ลาดพร้าว 10900"`) is not supported — search by name or zip code separately.

## Postal code lookup

A single Thai postal code can cover many subdistricts — `45000` covers 33 of them, and 230 of the 953 codes cover more than 10. `zipLimit` therefore defaults to unlimited so a zip search never silently hides valid subdistricts:

```ts
searchThaiAddress(index, '45000')                 // all 33
searchThaiAddress(index, '45000', { zipLimit: 5 }) // cap it yourself if your UI needs to

// Or use the dedicated helper — exact + prefix match, unlimited by default:
import { lookupByZipCode } from 'thaizip'
lookupByZipCode(index, '45000')
lookupByZipCode(index, '450')     // prefix search
```

## English / romanized queries

The dataset indexes the official RTGS transliteration, so `bang rak` and `chatuchak` work out of the box. Common non-RTGS spellings people actually type are mapped onto their RTGS form first:

```ts
searchThaiAddress(index, 'lardprao')   // → ลาดพร้าว   (alias for 'lat phrao')
searchThaiAddress(index, 'ladkrabang') // → ลาดกระบัง  (alias for 'lat krabang')
searchThaiAddress(index, 'krungthep')  // → Bangkok records

// Opt out if you want strict RTGS-only matching:
searchThaiAddress(index, 'lardprao', { romanizationAliases: false }) // → []
```

The alias table covers Bangkok's 50 districts and the major provinces. It is a curated dictionary, not a general transliterator — an unlisted spelling still misses.

## Cascade dropdowns (province → district → subdistrict)

```ts
import { listProvinces, listAmphures, listTambons } from 'thaizip'

listProvinces(index)                 // 77 provinces, sorted by Thai name
listAmphures(index, provinceId)      // districts of that province
listTambons(index, amphureId)        // subdistricts, each with its zipCode
```

These read pre-built groupings on the index rather than scanning all 7,385 records, so they are cheap enough to call on every dropdown change. An unknown id returns `[]`.

## React

```tsx
import { useState, useEffect } from 'react'
import { loadDefaultIndex } from 'thaizip/data'
import { useThaiAddressAutocomplete } from 'thaizip/react'
import type { TrigramIndex, ResolvedThaiAddress } from 'thaizip/react'

function AddressPage() {
  const [index, setIndex] = useState<TrigramIndex | null>(null)
  useEffect(() => { loadDefaultIndex().then(setIndex) }, [])
  if (!index) return <p>Loading…</p>
  return <AddressForm index={index} />
}

function AddressForm({ index }: { index: TrigramIndex }) {
  const { query, setQuery, setQuerySilent, suggestions, isOpen, selectSuggestion, clear } =
    useThaiAddressAutocomplete({ index, limit: 10, debounce: 200, threshold: 0.4 })

  const [address, setAddress] = useState<ResolvedThaiAddress | null>(null)

  return (
    <div>
      <input value={query} onChange={(e) => setQuery(e.target.value)} />
      {isOpen && (
        <ul>
          {suggestions.map((s) => (
            <li key={s.id} onClick={() => setAddress(selectSuggestion(s))}>
              {s.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

Hook return values:

| value | type | description |
|---|---|---|
| `query` | `string` | current input value |
| `setQuery` | `(v: string) => void` | update query and search |
| `setQuerySilent` | `(v: string) => void` | update query **without** searching or reopening the dropdown |
| `suggestions` | `ThaiAddressSuggestion[]` | dropdown items |
| `isOpen` | `boolean` | `true` when query is non-empty and suggestions exist |
| `selectSuggestion` | `(item) => ResolvedThaiAddress \| null` | select item, clears suggestions (query stays); `null` if the item is stale |
| `clear` | `() => void` | reset query and suggestions |

Hook options: `index`, `limit`, `debounce`, `threshold`, `zipLimit`, `locale`, plus `initialQuery` (seed the input without firing a search on mount) and `onSelect` (called with the resolved address after a successful selection).

### Controlled forms (react-hook-form, Formik)

`selectSuggestion` deliberately leaves `query` alone. To echo the chosen address back into the input, use `setQuerySilent` — plain `setQuery` would immediately re-open the dropdown:

```tsx
const handlePick = (s: ThaiAddressSuggestion) => {
  const address = selectSuggestion(s)
  if (!address) return          // stale item — safe to ignore, it does not throw
  setQuerySilent(s.label)
  form.setValue('address', address)
}
```

Editing a saved address? Pass `initialQuery` instead of calling `setQuery` in an effect:

```tsx
useThaiAddressAutocomplete({ index, initialQuery: saved.label, onSelect: (a) => form.setValue('address', a) })
```

### Accessibility

The hook is headless: it owns query/suggestion state only. Keyboard navigation and ARIA combobox semantics (`role="combobox"`, `aria-expanded`, `aria-activedescendant`, an accessible name on the input, and a live region announcing the result count) are yours to implement — the minimal example above is deliberately unstyled and is **not** an accessible reference implementation. `npx react-thaizip add autocomplete` scaffolds a component with the keyboard and ARIA wiring already in place.

## Node.js / Express

```ts
import express from 'express'
import { loadDefaultIndex } from 'thaizip/data'
import { searchThaiAddress, formatThaiAddressSuggestion } from 'thaizip'

const app = express()
const index = await loadDefaultIndex()

app.get('/address/search', (req, res) => {
  const q = String(req.query.q ?? '')
  res.json(searchThaiAddress(index, q, { limit: 10 }).map(formatThaiAddressSuggestion))
})
```

## Custom index

```ts
import { buildThaiAddressIndex } from 'thaizip'

const index = buildThaiAddressIndex(
  { provinces: [...], amphures: [...], tambons: [...] },
  {
    onSkip: (tambon) => console.warn('skipped:', tambon.id),
    validate: true, // default — throws a descriptive TypeError on malformed input
  }
)
```

Raw data shape: `RawData`, `RawProvince`, `RawAmphure`, `RawTambon` — all exported from `thaizip`.

Input is validated by default, so a stray non-string field fails with `[thaizip] tambon 100404: expected string for name_th, got number` instead of crashing deep inside the normalizer. Validation costs nothing measurable on a full-size dataset; pass `validate: false` only if your data is already trusted. You can also check data without building an index:

```ts
import { validateRawData } from 'thaizip'
validateRawData({ provinces, amphures, tambons }) // throws on the first bad field
```

To reset the default index singleton (useful for test isolation):

```ts
import { clearDefaultIndex } from 'thaizip/data'
clearDefaultIndex()
```

## Types

```ts
type ThaiAddressSuggestion = {
  id: string
  label: string       // "subdistrict > district > province XXXXX", per `locale`
  labelTh: string     // always the Thai label
  labelEn: string     // always the English label
  tambon: string;     tambonEn: string
  amphure: string;    amphureEn: string
  province: string;   provinceEn: string
  zipCode: string
}

type ResolvedThaiAddress = {
  tambon: string;        tambonEn: string        // alias: subdistrict / subdistrictEn
  amphure: string;       amphureEn: string       // alias: district / districtEn
  province: string;      provinceEn: string
  zipCode: string                                // alias: postalCode
  subdistrict: string;   subdistrictEn: string
  district: string;      districtEn: string
  postalCode: string
}
```

## Data

Covers Thailand's administrative divisions: 77 provinces, 918 districts, 7,385 subdistricts. Subdistricts whose parent district or province has been soft-deleted are excluded from the default index automatically.

## License

MIT
