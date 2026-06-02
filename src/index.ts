export { buildThaiAddressIndex } from './core/indexer'
export { clearDefaultIndex } from './data/loader'
export { searchThaiAddress } from './core/search'
export { formatThaiAddressSuggestion } from './core/formatter'
export { resolveThaiAddress } from './core/resolver'
export { normalizeThaiAddressText } from './core/normalizer'
export { useThaiAddressAutocomplete } from './react/useThaiAddressAutocomplete'

export type {
  ThaiAddressRecord,
  TrigramIndex,
  ThaiAddressSuggestion,
  ResolvedThaiAddress,
  SearchOptions,
  UseThaiAddressAutocompleteOptions,
  RawData,
  RawGeography,
  RawProvince,
  RawAmphure,
  RawTambon,
} from './types'
