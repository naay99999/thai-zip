---
title: types
description: อ้างอิง type ทั้งหมดที่ thaizip export ออกมา — ThaiAddressRecord, TrigramIndex, SearchOptions และอื่น ๆ
---

`import type { ... } from 'thaizip'`

ทุก type ในหน้านี้ export จาก entry point หลัก `thaizip` ยกเว้น `UseThaiAddressAutocompleteOptions` ซึ่ง export จาก `thaizip/react` (`import type { UseThaiAddressAutocompleteOptions } from 'thaizip/react'`) — ดูรายละเอียดเต็มของ hook ที่ใช้ type นี้ในหน้า [react](../react/)

## `ThaiAddressRecord`

Record ที่อยู่หนึ่งรายการ (หนึ่งตำบล) — หน่วยข้อมูลพื้นฐานที่ `searchThaiAddress`, `lookupByZipCode`, และฟังก์ชัน enumeration ทั้งหมดคืนค่ากลับมา

```ts
type ThaiAddressRecord = {
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
```

10 field ทั้งหมด: `provinceId`, `provinceNameTh`, `provinceNameEn`, `amphureId`, `amphureNameTh`, `amphureNameEn`, `tambonId`, `tambonNameTh`, `tambonNameEn`, `zipCode` — `zipCode` เป็น `string` เสมอ (ไม่ใช่ `number`) แม้ในข้อมูลดิบ (`RawTambon.zip_code`) จะเป็น `string | number` ก็ตาม

## `TrigramIndex`

โครงสร้างดัชนีสำหรับค้นหา สร้างขึ้นโดย `buildThaiAddressIndex` หรือ `loadDefaultIndex` เท่านั้น — เป็น type ทึบ (opaque) ในทางปฏิบัติ **ไม่ควรสร้างเองด้วยมือ**

```ts
type TrigramIndex = {
  map: Map<string, Set<number>>
  records: ThaiAddressRecord[]
  zipIndex: Map<string, number[]>
  normTambon: string[]
  normTambonEn: string[]
  byProvince: Map<number, number[]>
  byAmphure: Map<number, number[]>
}
```

- `map` — inverted index จาก trigram (3 ตัวอักษร) ไปยังเซตของ index ใน `records`
- `records` — record ทั้งหมด (หลังกรอง soft-deleted และ orphan แล้ว)
- `zipIndex` — จากรหัสไปรษณีย์ไปยังอาเรย์ของ index ใน `records` ที่มีรหัสนั้น (ใช้โดย `lookupByZipCode`)
- `normTambon` / `normTambonEn` — ชื่อตำบลที่ normalize แล้ว (ไทย/อังกฤษ) ขนานไปกับ `records` (index เดียวกัน) ใช้โดยตัวจัดอันดับผลการค้นหา
- `byProvince` / `byAmphure` — index ใน `records` จัดกลุ่มตาม `provinceId`/`amphureId` (เรียงตามลำดับที่ถูกใส่เข้าไป) ใช้โดย `listProvinces`/`listAmphures`/`listTambons`

## `ThaiAddressSuggestion`

ผลลัพธ์ที่ผ่าน `formatThaiAddressSuggestion` แล้ว พร้อมแสดงใน UI dropdown

```ts
type ThaiAddressSuggestion = {
  id: string
  label: string
  labelTh: string
  labelEn: string
  tambon: string
  tambonEn: string
  amphure: string
  amphureEn: string
  province: string
  provinceEn: string
  zipCode: string
}
```

ดูรายละเอียดพฤติกรรมของแต่ละ field ในหน้า [formatter](../formatter/)

## `ResolvedThaiAddress`

ที่อยู่ที่ resolve แล้ว มีชื่อ field สองชุด (ไทย/อังกฤษ) — คืนค่าจาก `resolveThaiAddress` และจาก `selectSuggestion` ของ `useThaiAddressAutocomplete`

```ts
type ResolvedThaiAddress = {
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
```

ดูรายละเอียดพฤติกรรมในหน้า [resolver](../resolver/)

## `ProvinceSummary` / `AmphureSummary` / `TambonSummary`

Type ที่คืนค่าจากฟังก์ชัน enumeration (`listProvinces`/`listAmphures`/`listTambons`) — ดูรายละเอียดในหน้า [enumerate](../enumerate/)

```ts
type ProvinceSummary = {
  id: number
  nameTh: string
  nameEn: string
}

type AmphureSummary = {
  id: number
  nameTh: string
  nameEn: string
  provinceId: number
}

type TambonSummary = {
  id: number
  nameTh: string
  nameEn: string
  amphureId: number
  zipCode: string
}
```

## `SearchOptions`

ตัวเลือกของ `searchThaiAddress` และ `lookupByZipCode` — ดูค่าเริ่มต้นและพฤติกรรมของแต่ละ field ในหน้า [search](../search/)

```ts
type SearchOptions = {
  limit?: number
  threshold?: number
  zipLimit?: number
  romanizationAliases?: boolean
}
```

## `BuildIndexOptions`

ตัวเลือกของ `buildThaiAddressIndex` — ดูรายละเอียดในหน้า [data](../data/)

```ts
type BuildIndexOptions = {
  onSkip?: (tambon: RawTambon) => void
  validate?: boolean
}
```

## `RawData` และตารางข้อมูลดิบ

รูปแบบข้อมูลที่ `buildThaiAddressIndex`/`validateRawData` รับเข้า — field เป็น snake_case ตามข้อมูลราชการต้นฉบับ (ต่างจาก `ThaiAddressRecord` ที่เป็น camelCase)

```ts
type RawData = {
  geographies?: RawGeography[] // optional — buildThaiAddressIndex ไม่ใช้ field นี้เลย
  provinces: RawProvince[]
  amphures: RawAmphure[]
  tambons: RawTambon[]
}

type RawGeography = {
  id: number
  name: string
  deleted_at: string | null
}

type RawProvince = {
  id: number
  name_th: string
  name_en: string
  geography_id: number
  deleted_at: string | null
}

type RawAmphure = {
  id: number
  name_th: string
  name_en: string
  province_id: number
  deleted_at: string | null
}

type RawTambon = {
  id: number
  zip_code: number | string
  name_th: string
  name_en: string
  amphure_id: number
  deleted_at: string | null
}
```

`deleted_at` เป็น soft-delete marker — วันที่แบบ string หรือ `null` แถวที่ `deleted_at` ไม่เป็น `null` จะถูกข้ามตอนสร้าง index (ดูรายละเอียดในหน้า [data](../data/))

## Type เสริมอื่น ๆ

Type เล็ก ๆ อีกสองตัวที่ใช้ประกอบ type ด้านบน:

```ts
/** ภาษาของ field label ที่ format ออกมา */
type AddressLocale = 'th' | 'en'

/** ตัวเลือกของ formatThaiAddressSuggestion */
type FormatSuggestionOptions = {
  locale?: AddressLocale
}
```
