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
 */
export function useThaiAddressAutocomplete(options: UseThaiAddressAutocompleteOptions) {
  const { index, limit = 10, debounce: debounceMs = 200, threshold = 0.4 } = options

  // Keep index in a ref so a new object reference from the caller doesn't
  // re-trigger the search effect. The ref is updated synchronously each render
  // so the debounce callback always reads the latest value.
  const indexRef = useRef(index)
  indexRef.current = index

  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<ThaiAddressSuggestion[]>([])
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const matchedRecordsMapRef = useRef<Map<string, ThaiAddressRecord>>(new Map())

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)

    if (query.length === 0) {
      setSuggestions([])
      matchedRecordsMapRef.current = new Map()
      return
    }

    timerRef.current = setTimeout(() => {
      const records = searchThaiAddress(indexRef.current, query, { limit, threshold })
      const formatted = records.map(formatThaiAddressSuggestion)
      const recordMap = new Map<string, ThaiAddressRecord>()
      for (let i = 0; i < records.length; i++) {
        recordMap.set(formatted[i].id, records[i])
      }
      matchedRecordsMapRef.current = recordMap
      setSuggestions(formatted)
    }, debounceMs)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
    // `index` is intentionally omitted — it is read via indexRef.current so that
    // a new reference from the caller does not restart the debounce timer.
  }, [query, limit, threshold, debounceMs])

  // When `index` changes (e.g. loaded after user started typing, or swapped for a
  // custom dataset), re-run the search immediately rather than waiting for the
  // next keystroke.
  useEffect(() => {
    if (query.length === 0) return
    if (timerRef.current) clearTimeout(timerRef.current)
    const records = searchThaiAddress(index, query, { limit, threshold })
    const formatted = records.map(formatThaiAddressSuggestion)
    const recordMap = new Map<string, ThaiAddressRecord>()
    for (let i = 0; i < records.length; i++) {
      recordMap.set(formatted[i].id, records[i])
    }
    matchedRecordsMapRef.current = recordMap
    setSuggestions(formatted)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])

  /**
   * Resolves a suggestion to a full ThaiAddress and clears the suggestions list.
   *
   * Note: `query` is intentionally left unchanged so the input field retains the
   * typed text. Call `clear()` afterwards if you want to reset the input as well.
   */
  const selectSuggestion = useCallback(
    (item: ThaiAddressSuggestion): ResolvedThaiAddress => {
      if (timerRef.current) clearTimeout(timerRef.current)
      const record = matchedRecordsMapRef.current.get(item.id)
      if (!record) {
        throw new Error(`[thaizip] No record found for suggestion id "${item.id}". Make sure to use suggestions returned by this hook.`)
      }
      setSuggestions([])
      matchedRecordsMapRef.current = new Map()
      return resolveThaiAddress(record)
    },
    [],
  )

  const clear = useCallback(() => {
    setQuery('')
    setSuggestions([])
    matchedRecordsMapRef.current = new Map()
  }, [])

  return {
    query,
    setQuery,
    suggestions,
    isOpen: query.length > 0 && suggestions.length > 0,
    selectSuggestion,
    clear,
  }
}
