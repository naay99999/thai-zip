---
title: formatter
description: อ้างอิง API ของ formatThaiAddressSuggestion — แปลง ThaiAddressRecord เป็น ThaiAddressSuggestion สำหรับแสดงผล
---

`import { formatThaiAddressSuggestion } from 'thaizip'`

## `formatThaiAddressSuggestion`

```ts
function formatThaiAddressSuggestion(
  record: ThaiAddressRecord,
  options?: FormatSuggestionOptions,
): ThaiAddressSuggestion
```

แปลง `ThaiAddressRecord` (ผลลัพธ์ดิบจาก `searchThaiAddress`) ให้เป็น `ThaiAddressSuggestion` ที่มี label สำหรับแสดงในช่อง dropdown พร้อมใช้งาน

### พารามิเตอร์

| ชื่อ | ชนิด | ค่าเริ่มต้น | คำอธิบาย |
|---|---|---|---|
| `record` | `ThaiAddressRecord` | — (จำเป็น) | record หนึ่งรายการจากผลลัพธ์ `searchThaiAddress` |
| `options?` | `FormatSuggestionOptions` | `undefined` | ตัวเลือกภาษาของ `label` |

**`FormatSuggestionOptions`:**

| ชื่อ | ชนิด | ค่าเริ่มต้น | คำอธิบาย |
|---|---|---|---|
| `locale?` | `'th' \| 'en'` | `'th'` | ภาษาของ field `label` — ถ้าไม่ใช่ `'en'` เป๊ะ ๆ จะได้ `label` เป็นภาษาไทยเสมอ |

### คืนค่า

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

### หมายเหตุ

- `id` คือ `String(record.tambonId)` — เป็นค่าเดียวกับที่ `selectSuggestion` ของ `useThaiAddressAutocomplete` ใช้ lookup กลับไปยัง record ต้นฉบับแบบ O(1)
- `labelTh` และ `labelEn` ถูกสร้างมาเสมอทั้งคู่ ไม่ว่าจะเลือก `locale` ไหน — รูปแบบคือ `` `${tambon} > ${amphure} > ${province} ${zipCode}` `` (ใช้ชื่อภาษาที่ตรงกันทั้งสามระดับ)
- `label` ตาม `options.locale`: เป็น `labelEn` เมื่อ `options?.locale === 'en'` เป๊ะ ๆ เท่านั้น กรณีอื่นทั้งหมด (รวมถึงไม่ส่ง `options` มาเลย) ได้ `labelTh`
- field ที่เหลือ (`tambon`, `amphure`, `province`, `zipCode` และคู่ `...En`) คัดลอกมาจาก `record` ตรง ๆ ไม่มีการแปลงเพิ่ม

### ตัวอย่าง

```ts
import { formatThaiAddressSuggestion, searchThaiAddress } from 'thaizip'

const records = searchThaiAddress(index, 'ลาดพร้าว')
const suggestions = records.map((r) => formatThaiAddressSuggestion(r))
// suggestions[0].label === suggestions[0].labelTh (locale เริ่มต้นเป็น 'th')

const enSuggestions = records.map((r) => formatThaiAddressSuggestion(r, { locale: 'en' }))
// enSuggestions[0].label === enSuggestions[0].labelEn
```
