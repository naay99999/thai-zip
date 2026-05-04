import { describe, it, expect, beforeAll, vi } from 'vitest'
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

  it('selectSuggestion throws when called with a suggestion id not in current results', () => {
    const { result } = renderHook(() => useThaiAddressAutocomplete({ index, debounce: 0 }))

    const fakeSuggestion: ThaiAddressSuggestion = {
      id: 'does-not-exist',
      label: 'fake',
      tambon: 'fake', tambonEn: 'fake',
      amphure: 'fake', amphureEn: 'fake',
      province: 'fake', provinceEn: 'fake',
      zipCode: '00000',
    }

    expect(() => {
      act(() => { result.current.selectSuggestion(fakeSuggestion) })
    }).toThrow('[thaizip]')
  })
})
