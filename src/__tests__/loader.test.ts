import { describe, it, expect } from 'vitest'
import { loadDefaultIndex, clearDefaultIndex } from '../data'

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
})
