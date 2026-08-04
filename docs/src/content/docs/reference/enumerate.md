---
title: enumerate
description: อ้างอิง API ของ listProvinces, listAmphures, listTambons สำหรับสร้าง dropdown แบบลดหลั่น
---

`import { listProvinces, listAmphures, listTambons } from 'thaizip'`

ฟังก์ชันทั้งสามตัวนี้ไม่ต้องมี query ข้อความ ใช้สำหรับสร้าง dropdown แบบลดหลั่น (จังหวัด → อำเภอ → ตำบล) โดยอ้างอิงจาก grouping (`byProvince`/`byAmphure`) ที่ถูกสร้างไว้ล่วงหน้าตอนสร้าง index แล้ว จึงไม่ต้องสแกน `records` ทั้งหมดทุกครั้งที่เรียก

## `listProvinces`

```ts
function listProvinces(index: TrigramIndex): ProvinceSummary[]
```

### พารามิเตอร์

| ชื่อ | ชนิด | ค่าเริ่มต้น | คำอธิบาย |
|---|---|---|---|
| `index` | `TrigramIndex` | — (จำเป็น) | ดัชนีที่ใช้ดึงรายชื่อจังหวัด |

### คืนค่า

`ProvinceSummary[]` — จังหวัดทั้ง 77 จังหวัด (ตามชุดข้อมูล default) แบบไม่ซ้ำ เรียงตามชื่อภาษาไทยด้วย `Intl.Collator('th')`

```ts
type ProvinceSummary = {
  id: number
  nameTh: string
  nameEn: string
}
```

### ตัวอย่าง

```ts
import { listProvinces } from 'thaizip'

const provinces = listProvinces(index) // 77 จังหวัด เรียงตามชื่อไทย
```

## `listAmphures`

```ts
function listAmphures(index: TrigramIndex, provinceId: number): AmphureSummary[]
```

### พารามิเตอร์

| ชื่อ | ชนิด | ค่าเริ่มต้น | คำอธิบาย |
|---|---|---|---|
| `index` | `TrigramIndex` | — (จำเป็น) | ดัชนีที่ใช้ดึงรายชื่ออำเภอ |
| `provinceId` | `number` | — (จำเป็น) | `id` ของจังหวัด (จาก `ProvinceSummary.id`) |

### คืนค่า

`AmphureSummary[]` — อำเภอ/เขตทั้งหมดในจังหวัดนั้นแบบไม่ซ้ำ เรียงตามชื่อภาษาไทย คืนค่าอาเรย์ว่าง `[]` ถ้า `provinceId` ไม่มีอยู่จริง (เช่นค่า `0` ตอนยังไม่ได้เลือก)

```ts
type AmphureSummary = {
  id: number
  nameTh: string
  nameEn: string
  provinceId: number
}
```

### ตัวอย่าง

```ts
import { listAmphures } from 'thaizip'

listAmphures(index, 1) // อำเภอ/เขตทั้งหมดในกรุงเทพมหานคร
```

## `listTambons`

```ts
function listTambons(index: TrigramIndex, amphureId: number): TambonSummary[]
```

### พารามิเตอร์

| ชื่อ | ชนิด | ค่าเริ่มต้น | คำอธิบาย |
|---|---|---|---|
| `index` | `TrigramIndex` | — (จำเป็น) | ดัชนีที่ใช้ดึงรายชื่อตำบล |
| `amphureId` | `number` | — (จำเป็น) | `id` ของอำเภอ (จาก `AmphureSummary.id`) |

### คืนค่า

`TambonSummary[]` — ตำบล/แขวงทั้งหมดในอำเภอนั้น เรียงตามชื่อภาษาไทย พร้อม `zipCode` ติดมากับแต่ละรายการ คืนค่าอาเรย์ว่าง `[]` ถ้า `amphureId` ไม่มีอยู่จริง

```ts
type TambonSummary = {
  id: number
  nameTh: string
  nameEn: string
  amphureId: number
  zipCode: string
}
```

### ตัวอย่าง

```ts
import { listTambons } from 'thaizip'

listTambons(index, 1001) // ตำบล/แขวงทั้งหมดในอำเภอนั้น พร้อม zipCode
```

## หมายเหตุร่วม

- ทั้งสามฟังก์ชันคืนค่าอาเรย์ว่าง `[]` เสมอสำหรับ id ที่ไม่รู้จัก — ไม่โยน exception จึงเขียน UI ที่ต้อง reset ตัวเลือกลูกเมื่อเปลี่ยนตัวเลือกแม่ได้ง่าย
- แต่ละ `byAmphure` entry แม็พกับตำบลเพียงรายการเดียว ดังนั้น `listTambons` ไม่ต้อง deduplicate เหมือน `listProvinces`/`listAmphures`
- ถ้า `index` ที่ส่งเข้ามาไม่มี `byProvince`/`byAmphure` (เช่น index รูปแบบเก่าที่สร้างขึ้นเอง) ทั้งสามฟังก์ชันจะ fallback ไปสแกน `index.records` ทั้งหมดแทน
