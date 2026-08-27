const TONE_MARKS = /[่-๋็์]/g
const ADDRESS_PREFIXES = /^(จังหวัด|อำเภอ|ตำบล|แขวง|เขต|จ\.|อ\.|ต\.|ข\.)/

export function normalizeThaiAddressText(input: string): string {
  if (typeof input !== 'string') {
    throw new TypeError(
      `[thaizip] normalizeThaiAddressText expected string, got ${input === null ? 'null' : typeof input}`,
    )
  }
  if (input.length === 0) return ''
  // Canonical composition first: an NFD query ('Cafe\u0301') must hit the
  // NFC-indexed name ('Café'), not score zero. Thai script has no canonical
  // compositions, so this is a no-op pass over Thai text. Callers on the query
  // path bound the input length before this runs.
  let text = input.normalize('NFC').trim()
  text = text.replace(ADDRESS_PREFIXES, '').trim()
  text = text.replace(TONE_MARKS, '')
  text = text.toLowerCase()
  return text
}
