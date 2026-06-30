export { buildThaiAddressIndex } from './core/indexer'
export { searchThaiAddress } from './core/search'
export { formatThaiAddressSuggestion } from './core/formatter'
export { resolveThaiAddress } from './core/resolver'
export { normalizeThaiAddressText } from './core/normalizer'

export type {
  ThaiAddressRecord,
  TrigramIndex,
  ThaiAddressSuggestion,
  ResolvedThaiAddress,
  SearchOptions,
  BuildIndexOptions,
  RawData,
  RawGeography,
  RawProvince,
  RawAmphure,
  RawTambon,
} from './types'
