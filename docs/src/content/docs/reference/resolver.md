---
title: resolver
description: อ้างอิง API ของ resolveThaiAddress — แปลง ThaiAddressRecord เป็นออบเจ็กต์ที่อยู่แบบเต็มพร้อมชื่อ field สองชุด
---

`import { resolveThaiAddress } from 'thaizip'`

## `resolveThaiAddress`

```ts
function resolveThaiAddress(record: ThaiAddressRecord): ResolvedThaiAddress
```

แปลง `ThaiAddressRecord` ให้เป็น `ResolvedThaiAddress` — ออบเจ็กต์ที่อยู่ฉบับเต็มพร้อมชื่อ field สองชุดพร้อมกัน: ชุดตามธรรมเนียมไทย (`tambon`/`amphure`/`province`) และชุดตามธรรมเนียมอังกฤษ (`subdistrict`/`district`/`postalCode`) — ค่าเดียวกันทุกประการ เลือกใช้ชื่อไหนก็ได้ตอนบันทึกลงฐานข้อมูล

### พารามิเตอร์

| ชื่อ | ชนิด | ค่าเริ่มต้น | คำอธิบาย |
|---|---|---|---|
| `record` | `ThaiAddressRecord` | — (จำเป็น) | record ที่ต้องการแปลง (เช่นจากผลลัพธ์ `searchThaiAddress` หรือค่าที่ผู้ใช้เลือกจาก dropdown) |

### คืนค่า

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

### หมายเหตุ

- ไม่มีการแปลงหรือ format ข้อความเพิ่มเติม — เป็นการคัดลอก field จาก `record` ตรง ๆ ลงทั้งสองชื่อ
- ค่าที่ซ้ำกันเป็นคู่: `tambon` = `subdistrict`, `tambonEn` = `subdistrictEn`, `amphure` = `district`, `amphureEn` = `districtEn`, `zipCode` = `postalCode`
- ไม่มี field `provinceEn`-เทียบเท่าฝั่งอังกฤษแยกชื่อ — `province`/`provinceEn` ใช้ชื่อเดียวกันทั้งสองธรรมเนียม (ไม่มี `state` หรือชื่ออื่น)
- ใช้ในฟังก์ชัน `selectSuggestion` ของ `useThaiAddressAutocomplete` ภายใน เพื่อคืนค่าที่อยู่ที่ resolve แล้วให้ผู้เรียก

### ตัวอย่าง

```ts
import { resolveThaiAddress, searchThaiAddress } from 'thaizip'

const [record] = searchThaiAddress(index, 'ลาดพร้าว')
const address = resolveThaiAddress(record)

// ธรรมเนียมไทย
address.tambon   // 'ลาดพร้าว'
address.amphure
address.province
address.zipCode

// ธรรมเนียมอังกฤษ — ค่าเดียวกัน
address.subdistrict // === address.tambon
address.district    // === address.amphure
address.postalCode  // === address.zipCode
```
