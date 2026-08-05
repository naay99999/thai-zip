---
title: react
description: API reference for useThaiAddressAutocomplete from thaizip/react — every option and every returned value
---

`import { useThaiAddressAutocomplete } from 'thaizip/react'`

## `useThaiAddressAutocomplete`

```ts
function useThaiAddressAutocomplete(options: UseThaiAddressAutocompleteOptions): {
  query: string
  setQuery: (value: string) => void
  setQuerySilent: (value: string) => void
  suggestions: ThaiAddressSuggestion[]
  isOpen: boolean
  selectSuggestion: (item: ThaiAddressSuggestion) => ResolvedThaiAddress | null
  clear: () => void
}
```

A headless hook that wraps `searchThaiAddress` with a built-in debounce and manages query/suggestions state for you. `react`/`react-dom` are optional peer dependencies, and the built files already carry a `"use client"` directive, so it works in a Next.js App Router project without any extra wrapper.

### Parameters (`UseThaiAddressAutocompleteOptions`)

| Name | Type | Default | Description |
|---|---|---|---|
| `index` | `TrigramIndex` | — (required) | The index to search. Must not be `null`/`undefined` when the hook is called — hooks can't be called conditionally, so if your index loads asynchronously, split off an outer component that waits for it first |
| `limit?` | `number` | `10` | Forwarded to `searchThaiAddress` as-is — caps the number of results for text queries |
| `debounce?` | `number` | `200` | Delay, in milliseconds, before a search actually runs after the user stops typing |
| `threshold?` | `number` | `0.4` | Forwarded to `searchThaiAddress` as-is — the minimum score that counts as a match |
| `zipLimit?` | `number` | `undefined` | Forwarded to `searchThaiAddress` as-is (the hook itself sets no default — if omitted, `searchThaiAddress`'s own default of `Infinity` applies) |
| `initialQuery?` | `string` | `''` | Seed value for `query` on first render. **Does not trigger a search** — useful for pre-filling the input with an already-chosen address (e.g. react-hook-form `defaultValues`) without popping the dropdown open |
| `locale?` | `AddressLocale` (`'th' \| 'en'`) | `undefined` | Language for the `label` field of returned `suggestions`, forwarded to `formatThaiAddressSuggestion` |
| `onSelect?` | `(address: ResolvedThaiAddress) => void` | `undefined` | Called after `selectSuggestion` successfully resolves an address |

### Return value

| Name | Type | Description |
|---|---|---|
| `query` | `string` | The current text in the search input |
| `setQuery` | `(value: string) => void` | Sets a new query — triggers a debounced search (`debounce` ms after the last keystroke) |
| `setQuerySilent` | `(value: string) => void` | Sets the query **without** re-searching or reopening the dropdown — use it to echo a chosen label back into the input after `selectSuggestion`, or to seed the query after mount (e.g. once async `defaultValues` resolve) |
| `suggestions` | `ThaiAddressSuggestion[]` | The array of results from the most recent search |
| `isOpen` | `boolean` | `query.length > 0 && suggestions.length > 0` — use this to decide whether to render the dropdown |
| `selectSuggestion` | `(item: ThaiAddressSuggestion) => ResolvedThaiAddress \| null` | Takes a full suggestion object (from `suggestions`, not just its `id`), looks up the original record by `item.id` internally in O(1), resolves it into a `ResolvedThaiAddress`, clears `suggestions`, fires `onSelect`, and returns the resolved address — returns `null` (never throws) if `item.id` doesn't match the latest batch of suggestions (e.g. it's stale). It deliberately does **not** touch `query` — call `setQuerySilent`/`clear` yourself if you also want to update the input |
| `clear` | `() => void` | Resets `query` and `suggestions` back to empty |

### Notes

- `index` is read via an internal ref — a new object reference passed in on each render does **not** restart a pending debounce timer. But if `index` actually changes value (e.g. swapped for a different dataset) while a query is pending, the hook re-searches immediately with the new index, without waiting for the debounce
- `initialQuery` and a non-empty `setQuerySilent('...')` both suppress exactly the next search that would otherwise fire — this covers both the debounced effect and the effect that reacts to `index` changing (both run together on mount). `setQuerySilent('')` (an empty value) does **not** arm this suppression, so it can't accidentally swallow the next real keystroke
- `query.length === 0` clears `suggestions` immediately, without waiting for the debounce

### Example

```tsx
import { useState } from 'react'
import { useThaiAddressAutocomplete } from 'thaizip/react'
import type { ResolvedThaiAddress, TrigramIndex } from 'thaizip'

function AddressAutocomplete({ index }: { index: TrigramIndex }) {
  const [selected, setSelected] = useState<ResolvedThaiAddress | null>(null)
  const { query, setQuery, setQuerySilent, suggestions, isOpen, selectSuggestion } =
    useThaiAddressAutocomplete({ index, onSelect: setSelected })

  return (
    <div>
      <input value={query} onChange={(e) => setQuery(e.target.value)} />
      {isOpen && (
        <ul>
          {suggestions.map((s) => (
            <li
              key={s.id}
              onClick={() => {
                const resolved = selectSuggestion(s)
                if (resolved) setQuerySilent(s.label)
              }}
            >
              {s.label} ({s.zipCode})
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

:::tip
Want a ready-made component in the shadcn style (Base UI + Tailwind)? See [react-thaizip](https://github.com/naay99999/react-thai-zip)
:::
