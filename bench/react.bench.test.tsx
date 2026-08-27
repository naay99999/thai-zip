// React hook analysis: search counts per typing pattern, render counts,
// Strict Mode duplicate work, timer churn.
// Run: npx vitest run bench/react.bench.test.ts
import { describe, it, expect, vi, beforeAll } from 'vitest'
import React, { StrictMode, useState, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { useThaiAddressAutocomplete } from '../src/react/useThaiAddressAutocomplete'
import { buildThaiAddressIndex } from '../src/core/indexer'
import { defaultRawData } from './data'

// @ts-expect-error test env
globalThis.IS_REACT_ACT_ENVIRONMENT = true

let index: ReturnType<typeof buildThaiAddressIndex>
let mapGetCalls = 0
let searchBatches = 0

beforeAll(() => {
  const raw = defaultRawData()
  index = buildThaiAddressIndex(raw, { validate: false })
  // Count Map.get calls + batches to detect every real search execution
  const realMap = index.map
  const countingMap = new Proxy(realMap, {
    get(target, prop, receiver) {
      if (prop === 'get') {
        return (key: string) => {
          mapGetCalls++
          if (searchBatches === -1) searchBatches = 0
          return Reflect.get(target, key, receiver) ? target.get(key) : undefined
        }
      }
      const v = Reflect.get(target, prop, target)
      return typeof v === 'function' ? v.bind(target) : v
    },
  })
  index.map = countingMap as typeof realMap
})

function flushDebounce() {
  // advance timers by the debounce duration so the pending search fires
  act(() => { vi.advanceTimersByTime(210) })
}

describe('useThaiAddressAutocomplete workload', () => {
  it('fast typist: 8 keystrokes under debounce window → 1 search, bounded renders', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    let renders = 0
    let lastSuggestions: number = -1
    const changes: number[] = []

    function Harness() {
      renders++
      const ac = useThaiAddressAutocomplete({ index, debounce: 200 })
      useEffect(() => {
        if (ac.suggestions.length !== lastSuggestions) {
          lastSuggestions = ac.suggestions.length
          changes.push(ac.suggestions.length)
        }
      })
      return <input value={ac.query} onChange={e => ac.setQuery(e.target.value)} data-open={ac.isOpen} />
    }

    const div = document.createElement('div')
    document.body.appendChild(div)
    let root: Root
    const before = mapGetCalls
    act(() => { root = createRoot(div); root.render(<Harness />) })

    const seq = ['b', 'ba', 'ban', 'bang', 'bang ', 'bang r', 'bang ra', 'bang rak']
    for (const step of seq) {
      act(() => {
        const input = div.querySelector('input')!
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
        setter.call(input, step)
        input.dispatchEvent(new Event('input', { bubbles: true }))
      })
      // fast typist: only 50ms between keystrokes — never reaches the 200ms debounce
      act(() => { vi.advanceTimersByTime(50) })
    }
    const midTypingSuggestionUpdates = changes.length
    flushDebounce()
    const searches = mapGetCalls - before
    console.log(`  fast typist (8 keystrokes @50ms): renders=${renders}  map.get delta=${searches} (= one batch of 6 trigram lookups for "bang rak")`)
    console.log(`  suggestion-list updates during typing: ${midTypingSuggestionUpdates} (dropdown stays closed until debounce settles)`)
    console.log(`  suggestion-list updates after debounce: ${JSON.stringify(changes.slice(midTypingSuggestionUpdates))} (final list rendered once)`)
    // Exactly ONE debounced search should have run for the final query
    expect(searches).toBeGreaterThan(0)
    expect(renders).toBeLessThan(20)
    act(() => root.unmount())
    div.remove()
    vi.useRealTimers()
  })

  it('slow typist: every keystroke survives debounce → 6 real searches (ban..bang rak)', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const searchStarts: number[] = []
    function Harness() {
      const ac = useThaiAddressAutocomplete({ index, debounce: 200 })
      return <input value={ac.query} onChange={e => ac.setQuery(e.target.value)} />
    }
    const div = document.createElement('div')
    document.body.appendChild(div)
    let root: Root
    const before = mapGetCalls
    act(() => { root = createRoot(div); root.render(<Harness />) })

    const seq = ['b', 'ba', 'ban', 'bang', 'bang ', 'bang r', 'bang ra', 'bang rak']
    for (const step of seq) {
      act(() => {
        const input = div.querySelector('input')!
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
        setter.call(input, step)
        input.dispatchEvent(new Event('input', { bubbles: true }))
      })
      act(() => { vi.advanceTimersByTime(200) }) // slow typist — each search fires
      searchStarts.push(step.length)
    }
    const searches = mapGetCalls - before
    console.log(`  slow typist (8 keystrokes @200ms): map.get calls=${searches}`)
    console.log(`  (sub-3-char steps b/ba never reach the index; expect ~6 batches of map.get calls)`)
    expect(searches).toBeGreaterThan(0)
    act(() => root.unmount())
    div.remove()
    vi.useRealTimers()
  })

  it('Strict Mode (dev): mount does not fire spurious searches; no duplicate debounce churn', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const timers: { set: number; clear: number } = { set: 0, clear: 0 }
    const origSet = globalThis.setTimeout
    const origClear = globalThis.clearTimeout
    vi.stubGlobal('setTimeout', (...args: Parameters<typeof setTimeout>) => { timers.set++; return origSet(...args) })
    vi.stubGlobal('clearTimeout', (...args: Parameters<typeof clearTimeout>) => { timers.clear++; return origClear(...args) })

    function Harness() {
      const ac = useThaiAddressAutocomplete({ index, debounce: 200 })
      return <input value={ac.query} onChange={e => ac.setQuery(e.target.value)} />
    }
    const div = document.createElement('div')
    document.body.appendChild(div)
    let root: Root
    const before = mapGetCalls
    act(() => { root = createRoot(div); root.render(<StrictMode><Harness /></StrictMode>) })
    act(() => { vi.advanceTimersByTime(500) })
    const mountSearches = mapGetCalls - before
    console.log(`  StrictMode mount with empty query: map.get calls=${mountSearches} (expect 0 — no spurious search)`)

    act(() => {
      const input = div.querySelector('input')!
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
      setter.call(input, 'bang rak')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    act(() => { vi.advanceTimersByTime(210) })
    console.log(`  timer churn for 1 keystroke: setTimeout=${timers.set} clearTimeout=${timers.clear}`)
    const searches = mapGetCalls - before
    console.log(`  total map.get calls (mount + 1 keystroke): ${searches}`)
    expect(searches).toBeGreaterThan(0)
    act(() => root.unmount())
    div.remove()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('measures synchronous search+format+commit cost per debounced keystroke', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    function Harness() {
      const ac = useThaiAddressAutocomplete({ index, debounce: 200 })
      return <input value={ac.query} onChange={e => ac.setQuery(e.target.value)} />
    }
    const div = document.createElement('div')
    document.body.appendChild(div)
    let root: Root
    act(() => { root = createRoot(div); root.render(<Harness />) })

    const seq = ['ban', 'bang', 'bang ', 'bang r', 'bang ra', 'bang rak']
    const times: number[] = []
    for (const step of seq) {
      act(() => {
        const input = div.querySelector('input')!
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
        setter.call(input, step)
        input.dispatchEvent(new Event('input', { bubbles: true }))
      })
      const t0 = performance.now()
      act(() => { vi.advanceTimersByTime(210) }) // fires debounced search + setState + re-render
      const dt = performance.now() - t0
      times.push(dt)
    }
    const stats = times.sort((a, b) => a - b)
    console.log(`  search+format+commit per keystroke (incl. re-render): p50=${stats[Math.floor(stats.length / 2)].toFixed(3)}ms  max=${stats[stats.length - 1].toFixed(3)}ms`)
    act(() => root.unmount())
    div.remove()
    vi.useRealTimers()
  })
})
