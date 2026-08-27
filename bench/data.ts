import { p, a, t } from '../src/data/defaultData'
import type { RawData } from '../src/types'

/** Reconstruct the RawData object exactly as src/data/loader.ts builds it. */
export function defaultRawData(): RawData {
  return {
    provinces: p.map(([id, name_th, name_en]) => ({ id, name_th, name_en, geography_id: 0, deleted_at: null })),
    amphures: a.map(([id, name_th, name_en, province_id]) => ({ id, name_th, name_en, province_id, deleted_at: null })),
    tambons: t.map(([id, name_th, name_en, amphure_id, zip_code]) => ({ id, name_th, name_en, amphure_id, zip_code, deleted_at: null })),
  }
}

export const datasetCounts = {
  provinces: p.length,
  amphures: a.length,
  tambons: t.length,
}
