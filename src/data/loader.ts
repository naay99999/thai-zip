import { buildThaiAddressIndex } from '../core/indexer'
import type { TrigramIndex } from '../types'
import type { CompactProvince, CompactAmphure, CompactTambon } from './defaultData'

let cached: TrigramIndex | null = null
let inflightPromise: Promise<TrigramIndex> | null = null
let loadGeneration = 0

function rejectDefaultIndexMutation(): never {
  throw new TypeError('[thaizip] the shared default index is read-only')
}

// Shared prototypes block ordinary Map/Set mutation without allocating three
// own methods on each of the ~9,400 trigram sets. This guards accidental
// changes within an app; it is not a security boundary against code that
// deliberately calls Map.prototype.set or Set.prototype.add directly.
const readOnlyMapPrototype = Object.create(Map.prototype)
const readOnlySetPrototype = Object.create(Set.prototype)
for (const [prototype, methods] of [
  [readOnlyMapPrototype, ['set', 'delete', 'clear']],
  [readOnlySetPrototype, ['add', 'delete', 'clear']],
] as const) {
  for (const method of methods) {
    Object.defineProperty(prototype, method, { value: rejectDefaultIndexMutation })
  }
}

function lockMapValues<K, V>(map: Map<K, V>, lockValue: (value: V) => void): void {
  for (const value of map.values()) lockValue(value)
  Object.setPrototypeOf(map, readOnlyMapPrototype)
  Object.freeze(map)
}

function lockDefaultIndex(index: TrigramIndex): TrigramIndex {
  for (const record of index.records) Object.freeze(record)
  Object.freeze(index.records)
  Object.freeze(index.normTambon)
  Object.freeze(index.normTambonEn)
  if (index.sortedZipKeys) Object.freeze(index.sortedZipKeys)
  if (index.sortedZipPostings) Object.freeze(index.sortedZipPostings)
  lockMapValues(index.map, set => {
    Object.setPrototypeOf(set, readOnlySetPrototype)
    Object.freeze(set)
  })
  lockMapValues(index.zipIndex, Object.freeze)
  lockMapValues(index.byProvince, Object.freeze)
  lockMapValues(index.byAmphure, Object.freeze)
  return Object.freeze(index)
}

export function clearDefaultIndex(): void {
  cached = null
  inflightPromise = null
  loadGeneration++
}

/**
 * The already-built default index, or `null` if it has not finished building.
 *
 * Purely synchronous: it never starts a build and never touches the in-flight
 * promise. It exists so a consumer can seed its initial state without waiting a
 * microtask — `loadDefaultIndex()` is async even on a cache hit, which otherwise
 * forces a one-frame loading state on every remount of an already-warm page.
 *
 * Returns `null` on a cold start and after `clearDefaultIndex()`, so callers must
 * still call `loadDefaultIndex()` — this only lets them skip the visible flash
 * when the answer is already known.
 */
export function getDefaultIndexIfLoaded(): TrigramIndex | null {
  return cached
}

export async function loadDefaultIndex(): Promise<TrigramIndex> {
  if (cached) return cached
  if (!inflightPromise) {
    const gen = loadGeneration
    inflightPromise = (import('./defaultData') as Promise<{ p: CompactProvince[]; a: CompactAmphure[]; t: CompactTambon[] }>).then(({ p, a, t }) => {
      const index = lockDefaultIndex(buildThaiAddressIndex({
        provinces: p.map(([id, name_th, name_en]) => ({ id, name_th, name_en, geography_id: 0, deleted_at: null })),
        amphures: a.map(([id, name_th, name_en, province_id]) => ({ id, name_th, name_en, province_id, deleted_at: null })),
        tambons: t.map(([id, name_th, name_en, amphure_id, zip_code]) => ({ id, name_th, name_en, amphure_id, zip_code, deleted_at: null })),
      }, { validate: false }))
      // Only commit to cache if clearDefaultIndex() wasn't called while in flight
      if (loadGeneration === gen) {
        cached = index
        inflightPromise = null
      }
      return index
    }).catch((err: unknown) => {
      if (loadGeneration === gen) inflightPromise = null
      throw err
    })
  }
  return inflightPromise
}
