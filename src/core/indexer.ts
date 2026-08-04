import { extractTrigrams, extractTrigramsNormalized } from './trigrams'
import { normalizeThaiAddressText } from './normalizer'
import type { BuildIndexOptions, RawData, RawTambon, ThaiAddressRecord, TrigramIndex } from '../types'

function typeErr(table: string, id: unknown, field: string, expected: string, value: unknown): TypeError {
  return new TypeError(`[thaizip] ${table} ${id}: expected ${expected} for ${field}, got ${typeof value}`)
}

/**
 * Validate that a `RawData` payload has the runtime shapes `buildThaiAddressIndex`
 * expects. Intended for consumers building an index from their own data (CSV, CMS,
 * private datasets) who want to fail fast with a descriptive error instead of an
 * opaque crash deep inside the normalizer, or silent `"undefined"` labels.
 *
 * Throws a `TypeError` (message prefixed `[thaizip]`) naming the table, the
 * offending record's `id`, the field, and the actual `typeof` on the first bad
 * field found. Does not filter soft-deleted rows first — validates every row as
 * provided.
 */
export function validateRawData(data: RawData): void {
  const { provinces, amphures, tambons } = data

  for (let i = 0; i < provinces.length; i++) {
    const p = provinces[i]
    if (typeof p.id !== 'number') throw typeErr('province', p.id, 'id', 'number', p.id)
    if (typeof p.name_th !== 'string') throw typeErr('province', p.id, 'name_th', 'string', p.name_th)
    if (typeof p.name_en !== 'string') throw typeErr('province', p.id, 'name_en', 'string', p.name_en)
  }

  for (let i = 0; i < amphures.length; i++) {
    const a = amphures[i]
    if (typeof a.id !== 'number') throw typeErr('amphure', a.id, 'id', 'number', a.id)
    if (typeof a.name_th !== 'string') throw typeErr('amphure', a.id, 'name_th', 'string', a.name_th)
    if (typeof a.name_en !== 'string') throw typeErr('amphure', a.id, 'name_en', 'string', a.name_en)
    if (typeof a.province_id !== 'number') throw typeErr('amphure', a.id, 'province_id', 'number', a.province_id)
  }

  for (let i = 0; i < tambons.length; i++) {
    const t = tambons[i]
    if (typeof t.id !== 'number') throw typeErr('tambon', t.id, 'id', 'number', t.id)
    if (typeof t.name_th !== 'string') throw typeErr('tambon', t.id, 'name_th', 'string', t.name_th)
    if (typeof t.name_en !== 'string') throw typeErr('tambon', t.id, 'name_en', 'string', t.name_en)
    const zipType = typeof t.zip_code
    if (zipType !== 'string' && zipType !== 'number') {
      throw typeErr('tambon', t.id, 'zip_code', 'string or number', t.zip_code)
    }
    if (typeof t.amphure_id !== 'number') throw typeErr('tambon', t.id, 'amphure_id', 'number', t.amphure_id)
  }
}

function addTrigrams(map: Map<string, Set<number>>, trigrams: Set<string>, idx: number): void {
  for (const trigram of trigrams) {
    let set = map.get(trigram)
    if (!set) {
      set = new Set()
      map.set(trigram, set)
    }
    set.add(idx)
  }
}

function combinedTrigrams(nameTh: string, nameEn: string): Set<string> {
  const s = new Set<string>()
  for (const t of extractTrigrams(nameTh)) s.add(t)
  for (const t of extractTrigrams(nameEn)) s.add(t)
  return s
}

export function buildThaiAddressIndex(data: RawData, options?: BuildIndexOptions): TrigramIndex {
  if (options?.validate !== false) {
    validateRawData(data)
  }

  const { provinces, amphures, tambons } = data

  // Build lookup maps (filter deleted)
  const provMap = new Map(
    provinces.filter(p => !p.deleted_at).map(p => [p.id, p])
  )
  const ampMap = new Map(
    amphures.filter(a => !a.deleted_at).map(a => [a.id, a])
  )

  // Pre-compute trigrams for shared province and amphure fields to avoid
  // redundant normalization when multiple tambons share the same parent.
  const provTrigrams = new Map<number, Set<string>>()
  for (const [id, prov] of provMap) {
    provTrigrams.set(id, combinedTrigrams(prov.name_th, prov.name_en))
  }
  const ampTrigrams = new Map<number, Set<string>>()
  for (const [id, amp] of ampMap) {
    ampTrigrams.set(id, combinedTrigrams(amp.name_th, amp.name_en))
  }

  const records: ThaiAddressRecord[] = []
  const map = new Map<string, Set<number>>()
  const zipIndex = new Map<string, number[]>()
  const normTambon: string[] = []
  const normTambonEn: string[] = []
  const byProvince = new Map<number, number[]>()
  const byAmphure = new Map<number, number[]>()

  for (const tambon of tambons) {
    if (tambon.deleted_at) continue

    const amphure = ampMap.get(tambon.amphure_id)
    if (!amphure) {
      if (options?.onSkip) options.onSkip(tambon as RawTambon)
      continue
    }

    const province = provMap.get(amphure.province_id)
    if (!province) {
      if (options?.onSkip) options.onSkip(tambon as RawTambon)
      continue
    }

    const record: ThaiAddressRecord = {
      provinceId: province.id,
      provinceNameTh: province.name_th,
      provinceNameEn: province.name_en,
      amphureId: amphure.id,
      amphureNameTh: amphure.name_th,
      amphureNameEn: amphure.name_en,
      tambonId: tambon.id,
      tambonNameTh: tambon.name_th,
      tambonNameEn: tambon.name_en,
      zipCode: String(tambon.zip_code),
    }

    const idx = records.length
    records.push(record)

    // Build zip index
    const existing = zipIndex.get(record.zipCode)
    if (existing) existing.push(idx)
    else zipIndex.set(record.zipCode, [idx])

    // Parent groupings, for the enumeration API (cascade selects)
    const provList = byProvince.get(province.id)
    if (provList) provList.push(idx)
    else byProvince.set(province.id, [idx])
    const ampList = byAmphure.get(amphure.id)
    if (ampList) ampList.push(idx)
    else byAmphure.set(amphure.id, [idx])

    // Tambon-specific fields (unique per record). The normalized Thai name is
    // kept for the search ranker, and reused here so it is only computed once.
    const normTh = normalizeThaiAddressText(record.tambonNameTh)
    normTambon.push(normTh)
    addTrigrams(map, extractTrigramsNormalized(normTh), idx)
    const normEn = normalizeThaiAddressText(record.tambonNameEn)
    normTambonEn.push(normEn)
    addTrigrams(map, extractTrigramsNormalized(normEn), idx)
    addTrigrams(map, extractTrigrams(record.zipCode), idx)
    // Reuse pre-computed province and amphure trigrams
    addTrigrams(map, provTrigrams.get(province.id)!, idx)
    addTrigrams(map, ampTrigrams.get(amphure.id)!, idx)
  }

  return { map, records, zipIndex, normTambon, normTambonEn, byProvince, byAmphure }
}
