import { extractTrigrams } from './trigrams'
import type { BuildIndexOptions, RawData, RawTambon, ThaiAddressRecord, TrigramIndex } from '../types'

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

    // Tambon-specific fields (unique per record)
    addTrigrams(map, extractTrigrams(record.tambonNameTh), idx)
    addTrigrams(map, extractTrigrams(record.tambonNameEn), idx)
    addTrigrams(map, extractTrigrams(record.zipCode), idx)
    // Reuse pre-computed province and amphure trigrams
    addTrigrams(map, provTrigrams.get(province.id)!, idx)
    addTrigrams(map, ampTrigrams.get(amphure.id)!, idx)
  }

  return { map, records, zipIndex }
}
