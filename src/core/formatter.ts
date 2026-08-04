import type {
  FormatSuggestionOptions,
  ThaiAddressRecord,
  ThaiAddressSuggestion,
} from '../types'

export function formatThaiAddressSuggestion(
  record: ThaiAddressRecord,
  options?: FormatSuggestionOptions,
): ThaiAddressSuggestion {
  const labelTh = `${record.tambonNameTh} > ${record.amphureNameTh} > ${record.provinceNameTh} ${record.zipCode}`
  const labelEn = `${record.tambonNameEn} > ${record.amphureNameEn} > ${record.provinceNameEn} ${record.zipCode}`

  return {
    id: String(record.tambonId),
    label: options?.locale === 'en' ? labelEn : labelTh,
    labelTh,
    labelEn,
    tambon: record.tambonNameTh,
    tambonEn: record.tambonNameEn,
    amphure: record.amphureNameTh,
    amphureEn: record.amphureNameEn,
    province: record.provinceNameTh,
    provinceEn: record.provinceNameEn,
    zipCode: record.zipCode,
  }
}
