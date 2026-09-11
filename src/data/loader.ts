import { buildThaiAddressIndex } from '../core/indexer'
import type { TrigramIndex } from '../types'
import type { CompactProvince, CompactAmphure, CompactTambon } from './defaultData'

let cached: TrigramIndex | null = null
let inflightPromise: Promise<TrigramIndex> | null = null
let loadGeneration = 0

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
      const index = buildThaiAddressIndex({
        provinces: p.map(([id, name_th, name_en]) => ({ id, name_th, name_en, geography_id: 0, deleted_at: null })),
        amphures: a.map(([id, name_th, name_en, province_id]) => ({ id, name_th, name_en, province_id, deleted_at: null })),
        tambons: t.map(([id, name_th, name_en, amphure_id, zip_code]) => ({ id, name_th, name_en, amphure_id, zip_code, deleted_at: null })),
      }, { validate: false })
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
