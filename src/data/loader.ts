import { buildThaiAddressIndex } from '../core/indexer'
import type { TrigramIndex } from '../types'
import type { CompactProvince, CompactAmphure, CompactTambon } from './defaultData'

let cached: TrigramIndex | null = null

export function clearDefaultIndex(): void {
  cached = null
}

export async function loadDefaultIndex(): Promise<TrigramIndex> {
  if (cached) return cached
  const { p, a, t } = await import('./defaultData') as {
    p: CompactProvince[]
    a: CompactAmphure[]
    t: CompactTambon[]
  }
  cached = buildThaiAddressIndex({
    provinces: p.map(([id, name_th, name_en]) => ({ id, name_th, name_en, geography_id: 0, deleted_at: null })),
    amphures: a.map(([id, name_th, name_en, province_id]) => ({ id, name_th, name_en, province_id, deleted_at: null })),
    tambons: t.map(([id, name_th, name_en, amphure_id, zip_code]) => ({ id, name_th, name_en, amphure_id, zip_code: Number(zip_code), deleted_at: null })),
  })
  return cached
}
