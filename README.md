# thaizip

Fast fuzzy autocomplete for Thai addresses — subdistrict, district, province, and postal code. Supports Thai names, English names, and zip code search. No dependencies except an optional React peer.

## Install

```bash
npm install thaizip
```

## Package exports

| import path | contents |
|---|---|
| `thaizip` | core functions + types |
| `thaizip/react` | `useThaiAddressAutocomplete` hook + types |
| `thaizip/data` | `loadDefaultIndex`, `clearDefaultIndex` |

## Vanilla JS / TypeScript

```ts
import { loadDefaultIndex } from 'thaizip/data'
import { searchThaiAddress, formatThaiAddressSuggestion, resolveThaiAddress } from 'thaizip'

const index = await loadDefaultIndex() // ~200ms first call, cached after

const results = searchThaiAddress(index, 'ลาดพร้าว')
const results2 = searchThaiAddress(index, 'chiang mai')
const results3 = searchThaiAddress(index, '10900')

// For dropdown display
const suggestion = formatThaiAddressSuggestion(results[0])
// { id, label: 'ลาดพร้าว > ลาดพร้าว > กรุงเทพมหานคร 10230', tambon, tambonEn, amphure, amphureEn, province, provinceEn, zipCode }

// For saving after user selects
const resolved = resolveThaiAddress(results[0])
// { tambon, tambonEn, amphure, amphureEn, province, provinceEn, zipCode, subdistrict, district, postalCode, ... }
```

`searchThaiAddress` options (all optional):

```ts
searchThaiAddress(index, query, {
  limit: 10,      // default: 10
  threshold: 0.4, // match quality 0–1, default: 0.4
})
```

> Searching a combined text + zip code in one query (e.g. `"ลาดพร้าว 10900"`) is not supported — search by name or zip code separately.

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
  const { query, setQuery, suggestions, isOpen, selectSuggestion, clear } =
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
| `setQuery` | `(v: string) => void` | update query |
| `suggestions` | `ThaiAddressSuggestion[]` | dropdown items |
| `isOpen` | `boolean` | `true` when query is non-empty and suggestions exist |
| `selectSuggestion` | `(item) => ResolvedThaiAddress` | select item, clears suggestions (query stays) |
| `clear` | `() => void` | reset query and suggestions |

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
  { onSkip: (tambon) => console.warn('skipped:', tambon.id) }
)
```

Raw data shape: `RawData`, `RawProvince`, `RawAmphure`, `RawTambon` — all exported from `thaizip`.

To reset the default index singleton (useful for test isolation):

```ts
import { clearDefaultIndex } from 'thaizip/data'
clearDefaultIndex()
```

## Types

```ts
type ThaiAddressSuggestion = {
  id: string
  label: string       // "subdistrict > district > province XXXXX"
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

Covers Thailand's administrative divisions: 77 provinces, 920 districts, ~7,385 subdistricts. Subdistricts whose parent district or province has been soft-deleted are excluded from the default index automatically.

## License

MIT
