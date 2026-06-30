/**
 * Build script: reads raw JSON data → generates src/data/defaultData.ts
 * Run: npm run generate-data
 */
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import type { RawData } from '../types'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dataDir = resolve(__dirname, '../../data')
const outFile = resolve(__dirname, 'defaultData.ts')

function readJson<T>(filename: string): T {
  return JSON.parse(readFileSync(resolve(dataDir, filename), 'utf-8')) as T
}

function validateRawData(data: RawData): void {
  if (data.geographies !== undefined && !Array.isArray(data.geographies)) throw new Error('geographies must be an array')
  if (!Array.isArray(data.provinces)) throw new Error('provinces must be an array')
  if (!Array.isArray(data.amphures)) throw new Error('amphures must be an array')
  if (!Array.isArray(data.tambons)) throw new Error('tambons must be an array')
  for (const p of data.provinces) {
    if (typeof p.id !== 'number') throw new Error(`province missing id: ${JSON.stringify(p)}`)
    if (typeof p.name_th !== 'string') throw new Error(`province missing name_th: ${JSON.stringify(p)}`)
    if (typeof p.name_en !== 'string') throw new Error(`province missing name_en: ${JSON.stringify(p)}`)
  }
  for (const a of data.amphures) {
    if (typeof a.id !== 'number') throw new Error(`amphure missing id: ${JSON.stringify(a)}`)
    if (typeof a.province_id !== 'number') throw new Error(`amphure missing province_id: ${JSON.stringify(a)}`)
    if (typeof a.name_th !== 'string') throw new Error(`amphure missing name_th: ${JSON.stringify(a)}`)
    if (typeof a.name_en !== 'string') throw new Error(`amphure missing name_en: ${JSON.stringify(a)}`)
  }
  for (const t of data.tambons) {
    if (typeof t.id !== 'number') throw new Error(`tambon missing id: ${JSON.stringify(t)}`)
    if (typeof t.zip_code !== 'number' && typeof t.zip_code !== 'string') throw new Error(`tambon missing zip_code: ${JSON.stringify(t)}`)
    if (typeof t.amphure_id !== 'number') throw new Error(`tambon missing amphure_id: ${JSON.stringify(t)}`)
    if (typeof t.name_th !== 'string') throw new Error(`tambon missing name_th: ${JSON.stringify(t)}`)
    if (typeof t.name_en !== 'string') throw new Error(`tambon missing name_en: ${JSON.stringify(t)}`)
  }
}

const rawData: RawData = {
  geographies: readJson('thai_geographies.json'),
  provinces: readJson('thai_provinces.json'),
  amphures: readJson('thai_amphures.json'),
  tambons: readJson('thai_tambons.json'),
}

validateRawData(rawData)

// Compact format: arrays instead of objects, filter deleted at generate time
// p: [id, nameTh, nameEn]
const provinces = rawData.provinces
  .filter(p => !p.deleted_at)
  .map(p => [p.id, p.name_th, p.name_en] as [number, string, string])

// a: [id, nameTh, nameEn, provinceId]
const amphures = rawData.amphures
  .filter(a => !a.deleted_at)
  .map(a => [a.id, a.name_th, a.name_en, a.province_id] as [number, string, string, number])

// t: [id, nameTh, nameEn, amphureId, zipCode]
const tambons = rawData.tambons
  .filter(t => !t.deleted_at)
  .map(t => [t.id, t.name_th, t.name_en, t.amphure_id, String(t.zip_code)] as [number, string, string, number, string])

console.log(`Compact data: ${provinces.length} provinces, ${amphures.length} amphures, ${tambons.length} tambons`)

const output = `// AUTO-GENERATED — do not edit manually
// Run: npm run generate-data

export type CompactProvince = [number, string, string]           // [id, nameTh, nameEn]
export type CompactAmphure  = [number, string, string, number]  // [id, nameTh, nameEn, provinceId]
export type CompactTambon   = [number, string, string, number, string] // [id, nameTh, nameEn, amphureId, zipCode]

export const p: CompactProvince[] = ${JSON.stringify(provinces)}
export const a: CompactAmphure[]  = ${JSON.stringify(amphures)}
export const t: CompactTambon[]   = ${JSON.stringify(tambons)}
`

writeFileSync(outFile, output, 'utf-8')
console.log(`Written to ${outFile}`)
