const TONE_MARKS = /[่-๋็์]/g
const ADDRESS_PREFIXES = /^(จังหวัด|อำเภอ|ตำบล|แขวง|เขต|จ\.|อ\.|ต\.|ข\.)/

export function normalizeThaiAddressText(input: string): string {
  if (!input) return ''
  let text = input.trim()
  text = text.replace(ADDRESS_PREFIXES, '').trim()
  text = text.replace(TONE_MARKS, '')
  text = text.toLowerCase()
  return text
}
