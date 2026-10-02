import { extractTrigrams, extractTrigramsNormalized } from './trigrams'
import { normalizeThaiAddressText } from './normalizer'
import type { BuildIndexOptions, RawData, RawTambon, ThaiAddressRecord, TrigramIndex } from '../types'

// Bounds for consumer-supplied data. Parent trigrams are inserted once per
// child, so the budget must account for fan-out, not just payload byte size.
const MAX_TOTAL_ROWS = 50_000
const MAX_NAME_LENGTH = 256
const MAX_ZIP_LENGTH = 32
const MAX_POSTING_BUDGET = 1_000_000

function typeErr(table: string, id: unknown, field: string, expected: string, value: unknown): TypeError {
  return new TypeError(`[thaizip] ${table} ${id}: expected ${expected} for ${field}, got ${typeof value}`)
}

/** `typeof` that reports `null` as `'null'` instead of `'object'`. */
function typeName(value: unknown): string {
  return value === null ? 'null' : typeof value
}

/**
 * Validate that a `RawData` payload has the runtime shapes `buildThaiAddressIndex`
 * expects. Intended for consumers building an index from their own data (CSV, CMS,
 * private datasets) who want to fail fast with a descriptive error instead of an
 * opaque crash deep inside the normalizer, or silent `"undefined"` labels.
 *
 * Throws a `TypeError` for bad shapes or duplicate IDs and a `RangeError` for
 * resource limits (all prefixed `[thaizip]`). Does not filter soft-deleted rows
 * before shape checks — validates every row as provided.
 *
 * IDs must be unique within each table (duplicates throw, they are not silently
 * discarded — two suggestions sharing an id would resolve to the wrong record).
 * Referential integrity (amphure→province, tambon→amphure) is intentionally NOT
 * enforced: dangling references — including soft-deleted parents — are handled at
 * build time, where the tambon is skipped and reported via `options.onSkip`.
 */
export function validateRawData(data: RawData): void {
  if (data === null || typeof data !== 'object') {
    throw new TypeError(`[thaizip] validateRawData expected a RawData object, got ${typeName(data)}`)
  }
  const { provinces, amphures, tambons } = data
  if (!Array.isArray(provinces)) {
    throw new TypeError(`[thaizip] RawData.provinces must be an array, got ${typeName(provinces)}`)
  }
  if (!Array.isArray(amphures)) {
    throw new TypeError(`[thaizip] RawData.amphures must be an array, got ${typeName(amphures)}`)
  }
  if (!Array.isArray(tambons)) {
    throw new TypeError(`[thaizip] RawData.tambons must be an array, got ${typeName(tambons)}`)
  }
  if (provinces.length + amphures.length + tambons.length > MAX_TOTAL_ROWS) {
    throw new RangeError(`[thaizip] RawData row limit exceeded (${MAX_TOTAL_ROWS})`)
  }

  const provinceById = new Map<number, (typeof provinces)[number]>()
  for (let i = 0; i < provinces.length; i++) {
    const p = provinces[i]
    if (p === null || typeof p !== 'object') {
      throw new TypeError(`[thaizip] province[${i}]: expected object, got ${typeName(p)}`)
    }
    if (typeof p.id !== 'number') throw typeErr('province', p.id, 'id', 'number', p.id)
    if (provinceById.has(p.id)) throw new TypeError(`[thaizip] duplicate province id: ${p.id}`)
    provinceById.set(p.id, p)
    if (typeof p.name_th !== 'string') throw typeErr('province', p.id, 'name_th', 'string', p.name_th)
    if (typeof p.name_en !== 'string') throw typeErr('province', p.id, 'name_en', 'string', p.name_en)
    if (p.name_th.length > MAX_NAME_LENGTH) throw new RangeError(`[thaizip] province ${p.id}: name_th too long`)
    if (p.name_en.length > MAX_NAME_LENGTH) throw new RangeError(`[thaizip] province ${p.id}: name_en too long`)
  }

  const amphureById = new Map<number, (typeof amphures)[number]>()
  for (let i = 0; i < amphures.length; i++) {
    const a = amphures[i]
    if (a === null || typeof a !== 'object') {
      throw new TypeError(`[thaizip] amphure[${i}]: expected object, got ${typeName(a)}`)
    }
    if (typeof a.id !== 'number') throw typeErr('amphure', a.id, 'id', 'number', a.id)
    if (amphureById.has(a.id)) throw new TypeError(`[thaizip] duplicate amphure id: ${a.id}`)
    amphureById.set(a.id, a)
    if (typeof a.name_th !== 'string') throw typeErr('amphure', a.id, 'name_th', 'string', a.name_th)
    if (typeof a.name_en !== 'string') throw typeErr('amphure', a.id, 'name_en', 'string', a.name_en)
    if (typeof a.province_id !== 'number') throw typeErr('amphure', a.id, 'province_id', 'number', a.province_id)
    if (a.name_th.length > MAX_NAME_LENGTH) throw new RangeError(`[thaizip] amphure ${a.id}: name_th too long`)
    if (a.name_en.length > MAX_NAME_LENGTH) throw new RangeError(`[thaizip] amphure ${a.id}: name_en too long`)
  }

  const seenTambonIds = new Set<number>()
  const provinceTrigramCounts = new Map<number, number>()
  const amphureTrigramCounts = new Map<number, number>()
  let postingBudget = 0
  for (let i = 0; i < tambons.length; i++) {
    const t = tambons[i]
    if (t === null || typeof t !== 'object') {
      throw new TypeError(`[thaizip] tambon[${i}]: expected object, got ${typeName(t)}`)
    }
    if (typeof t.id !== 'number') throw typeErr('tambon', t.id, 'id', 'number', t.id)
    if (seenTambonIds.has(t.id)) throw new TypeError(`[thaizip] duplicate tambon id: ${t.id}`)
    seenTambonIds.add(t.id)
    if (typeof t.name_th !== 'string') throw typeErr('tambon', t.id, 'name_th', 'string', t.name_th)
    if (typeof t.name_en !== 'string') throw typeErr('tambon', t.id, 'name_en', 'string', t.name_en)
    if (t.name_th.length > MAX_NAME_LENGTH) throw new RangeError(`[thaizip] tambon ${t.id}: name_th too long`)
    if (t.name_en.length > MAX_NAME_LENGTH) throw new RangeError(`[thaizip] tambon ${t.id}: name_en too long`)
    const zipType = typeof t.zip_code
    if (zipType !== 'string' && zipType !== 'number') {
      throw typeErr('tambon', t.id, 'zip_code', 'string or number', t.zip_code)
    }
    if (typeof t.amphure_id !== 'number') throw typeErr('tambon', t.id, 'amphure_id', 'number', t.amphure_id)
    const zipLength = String(t.zip_code).length
    if (zipLength > MAX_ZIP_LENGTH) throw new RangeError(`[thaizip] tambon ${t.id}: zip_code too long`)

    if (t.deleted_at) continue
    const amphure = amphureById.get(t.amphure_id)
    const province = amphure && provinceById.get(amphure.province_id)
    if (!amphure || amphure.deleted_at || !province || province.deleted_at) continue
    let provinceGrams = provinceTrigramCounts.get(province.id)
    if (provinceGrams === undefined) {
      provinceGrams = combinedTrigrams(province.name_th, province.name_en).size
      provinceTrigramCounts.set(province.id, provinceGrams)
    }
    let amphureGrams = amphureTrigramCounts.get(amphure.id)
    if (amphureGrams === undefined) {
      amphureGrams = combinedTrigrams(amphure.name_th, amphure.name_en).size
      amphureTrigramCounts.set(amphure.id, amphureGrams)
    }
    // Parent costs use unique trigram counts; lengths would reject long but
    // low-entropy names (e.g. repeated letters) that produce tiny posting sets.
    postingBudget += t.name_th.length + t.name_en.length + zipLength + provinceGrams + amphureGrams
    if (postingBudget > MAX_POSTING_BUDGET) {
      throw new RangeError(`[thaizip] estimated trigram posting budget exceeded (${MAX_POSTING_BUDGET})`)
    }
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

  // Cache parent trigrams on first use. Unused parents must not incur
  // normalization work outside the validated posting budget.
  const provTrigrams = new Map<number, Set<string>>()
  const ampTrigrams = new Map<number, Set<string>>()

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
    let provinceGrams = provTrigrams.get(province.id)
    if (!provinceGrams) {
      provinceGrams = combinedTrigrams(province.name_th, province.name_en)
      provTrigrams.set(province.id, provinceGrams)
    }
    let amphureGrams = ampTrigrams.get(amphure.id)
    if (!amphureGrams) {
      amphureGrams = combinedTrigrams(amphure.name_th, amphure.name_en)
      ampTrigrams.set(amphure.id, amphureGrams)
    }
    addTrigrams(map, provinceGrams, idx)
    addTrigrams(map, amphureGrams, idx)
  }

  // Ascending zip keys + parallel postings, for O(log n) prefix lookup.
  // Sorting 953 keys costs a fraction of a millisecond at build time.
  const sortedZipKeys = [...zipIndex.keys()].sort()
  const sortedZipPostings = sortedZipKeys.map(z => zipIndex.get(z)!)

  return { map, records, zipIndex, sortedZipKeys, sortedZipPostings, normTambon, normTambonEn, byProvince, byAmphure }
}
