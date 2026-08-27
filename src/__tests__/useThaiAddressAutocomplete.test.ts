import { describe, it, expect, beforeAll, vi } from 'vitest'
import { StrictMode } from 'react'
import { renderHook, act } from '@testing-library/react'
import { buildThaiAddressIndex } from '../core/indexer'
import { useThaiAddressAutocomplete } from '../react/useThaiAddressAutocomplete'
import type { RawData, TrigramIndex, ThaiAddressSuggestion } from '../types'

vi.useFakeTimers()

const mockData: RawData = {
  geographies: [{ id: 1, name: 'ภาคกลาง', deleted_at: null }],
  provinces: [{ id: 1, name_th: 'กรุงเทพมหานคร', name_en: 'Bangkok', geography_id: 1, deleted_at: null }],
  amphures: [{ id: 1001, name_th: 'จตุจักร', name_en: 'Chatuchak', province_id: 1, deleted_at: null }],
  tambons: [
    { id: 100101, zip_code: 10900, name_th: 'ลาดพร้าว', name_en: 'Lat Phrao', amphure_id: 1001, deleted_at: null },
    { id: 100102, zip_code: 10900, name_th: 'จอมพล', name_en: 'Chom Phon', amphure_id: 1001, deleted_at: null },
  ],
}

let index: TrigramIndex

beforeAll(() => {
  index = buildThaiAddressIndex(mockData)
})

describe('useThaiAddressAutocomplete', () => {
  it('starts with empty query and no suggestions', () => {
    const { result } = renderHook(() => useThaiAddressAutocomplete({ index }))
    expect(result.current.query).toBe('')
    expect(result.current.suggestions).toHaveLength(0)
    expect(result.current.isOpen).toBe(false)
  })

  it('shows suggestions after debounce fires', async () => {
    const { result } = renderHook(() => useThaiAddressAutocomplete({ index, debounce: 200 }))

    act(() => { result.current.setQuery('ลาดพร้าว') })
    expect(result.current.suggestions).toHaveLength(0) // not yet

    act(() => { vi.advanceTimersByTime(200) })
    expect(result.current.suggestions.length).toBeGreaterThan(0)
    expect(result.current.isOpen).toBe(true)
  })

  it('clear resets query and suggestions', () => {
    const { result } = renderHook(() => useThaiAddressAutocomplete({ index, debounce: 0 }))

    act(() => { result.current.setQuery('ลาดพร้าว') })
    act(() => { vi.advanceTimersByTime(0) })
    act(() => { result.current.clear() })

    expect(result.current.query).toBe('')
    expect(result.current.suggestions).toHaveLength(0)
    expect(result.current.isOpen).toBe(false)
  })

  it('selectSuggestion returns ResolvedThaiAddress and clears suggestions', () => {
    const { result } = renderHook(() => useThaiAddressAutocomplete({ index, debounce: 0 }))

    act(() => { result.current.setQuery('ลาดพร้าว') })
    act(() => { vi.advanceTimersByTime(0) })

    const suggestion = result.current.suggestions[0]
    let resolved: ReturnType<typeof result.current.selectSuggestion> | undefined
    act(() => {
      resolved = result.current.selectSuggestion(suggestion)
    })

    expect(resolved).toBeDefined()
    expect(resolved!.tambon).toBe('ลาดพร้าว')
    expect(resolved!.subdistrict).toBe('ลาดพร้าว')
    expect(resolved!.province).toBe('กรุงเทพมหานคร')
    expect(result.current.suggestions).toHaveLength(0)
    expect(result.current.isOpen).toBe(false)
  })

  it('respects limit option', () => {
    const { result } = renderHook(() => useThaiAddressAutocomplete({ index, debounce: 0, limit: 1 }))

    act(() => { result.current.setQuery('กรุงเทพ') })
    act(() => { vi.advanceTimersByTime(0) })

    expect(result.current.suggestions).toHaveLength(1)
  })

  it('selectSuggestion returns null (does not throw) when called with a suggestion id not in current results', () => {
    const { result } = renderHook(() => useThaiAddressAutocomplete({ index, debounce: 0 }))

    const fakeSuggestion: ThaiAddressSuggestion = {
      id: 'does-not-exist',
      label: 'fake',
      labelTh: 'fake',
      labelEn: 'fake',
      tambon: 'fake', tambonEn: 'fake',
      amphure: 'fake', amphureEn: 'fake',
      province: 'fake', provinceEn: 'fake',
      zipCode: '00000',
    }

    let resolved: ReturnType<typeof result.current.selectSuggestion> | undefined
    expect(() => {
      act(() => { resolved = result.current.selectSuggestion(fakeSuggestion) })
    }).not.toThrow()

    expect(resolved).toBeNull()
  })

  it('initialQuery seeds query and produces no suggestions / isOpen === false after timers flush', () => {
    const { result } = renderHook(() =>
      useThaiAddressAutocomplete({ index, debounce: 200, initialQuery: 'ลาดพร้าว' }),
    )

    expect(result.current.query).toBe('ลาดพร้าว')
    expect(result.current.suggestions).toHaveLength(0)
    expect(result.current.isOpen).toBe(false)

    act(() => { vi.advanceTimersByTime(1000) })

    expect(result.current.suggestions).toHaveLength(0)
    expect(result.current.isOpen).toBe(false)
  })

  it('setQuerySilent sets query but leaves suggestions empty and isOpen false', () => {
    const { result } = renderHook(() => useThaiAddressAutocomplete({ index, debounce: 200 }))

    act(() => { result.current.setQuerySilent('บางรัก') })

    expect(result.current.query).toBe('บางรัก')
    expect(result.current.suggestions).toHaveLength(0)
    expect(result.current.isOpen).toBe(false)

    act(() => { vi.advanceTimersByTime(1000) })

    expect(result.current.suggestions).toHaveLength(0)
    expect(result.current.isOpen).toBe(false)
  })

  it('a real setQuery after a setQuerySilent still searches normally (suppression flag resets)', () => {
    const { result } = renderHook(() => useThaiAddressAutocomplete({ index, debounce: 200 }))

    act(() => { result.current.setQuerySilent('บางรัก') })
    act(() => { vi.advanceTimersByTime(1000) })
    expect(result.current.suggestions).toHaveLength(0)

    act(() => { result.current.setQuery('ลาดพร้าว') })
    act(() => { vi.advanceTimersByTime(200) })

    expect(result.current.suggestions.length).toBeGreaterThan(0)
    expect(result.current.isOpen).toBe(true)
  })

  it('onSelect fires with the resolved address exactly once per successful select', () => {
    const onSelect = vi.fn()
    const { result } = renderHook(() => useThaiAddressAutocomplete({ index, debounce: 0, onSelect }))

    act(() => { result.current.setQuery('ลาดพร้าว') })
    act(() => { vi.advanceTimersByTime(0) })

    const suggestion = result.current.suggestions[0]
    act(() => { result.current.selectSuggestion(suggestion) })

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ tambon: 'ลาดพร้าว', province: 'กรุงเทพมหานคร' }),
    )

    // Re-selecting the same (now-stale) item should not call onSelect again.
    act(() => { result.current.selectSuggestion(suggestion) })
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('locale "en" makes suggestions[0].label the English label, and labelTh/labelEn are both always present', () => {
    const { result } = renderHook(() =>
      useThaiAddressAutocomplete({ index, debounce: 0, locale: 'en' }),
    )

    act(() => { result.current.setQuery('ลาดพร้าว') })
    act(() => { vi.advanceTimersByTime(0) })

    expect(result.current.suggestions.length).toBeGreaterThan(0)
    const s = result.current.suggestions[0]
    expect(s.label).toBe(s.labelEn)
    expect(s.labelTh).toBeTruthy()
    expect(s.labelEn).toBeTruthy()
  })

  it('setQuerySilent("") does not stick the suppression flag for the next real keystroke', () => {
    const { result } = renderHook(() => useThaiAddressAutocomplete({ index, debounce: 200 }))

    act(() => { result.current.setQuerySilent('') })
    expect(result.current.query).toBe('')

    act(() => { result.current.setQuery('ลาดพร้าว') })
    act(() => { vi.advanceTimersByTime(200) })

    expect(result.current.suggestions.length).toBeGreaterThan(0)
    expect(result.current.isOpen).toBe(true)
  })

  it('re-searches immediately when the index object reference changes (index-swap behaviour)', () => {
    const { result, rerender } = renderHook(
      ({ idx }) => useThaiAddressAutocomplete({ index: idx, debounce: 200 }),
      { initialProps: { idx: index } },
    )

    act(() => { result.current.setQuery('ลาดพร้าว') })
    act(() => { vi.advanceTimersByTime(200) })
    expect(result.current.suggestions.length).toBeGreaterThan(0)

    const newIndex = buildThaiAddressIndex(mockData)
    act(() => { rerender({ idx: newIndex }) })

    // The `[index]` effect re-runs the search synchronously (within act), without
    // waiting for the debounce timer.
    expect(result.current.suggestions.length).toBeGreaterThan(0)
  })

  // --- Phase 2 regression tests: suppressedQueryRef must survive StrictMode's
  // double-invoked effects, an index arriving asynchronously after mount, and
  // rapid/mixed calls to setQuery/setQuerySilent/clear. ---

  it('StrictMode + initialQuery: dropdown never opens across the double effect pass', () => {
    const { result } = renderHook(
      () => useThaiAddressAutocomplete({ index, debounce: 200, initialQuery: 'ลาดพร้าว' }),
      { wrapper: StrictMode },
    )

    expect(result.current.query).toBe('ลาดพร้าว')
    expect(result.current.suggestions).toHaveLength(0)
    expect(result.current.isOpen).toBe(false)

    act(() => { vi.advanceTimersByTime(1000) })

    expect(result.current.suggestions).toHaveLength(0)
    expect(result.current.isOpen).toBe(false)
  })

  it('initialQuery stays un-searched even when the index arrives asynchronously after mount', () => {
    const emptyIndex = buildThaiAddressIndex({ provinces: [], amphures: [], tambons: [] })
    const { result, rerender } = renderHook(
      ({ idx }) => useThaiAddressAutocomplete({ index: idx, debounce: 200, initialQuery: 'ลาดพร้าว' }),
      { initialProps: { idx: emptyIndex } },
    )

    expect(result.current.suggestions).toHaveLength(0)

    // The real index "arrives" later (e.g. loadDefaultIndex() resolving after mount).
    act(() => { rerender({ idx: index }) })
    expect(result.current.suggestions).toHaveLength(0)
    expect(result.current.isOpen).toBe(false)

    act(() => { vi.advanceTimersByTime(1000) })
    expect(result.current.suggestions).toHaveLength(0)
    expect(result.current.isOpen).toBe(false)
  })

  it('a normal edit after initialQuery searches normally', () => {
    const { result } = renderHook(() =>
      useThaiAddressAutocomplete({ index, debounce: 200, initialQuery: 'ลาดพร้าว' }),
    )

    act(() => { result.current.setQuery('จอมพล') })
    act(() => { vi.advanceTimersByTime(200) })

    expect(result.current.suggestions.length).toBeGreaterThan(0)
    expect(result.current.isOpen).toBe(true)
  })

  it('repeated setQuerySilent calls with the same value never reopen the dropdown', () => {
    const { result } = renderHook(() => useThaiAddressAutocomplete({ index, debounce: 200 }))

    act(() => { result.current.setQuerySilent('ลาดพร้าว') })
    act(() => { result.current.setQuerySilent('ลาดพร้าว') })
    act(() => { vi.advanceTimersByTime(1000) })

    expect(result.current.suggestions).toHaveLength(0)
    expect(result.current.isOpen).toBe(false)
  })

  it('rapid query churn (growing prefixes under the debounce interval) settles to one final result set', () => {
    const { result } = renderHook(() => useThaiAddressAutocomplete({ index, debounce: 200 }))
    const prefixes = ['ล', 'ลา', 'ลาด', 'ลาดพ', 'ลาดพร', 'ลาดพร้าว']

    for (const prefix of prefixes) {
      act(() => { result.current.setQuery(prefix) })
      act(() => { vi.advanceTimersByTime(50) }) // stays under the 200ms debounce each step
    }
    act(() => { vi.advanceTimersByTime(200) })

    expect(result.current.query).toBe('ลาดพร้าว')
    expect(result.current.suggestions.length).toBeGreaterThan(0)
  })

  it('stress sequence: type, clear, type, index swap, select, unmount — exactly one onSelect, no post-unmount throw', () => {
    const onSelect = vi.fn()
    const { result, rerender, unmount } = renderHook(
      ({ idx }) => useThaiAddressAutocomplete({ index: idx, debounce: 200, onSelect }),
      { initialProps: { idx: index } },
    )

    act(() => { result.current.setQuery('ลาดพร้าว') })
    act(() => { vi.advanceTimersByTime(200) })
    expect(result.current.suggestions.length).toBeGreaterThan(0)

    act(() => { result.current.clear() })
    expect(result.current.suggestions).toHaveLength(0)

    act(() => { result.current.setQuery('จอมพล') })

    const newIndex = buildThaiAddressIndex(mockData)
    act(() => { rerender({ idx: newIndex }) })
    act(() => { vi.advanceTimersByTime(200) })
    expect(result.current.suggestions.length).toBeGreaterThan(0)

    const suggestion = result.current.suggestions[0]
    act(() => { result.current.selectSuggestion(suggestion) })
    expect(onSelect).toHaveBeenCalledTimes(1)

    expect(() => unmount()).not.toThrow()
  })

  it('clear() then typing the same string as initialQuery does not search (documents current suppressedQueryRef behaviour)', () => {
    // clear() intentionally does not reset suppressedQueryRef (see its
    // implementation) — so if the very next query happens to equal the
    // original initialQuery string, that one search stays suppressed. This
    // pins the current behaviour rather than leaving it undocumented.
    const { result } = renderHook(() =>
      useThaiAddressAutocomplete({ index, debounce: 200, initialQuery: 'ลาดพร้าว' }),
    )

    act(() => { result.current.clear() })
    act(() => { result.current.setQuery('ลาดพร้าว') })
    act(() => { vi.advanceTimersByTime(200) })

    expect(result.current.suggestions).toHaveLength(0)
  })
})
