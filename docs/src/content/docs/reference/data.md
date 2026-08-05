---
title: data
description: อ้างอิง API ของ loadDefaultIndex, clearDefaultIndex, buildThaiAddressIndex และ validateRawData
---

ฟังก์ชันในหน้านี้มาจากสอง entry point แยกกัน — สังเกต import path ในแต่ละหัวข้อให้ดี:

- `loadDefaultIndex` และ `clearDefaultIndex` มาจาก **`thaizip/data`** (ก้อนข้อมูลทั้งประเทศ ~132 KB gzip แยก entry point ไว้เพื่อให้ tree-shake ได้)
- `buildThaiAddressIndex` และ `validateRawData` มาจาก **`thaizip`** (แกนหลัก ไม่ผูกกับข้อมูล default)

## `loadDefaultIndex`

```ts
function loadDefaultIndex(): Promise<TrigramIndex>
```

`import { loadDefaultIndex } from 'thaizip/data'`

โหลดข้อมูลที่อยู่ทั้งประเทศที่แถมมากับไลบรารี (`src/data/defaultData.ts`) แบบ lazy ผ่าน dynamic `import()` แล้วสร้าง `TrigramIndex` ด้วย `buildThaiAddressIndex({ validate: false })` ผลลัพธ์ถูก cache ไว้เป็น singleton ระดับโมดูล

### พารามิเตอร์

ไม่มีพารามิเตอร์

### คืนค่า

`Promise<TrigramIndex>` — resolve เป็นดัชนีเดียวกันทุกครั้งหลังจากโหลดสำเร็จครั้งแรก (module-level singleton)

### หมายเหตุ

- การเรียกครั้งแรกใช้เวลาราว 30–40 ms แบบ synchronous บน main thread (ตอนสร้าง index จริง หลัง `import()` resolve) — ควรเรียกตอน mount คอมโพเนนต์หรือตอนโหลด route ไว้ล่วงหน้า ไม่ควรรอให้ผู้ใช้พิมพ์ตัวอักษรแรกก่อนค่อยเรียก
- เรียกซ้ำหลายครั้งพร้อมกัน (เช่นจากหลายคอมโพเนนต์) จะได้ `Promise` เดียวกันที่ยังไม่ resolve (in-flight promise ถูกแชร์กัน) ไม่สร้าง index ซ้ำ
- เรียก build ด้วย `{ validate: false }` เพราะข้อมูล default ผ่านการ validate มาแล้วตอน `generate-data`

### ตัวอย่าง

```ts
import { loadDefaultIndex } from 'thaizip/data'
import { searchThaiAddress } from 'thaizip'

const index = await loadDefaultIndex()
searchThaiAddress(index, 'ลาดพร้าว')
```

## `clearDefaultIndex`

```ts
function clearDefaultIndex(): void
```

`import { clearDefaultIndex } from 'thaizip/data'`

ล้าง singleton ที่ `loadDefaultIndex` cache ไว้ ทำให้การเรียก `loadDefaultIndex()` ครั้งถัดไปสร้าง index ใหม่อีกรอบ

### พารามิเตอร์

ไม่มีพารามิเตอร์

### คืนค่า

`void`

### หมายเหตุ

- ใช้หลักในเทสต์ เพื่อแยก state ของแต่ละเทสต์ออกจากกัน (ไม่ให้เทสต์หนึ่งเห็น index ที่ถูก cache ไว้จากเทสต์ก่อนหน้า)
- ถ้ามี `loadDefaultIndex()` ที่กำลังโหลดอยู่ (in-flight) ตอนเรียก `clearDefaultIndex()` ผลลัพธ์ของการโหลดครั้งนั้นจะไม่ถูก commit เข้า cache ใหม่เมื่อโหลดเสร็จ (ป้องกัน race condition ระหว่าง clear กับ load ที่ค้างอยู่)

### ตัวอย่าง

```ts
import { loadDefaultIndex, clearDefaultIndex } from 'thaizip/data'

afterEach(() => {
  clearDefaultIndex()
})
```

## `buildThaiAddressIndex`

```ts
function buildThaiAddressIndex(data: RawData, options?: BuildIndexOptions): TrigramIndex
```

`import { buildThaiAddressIndex } from 'thaizip'`

สร้าง `TrigramIndex` จากข้อมูลของคุณเอง (แทนข้อมูล default) — join ตาราง `provinces`/`amphures`/`tambons` เข้าด้วยกัน ข้ามแถวที่ soft-deleted แล้วสร้าง trigram inverted index, `zipIndex`, `normTambon`/`normTambonEn`, และ grouping `byProvince`/`byAmphure` สำหรับ enumeration API

### พารามิเตอร์

| ชื่อ | ชนิด | ค่าเริ่มต้น | คำอธิบาย |
|---|---|---|---|
| `data` | `RawData` | — (จำเป็น) | ข้อมูลดิบ 4 ตาราง (`geographies?`, `provinces`, `amphures`, `tambons`) — ดูรายละเอียด field ในหน้า [types](../types/) |
| `options?` | `BuildIndexOptions` | `undefined` | ตัวเลือกการสร้าง index |

**`BuildIndexOptions`:**

| ชื่อ | ชนิด | ค่าเริ่มต้น | คำอธิบาย |
|---|---|---|---|
| `onSkip?` | `(tambon: RawTambon) => void` | `undefined` | callback ที่ถูกเรียกสำหรับตำบลแต่ละรายการที่ถูกข้าม เพราะ `amphure_id` อ้างถึงอำเภอที่ไม่มีอยู่จริงหรือถูก soft-delete ไปแล้ว (รวมถึงกรณีที่ตัว amphure เจอ แต่ `province_id` ของมันอ้างถึงจังหวัดที่ไม่มีอยู่จริง/ถูกลบ) |
| `validate?` | `boolean` | `true` | รัน `validateRawData(data)` ก่อนสร้าง index หรือไม่ — วัดผลแล้วไม่มีผลกระทบด้าน performance ที่สังเกตได้แม้กับข้อมูลเต็มชุด จึงแนะนำให้เปิดไว้เสมอสำหรับข้อมูลที่ไม่ได้สร้างเอง |

### คืนค่า

`TrigramIndex` — ดูโครงสร้างเต็มในหน้า [types](../types/)

### หมายเหตุ

- แถวที่ `deleted_at` ไม่เป็น `null` ในทั้งสามตารางจะถูกข้าม (จังหวัด/อำเภอถูกกรองออกจาก lookup map ก่อน; ตำบลถูกข้ามด้วย `continue` ตรง ๆ)
- ตำบลที่ `amphure_id` หาไม่เจอในแผนที่อำเภอที่ยังไม่ถูกลบ หรืออำเภอนั้นมี `province_id` หาไม่เจอในแผนที่จังหวัดที่ยังไม่ถูกลบ จะถูกข้ามและส่งเข้า `onSkip` (ถ้ามี) ทั้งสองกรณี
- trigram ของจังหวัดและอำเภอถูกคำนวณล่วงหน้าครั้งเดียวต่อ parent ที่ไม่ซ้ำกัน (ไม่คำนวณซ้ำทุกตำบลที่ใช้ parent เดียวกัน)

### ตัวอย่าง

```ts
import { buildThaiAddressIndex } from 'thaizip'

const index = buildThaiAddressIndex(
  { provinces, amphures, tambons },
  { onSkip: (tambon) => console.warn('skipped', tambon.name_th) },
)
```

## `validateRawData`

```ts
function validateRawData(data: RawData): void
```

`import { validateRawData } from 'thaizip'`

ตรวจสอบว่าข้อมูล `RawData` มี runtime type ตรงตามที่ `buildThaiAddressIndex` ต้องการหรือไม่ เหมาะสำหรับ consumer ที่สร้าง index จากข้อมูลของตัวเอง (CSV, CMS, ชุดข้อมูลส่วนตัว) ที่อยากได้ error ที่อ่านเข้าใจง่ายทันทีแทนที่จะ crash แบบไม่รู้สาเหตุลึกในตัว normalizer หรือได้ label เป็น `"undefined"` แบบเงียบ ๆ

### พารามิเตอร์

| ชื่อ | ชนิด | ค่าเริ่มต้น | คำอธิบาย |
|---|---|---|---|
| `data` | `RawData` | — (จำเป็น) | ข้อมูลดิบที่ต้องการตรวจสอบ |

### คืนค่า

`void` — ไม่คืนค่าอะไรถ้าข้อมูลถูกต้องทั้งหมด

### หมายเหตุ

- โยน `TypeError` (ข้อความขึ้นต้นด้วย `[thaizip]`) ทันทีที่เจอ field แรกที่ผิด โดยระบุชื่อตาราง, `id` ของแถวที่ผิด, ชื่อ field, และ type ที่พบจริง เช่น `[thaizip] province 12: expected string for name_th, got number`
- ตรวจสอบ: `provinces[].id` (`number`), `name_th`/`name_en` (`string`); `amphures[].id` (`number`), `name_th`/`name_en` (`string`), `province_id` (`number`); `tambons[].id` (`number`), `name_th`/`name_en` (`string`), `zip_code` (`string` หรือ `number`), `amphure_id` (`number`)
- **ไม่กรอง**แถว soft-deleted (`deleted_at`) ก่อนตรวจสอบ — ตรวจทุกแถวที่ส่งเข้ามา ไม่ว่าจะถูกลบไปแล้วหรือไม่
- `buildThaiAddressIndex` เรียกฟังก์ชันนี้ให้อัตโนมัติเมื่อ `options.validate !== false`

### ตัวอย่าง

```ts
import { validateRawData } from 'thaizip'

try {
  validateRawData({ provinces, amphures, tambons })
} catch (err) {
  // TypeError: [thaizip] tambon 100101: expected number for amphure_id, got string
}
```
