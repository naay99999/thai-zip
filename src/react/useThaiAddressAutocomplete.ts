// NOTE (SZ-4): CJS consumers (`dist/index.cjs`) cannot tree-shake this hook out of the bundle.
// If you are using the CJS build in a non-React environment, import only from the core entry
// or use the ESM build with a bundler that supports tree-shaking.
import { useState, useEffect, useCallback, useRef } from 'react'
import { searchThaiAddress } from '../core/search'
import { formatThaiAddressSuggestion } from '../core/formatter'
import { resolveThaiAddress } from '../core/resolver'
import type {
  UseThaiAddressAutocompleteOptions,
  ThaiAddressRecord,
  ThaiAddressSuggestion,
  ResolvedThaiAddress,
} from '../types'

/**
 * Headless Thai address autocomplete hook.
 *
 * @param options.index - The TrigramIndex to search against. The hook reads `index`
 *   via an internal ref, so a new object reference does NOT restart the debounce
 *   timer. When `index` itself changes (e.g. swapped for a custom dataset), any
 *   pending query is re-searched immediately with the new index.
 * @param options.limit - Maximum number of suggestions (default 10).
 * @param options.debounce - Debounce delay in ms (default 200).
 * @param options.threshold - Minimum trigram score 0–1 (default 0.4).
 * @param options.zipLimit - Maximum results for all-digit (zip code) queries, passed
 *   through to `searchThaiAddress`.
 * @param options.initialQuery - Seed value for `query` on first render. Does NOT
 *   trigger a search — useful for pre-filling the input with an already-chosen
 *   address (e.g. react-hook-form `defaultValues`) without popping the dropdown open.
 * @param options.locale - Locale for the `label` field of returned suggestions.
 * @param options.onSelect - Called with the resolved address after a successful
 *   `selectSuggestion`.
 */
export function useThaiAddressAutocomplete(options: UseThaiAddressAutocompleteOptions) {
  const {
    index,
    limit = 10,
    debounce: debounceMs = 200,
    threshold = 0.4,
    zipLimit,
    initialQuery = '',
    locale,
    onSelect,
  } = options

  // Keep index in a ref so a new object reference from the caller doesn't
  // re-trigger the search effect. The ref is updated synchronously each render
  // so the debounce callback always reads the latest value.
  const indexRef = useRef(index)
  indexRef.current = index

  const [query, setQuery] = useState(initialQuery)
  const [suggestions, setSuggestions] = useState<ThaiAddressSuggestion[]>([])
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const matchedRecordsMapRef = useRef<Map<string, ThaiAddressRecord>>(new Map())

  // When true, the next run of the debounced query effect is skipped once, then
  // the flag resets so the following real keystroke searches normally. Set by
  // `setQuerySilent` and by the initial-query seed so neither triggers a
  // spurious search / dropdown open.
  const suppressNextSearchRef = useRef(initialQuery.length > 0)

  // Both search effects run together on mount (React runs every effect on the
  // first commit regardless of deps). `suppressNextSearchRef` is only consumed
  // once (by whichever effect runs first), so the `[index]` effect additionally
  // no-ops on its very first run — otherwise an `initialQuery` would still fire
  // one immediate synchronous search via this effect even though the debounced
  // effect above correctly skipped its own.
  const isFirstIndexEffectRunRef = useRef(true)

  const runSearch = useCallback(
    (q: string, idx: typeof index) => {
      const records = searchThaiAddress(idx, q, { limit, threshold, zipLimit })
      const formatted = records.map((record) => formatThaiAddressSuggestion(record, { locale }))
      const recordMap = new Map<string, ThaiAddressRecord>()
      for (let i = 0; i < records.length; i++) {
        recordMap.set(formatted[i].id, records[i])
      }
      matchedRecordsMapRef.current = recordMap
      setSuggestions(formatted)
    },
    [limit, threshold, zipLimit, locale],
  )

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)

    if (query.length === 0) {
      setSuggestions([])
      matchedRecordsMapRef.current = new Map()
      return
    }

    if (suppressNextSearchRef.current) {
      suppressNextSearchRef.current = false
      return
    }

    timerRef.current = setTimeout(() => {
      runSearch(query, indexRef.current)
    }, debounceMs)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
    // `index` is intentionally omitted — it is read via indexRef.current so that
    // a new reference from the caller does not restart the debounce timer.
  }, [query, limit, threshold, debounceMs, zipLimit, locale, runSearch])

  // When `index` changes (e.g. loaded after user started typing, or swapped for a
  // custom dataset), re-run the search immediately rather than waiting for the
  // next keystroke.
  useEffect(() => {
    if (isFirstIndexEffectRunRef.current) {
      isFirstIndexEffectRunRef.current = false
      return
    }
    if (query.length === 0) return
    if (suppressNextSearchRef.current) {
      suppressNextSearchRef.current = false
      return
    }
    if (timerRef.current) clearTimeout(timerRef.current)
    runSearch(query, index)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])

  /**
   * Resolves a suggestion to a full ThaiAddress and clears the suggestions list.
   *
   * Note: `query` is intentionally left unchanged so the input field retains the
   * typed text. Call `clear()` or `setQuerySilent()` afterwards if you want to
   * update the input as well without re-opening the dropdown.
   *
   * Returns `null` (instead of throwing) when `item.id` does not match any
   * currently-tracked suggestion — e.g. a stale re-dispatch from an optimistic
   * UI or a re-rendered `Controller`. Callers that previously relied on the
   * thrown error should check for `null`.
   */
  const selectSuggestion = useCallback(
    (item: ThaiAddressSuggestion): ResolvedThaiAddress | null => {
      if (timerRef.current) clearTimeout(timerRef.current)
      const record = matchedRecordsMapRef.current.get(item.id)
      if (!record) {
        return null
      }
      setSuggestions([])
      matchedRecordsMapRef.current = new Map()
      const resolved = resolveThaiAddress(record)
      onSelect?.(resolved)
      return resolved
    },
    [onSelect],
  )

  const clear = useCallback(() => {
    setQuery('')
    setSuggestions([])
    matchedRecordsMapRef.current = new Map()
  }, [])

  /**
   * Sets `query` without triggering a search or opening the dropdown. Use this
   * to echo a chosen suggestion's label back into the input after
   * `selectSuggestion`, or to seed the input programmatically at any point
   * after mount (e.g. when async `defaultValues` resolve later).
   */
  const setQuerySilent = useCallback((value: string) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    // Only arm suppression for a non-empty value: the query effect's
    // `query.length === 0` branch returns before ever checking (and
    // resetting) `suppressNextSearchRef`, so arming it here for an empty
    // value would leave it stuck `true` and wrongly swallow the *next* real
    // keystroke.
    if (value.length > 0) suppressNextSearchRef.current = true
    setSuggestions([])
    matchedRecordsMapRef.current = new Map()
    setQuery(value)
  }, [])

  return {
    query,
    setQuery,
    setQuerySilent,
    suggestions,
    isOpen: query.length > 0 && suggestions.length > 0,
    selectSuggestion,
    clear,
  }
}
