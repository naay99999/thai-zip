import { describe, it, expect } from 'vitest'
import { loadDefaultIndex, clearDefaultIndex, getDefaultIndexIfLoaded } from '../data'

describe('loadDefaultIndex', () => {
  it('returns a valid TrigramIndex', async () => {
    const index = await loadDefaultIndex()
    expect(index.records.length).toBeGreaterThan(7000)
    expect(index.map.size).toBeGreaterThan(5000)
    expect(index.zipIndex.size).toBeGreaterThan(100)
  })

  it('returns the same instance on repeated calls (cached)', async () => {
    const a = await loadDefaultIndex()
    const b = await loadDefaultIndex()
    expect(a).toBe(b)
  })

  it('clearDefaultIndex resets cache so next call rebuilds', async () => {
    const a = await loadDefaultIndex()
    clearDefaultIndex()
    const b = await loadDefaultIndex()
    expect(a).not.toBe(b)
    expect(b.records.length).toBeGreaterThan(7000)
  })

  it('records have expected fields', async () => {
    const index = await loadDefaultIndex()
    const record = index.records[0]
    expect(typeof record.tambonId).toBe('number')
    expect(typeof record.tambonNameTh).toBe('string')
    expect(typeof record.tambonNameEn).toBe('string')
    expect(typeof record.amphureId).toBe('number')
    expect(typeof record.provinceId).toBe('number')
    expect(typeof record.zipCode).toBe('string')
  })

  it('concurrent calls before first resolves return the same instance (A-6)', async () => {
    clearDefaultIndex()
    const [a, b] = await Promise.all([loadDefaultIndex(), loadDefaultIndex()])
    expect(a).toBe(b)
  })

  it('clearDefaultIndex() during an in-flight load does not corrupt the cache', async () => {
    // No mock/fake-timer needed here: a dynamic import() always resolves as a
    // microtask, even for an already-loaded module (spec run-to-completion
    // guarantee). So a synchronous clearDefaultIndex() issued right after
    // starting loadDefaultIndex() — before awaiting it — is guaranteed to run
    // (and bump the generation counter) before the in-flight promise's .then()
    // callback can commit its result to `cached`.
    clearDefaultIndex()
    const inFlight = loadDefaultIndex() // starts the dynamic import; not yet awaited
    clearDefaultIndex() // bumps loadGeneration mid-flight, same synchronous tick

    const stale = await inFlight // still resolves successfully...
    expect(stale.records.length).toBeGreaterThan(7000)

    const fresh = await loadDefaultIndex() // ...but wasn't cached, so this builds fresh
    expect(fresh).not.toBe(stale)

    const second = await loadDefaultIndex() // this build should now be the cache
    expect(second).toBe(fresh)
  })
})

describe('getDefaultIndexIfLoaded', () => {
  it('returns null before anything has been loaded', () => {
    clearDefaultIndex()
    expect(getDefaultIndexIfLoaded()).toBeNull()
  })

  it('returns the same instance loadDefaultIndex resolved to', async () => {
    clearDefaultIndex()
    const loaded = await loadDefaultIndex()
    expect(getDefaultIndexIfLoaded()).toBe(loaded)
  })

  it('returns null again after clearDefaultIndex()', async () => {
    await loadDefaultIndex()
    clearDefaultIndex()
    expect(getDefaultIndexIfLoaded()).toBeNull()
  })

  it('stays null while a load is still in flight, without starting one itself', async () => {
    clearDefaultIndex()
    expect(getDefaultIndexIfLoaded()).toBeNull() // must not kick off a build
    const inFlight = loadDefaultIndex()
    expect(getDefaultIndexIfLoaded()).toBeNull() // not committed to cache yet
    await inFlight
    expect(getDefaultIndexIfLoaded()).not.toBeNull()
  })
})
