import type { AmphureSummary, ProvinceSummary, TambonSummary, ThaiAddressRecord, TrigramIndex } from '../types'

// Sorting Thai names inside a comparator must never construct a new Collator
// or call `localeCompare` with a locale argument per-call — that is the exact
// PERF-1 hot-path bug fixed elsewhere in this codebase. One cached instance.
const thCollator = new Intl.Collator('th')

function byNameTh(a: { nameTh: string }, b: { nameTh: string }): number {
  return thCollator.compare(a.nameTh, b.nameTh)
}

/**
 * All provinces present in the index, deduplicated and sorted by Thai name.
 * Backed by `index.byProvince` (O(unique provinces)); falls back to scanning
 * `index.records` if an older-shaped index lacks that map. A missing/junk
 * index returns `[]` rather than throwing.
 */
export function listProvinces(index: TrigramIndex): ProvinceSummary[] {
  if (!index || !index.records) return []
  const seen = new Map<number, ProvinceSummary>()

  if (index.byProvince) {
    for (const [provinceId, recordIndices] of index.byProvince) {
      if (seen.has(provinceId) || recordIndices.length === 0) continue
      const r = index.records[recordIndices[0]]
      seen.set(provinceId, { id: provinceId, nameTh: r.provinceNameTh, nameEn: r.provinceNameEn })
    }
  } else {
    for (const r of index.records) {
      if (!seen.has(r.provinceId)) {
        seen.set(r.provinceId, { id: r.provinceId, nameTh: r.provinceNameTh, nameEn: r.provinceNameEn })
      }
    }
  }

  return Array.from(seen.values()).sort(byNameTh)
}

/**
 * Amphures (districts) within a given province, deduplicated and sorted by
 * Thai name. Unknown `provinceId` returns `[]`. Backed by `index.byProvince`;
 * falls back to scanning `index.records` if an older-shaped index lacks it.
 * A missing/junk index returns `[]` rather than throwing.
 */
export function listAmphures(index: TrigramIndex, provinceId: number): AmphureSummary[] {
  if (!index || !index.records) return []
  const seen = new Map<number, AmphureSummary>()

  const addFrom = (r: ThaiAddressRecord): void => {
    if (!seen.has(r.amphureId)) {
      seen.set(r.amphureId, {
        id: r.amphureId,
        nameTh: r.amphureNameTh,
        nameEn: r.amphureNameEn,
        provinceId: r.provinceId,
      })
    }
  }

  if (index.byProvince) {
    const recordIndices = index.byProvince.get(provinceId)
    if (!recordIndices) return []
    for (const idx of recordIndices) addFrom(index.records[idx])
  } else {
    for (const r of index.records) {
      if (r.provinceId === provinceId) addFrom(r)
    }
  }

  return Array.from(seen.values()).sort(byNameTh)
}

/**
 * Tambons (subdistricts) within a given amphure, sorted by Thai name.
 * Unknown `amphureId` returns `[]`. Backed by `index.byAmphure`; falls back
 * to scanning `index.records` if an older-shaped index lacks it. Each
 * `byAmphure` entry already maps to exactly one tambon record, so no
 * deduplication is needed here. A missing/junk index returns `[]` rather
 * than throwing.
 */
export function listTambons(index: TrigramIndex, amphureId: number): TambonSummary[] {
  if (!index || !index.records) return []
  const toSummary = (r: ThaiAddressRecord): TambonSummary => ({
    id: r.tambonId,
    nameTh: r.tambonNameTh,
    nameEn: r.tambonNameEn,
    amphureId: r.amphureId,
    zipCode: r.zipCode,
  })

  let result: TambonSummary[]

  if (index.byAmphure) {
    const recordIndices = index.byAmphure.get(amphureId)
    if (!recordIndices) return []
    result = recordIndices.map(idx => toSummary(index.records[idx]))
  } else {
    result = index.records.filter(r => r.amphureId === amphureId).map(toSummary)
  }

  return result.sort(byNameTh)
}
