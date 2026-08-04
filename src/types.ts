export type ThaiAddressRecord = {
  provinceId: number
  provinceNameTh: string
  provinceNameEn: string

  amphureId: number
  amphureNameTh: string
  amphureNameEn: string

  tambonId: number
  tambonNameTh: string
  tambonNameEn: string

  zipCode: string
}

export type TrigramIndex = {
  map: Map<string, Set<number>>
  records: ThaiAddressRecord[]
  zipIndex: Map<string, number[]>
  /**
   * Normalized Thai tambon names, parallel to `records` (same index).
   * Used by the search ranker for exact/prefix match detection without
   * re-normalizing on every query.
   */
  normTambon: string[]
  /**
   * Normalized English (RTGS) tambon names, parallel to `records`. Needed so
   * romanized queries get the same own-name-beats-parent-name ranking that
   * Thai queries get.
   */
  normTambonEn: string[]
  /** Record indices grouped by `provinceId`, in insertion order. */
  byProvince: Map<number, number[]>
  /** Record indices grouped by `amphureId`, in insertion order. */
  byAmphure: Map<number, number[]>
}

/** Which language a formatted label should be rendered in. */
export type AddressLocale = 'th' | 'en'

export type FormatSuggestionOptions = {
  /** Language for the `label` field. Defaults to `'th'`. */
  locale?: AddressLocale
}

export type ThaiAddressSuggestion = {
  id: string
  /** Human-readable label in the requested locale (Thai by default). */
  label: string
  /** Human-readable label in Thai, regardless of the requested locale. */
  labelTh: string
  /** Human-readable label in English, regardless of the requested locale. */
  labelEn: string
  tambon: string
  tambonEn: string
  amphure: string
  amphureEn: string
  province: string
  provinceEn: string
  zipCode: string
}

/** A province entry returned by the enumeration API. */
export type ProvinceSummary = {
  id: number
  nameTh: string
  nameEn: string
}

/** An amphure (district) entry returned by the enumeration API. */
export type AmphureSummary = {
  id: number
  nameTh: string
  nameEn: string
  provinceId: number
}

/** A tambon (subdistrict) entry returned by the enumeration API. */
export type TambonSummary = {
  id: number
  nameTh: string
  nameEn: string
  amphureId: number
  zipCode: string
}

export type ResolvedThaiAddress = {
  tambon: string
  tambonEn: string
  amphure: string
  amphureEn: string
  province: string
  provinceEn: string
  zipCode: string
  subdistrict: string
  subdistrictEn: string
  district: string
  districtEn: string
  postalCode: string
}

export type SearchOptions = {
  limit?: number
  threshold?: number
  /**
   * Maximum results for all-digit (zip code) queries. A zip code maps to at most
   * a few dozen tambons, so this defaults to `Infinity` — capping zip results at
   * the text-autocomplete `limit` silently hides valid subdistricts.
   */
  zipLimit?: number
  /**
   * Expand common romanization variants (e.g. `lardprao` → `lat phrao`) before
   * searching. Only affects Latin-script queries. Defaults to `true`.
   */
  romanizationAliases?: boolean
}

export type UseThaiAddressAutocompleteOptions = {
  index: TrigramIndex
  limit?: number
  debounce?: number
  threshold?: number
  zipLimit?: number
  /** Seed value for `query` on first render. Defaults to `''`. */
  initialQuery?: string
  /** Locale for the `label` field of returned suggestions. Defaults to `'th'`. */
  locale?: AddressLocale
  /** Called after a suggestion is successfully resolved via `selectSuggestion`. */
  onSelect?: (address: ResolvedThaiAddress) => void
}

// Raw input types
export type RawGeography = {
  id: number
  name: string
  deleted_at: string | null
}

export type RawProvince = {
  id: number
  name_th: string
  name_en: string
  geography_id: number
  deleted_at: string | null
}

export type RawAmphure = {
  id: number
  name_th: string
  name_en: string
  province_id: number
  deleted_at: string | null
}

export type RawTambon = {
  id: number
  zip_code: number | string
  name_th: string
  name_en: string
  amphure_id: number
  deleted_at: string | null
}

export type BuildIndexOptions = {
  onSkip?: (tambon: RawTambon) => void
  /**
   * Validate that every consumed field has the expected runtime type and throw a
   * descriptive `TypeError` if not. Defaults to `true`; set to `false` to skip
   * the checks when the data source is already trusted (e.g. the bundled index).
   */
  validate?: boolean
}

export type RawData = {
  geographies?: RawGeography[]  // unused by buildThaiAddressIndex; optional for custom-index callers
  provinces: RawProvince[]
  amphures: RawAmphure[]
  tambons: RawTambon[]
}
