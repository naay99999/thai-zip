export { buildThaiAddressIndex, validateRawData } from './core/indexer'
export { searchThaiAddress, lookupByZipCode } from './core/search'
export { listProvinces, listAmphures, listTambons } from './core/enumerate'
export { formatThaiAddressSuggestion } from './core/formatter'
export { resolveThaiAddress } from './core/resolver'
export { normalizeThaiAddressText } from './core/normalizer'
export { applyRomanizationAliases } from './core/romanize'

export type {
  ThaiAddressRecord,
  TrigramIndex,
  ThaiAddressSuggestion,
  ResolvedThaiAddress,
  AddressLocale,
  FormatSuggestionOptions,
  ProvinceSummary,
  AmphureSummary,
  TambonSummary,
  SearchOptions,
  BuildIndexOptions,
  RawData,
  RawGeography,
  RawProvince,
  RawAmphure,
  RawTambon,
} from './types'
