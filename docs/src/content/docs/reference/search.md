---
title: search
description: อ้างอิง API ของ searchThaiAddress, lookupByZipCode และฟังก์ชันเสริมที่ใช้ในเบื้องหลัง
---

`import { searchThaiAddress, lookupByZipCode } from 'thaizip'`

## `searchThaiAddress`

```ts
function searchThaiAddress(
  index: TrigramIndex,
  query: string,
  options?: SearchOptions,
): ThaiAddressRecord[]
```

ค้นหาที่อยู่แบบ fuzzy ด้วยชื่อตำบล/อำเภอ/จังหวัด (ไทยหรืออังกฤษ) หรือรหัสไปรษณีย์ ค่าที่คืนกลับเป็น `ThaiAddressRecord[]` โดยตรง — ไม่ต้อง format หรือแปลงเพิ่มก่อนใช้

### พารามิเตอร์

| ชื่อ | ชนิด | ค่าเริ่มต้น | คำอธิบาย |
|---|---|---|---|
| `index` | `TrigramIndex` | — (จำเป็น) | ดัชนีที่สร้างจาก `buildThaiAddressIndex` หรือ `loadDefaultIndex` |
| `query` | `string` | — (จำเป็น) | ข้อความค้นหา หรือรหัสไปรษณีย์ (ตัวเลขล้วนตั้งแต่ 2 หลัก) |
| `options?` | `SearchOptions` | `undefined` | ตัวเลือกเพิ่มเติม (ดูตารางด้านล่าง) |

**`SearchOptions`:**

| ชื่อ | ชนิด | ค่าเริ่มต้น | คำอธิบาย |
|---|---|---|---|
| `limit?` | `number` | `10` | จำกัดจำนวนผลลัพธ์ — มีผลเฉพาะ query แบบข้อความ ไม่มีผลกับ query แบบรหัสไปรษณีย์ |
| `threshold?` | `number` | `0.4` | คะแนนขั้นต่ำ (0–1) ที่ผลลัพธ์ต้องได้ถึงจะถูกนับว่า match — มีผลเฉพาะ query แบบข้อความ |
| `zipLimit?` | `number` | `Infinity` | จำกัดจำนวนผลลัพธ์เมื่อ query เป็นรหัสไปรษณีย์ (ตัวเลขล้วน) ไม่จำกัดโดยค่าเริ่มต้นเพราะรหัสเดียวอาจครอบคลุมได้หลายสิบตำบล |
| `romanizationAliases?` | `boolean` | `true` | แปลงคำสะกดอังกฤษที่ไม่ใช่ RTGS (เช่น `lardprao`) ให้ตรงกับข้อมูลในระบบก่อนค้นหา — มีผลเฉพาะ query ที่มีตัวอักษรละติน |

### คืนค่า

`ThaiAddressRecord[]` เรียงตามลำดับความเกี่ยวข้อง (ดูหัวข้อการจัดอันดับด้านล่าง) คืนค่าอาเรย์ว่าง `[]` เสมอเมื่อไม่พบผลลัพธ์ — ไม่โยน exception

### หมายเหตุ

- คืนค่า `[]` ทันทีถ้า `index` หรือ `query` เป็นค่าว่าง/falsy, ถ้า `query.length > 1000` ก่อน normalize, หรือถ้าข้อความหลัง normalize ยาวเกิน 300 ตัวอักษร
- ก่อนค้นหาทุกครั้ง `query` จะผ่าน `normalizeThaiAddressText` เสมอ (ดูด้านล่าง)
- ถ้าข้อความหลัง normalize เป็นตัวเลขล้วน (`/^\d+$/`) และยาวตั้งแต่ 2 หลักขึ้นไป จะถูกส่งต่อไปยัง `lookupByZipCode` โดยอัตโนมัติ พร้อมส่งต่อเฉพาะ `zipLimit` เท่านั้น (`limit`, `threshold`, `romanizationAliases` ไม่มีผลกับ path นี้) — ถ้าเป็นตัวเลขล้วนแต่สั้นกว่า 2 หลัก คืนค่า `[]`
- ข้อความหลัง normalize ที่สั้นกว่า 3 ตัวอักษร (และไม่ใช่รหัสไปรษณีย์) คืนค่า `[]` เสมอ เพราะ trigram ของสตริงสั้นกว่า 3 ตัวจะจับคู่ได้แบบไม่มีความหมาย
- ถ้า query ที่ normalize แล้วมีตัวอักษรละติน (`/[a-z]/i`) และ `romanizationAliases !== false` จะรัน `applyRomanizationAliases` ก่อนสกัด trigram
- **การจัดอันดับ** เรียงตาม 3 ขั้นตามลำดับ: (1) `score = hits / queryTrigrams.size` มากไปน้อย, (2) `matchRank` มากไปน้อย — `3` เมื่อชื่อตำบลเอง (ไทยหรืออังกฤษ) ตรงกับ query แบบเป๊ะ, `2` เมื่อขึ้นต้นด้วย query, `1` เมื่อมี query อยู่ในชื่อ, `0` เมื่อไม่ตรงชื่อตัวเองเลย (ตรงแค่ผ่านอำเภอ/จังหวัด), (3) การเรียงตามตัวอักษรไทยบน `provinceNameTh` → `amphureNameTh` → `tambonNameTh` ด้วย `Intl.Collator('th')` ที่สร้างไว้ล่วงหน้าระดับโมดูล (ไม่สร้างใหม่ในลูป)
- เพื่อประสิทธิภาพ ขั้นที่ (3) (การเรียงด้วย collator) จะรันเฉพาะช่วง top window ขนาด `Math.max(limit * 4, 50)` รายการแรกหลังเรียงด้วย (1)+(2) แบบตัวเลขล้วนก่อนแล้วเท่านั้น ไม่รันกับผลลัพธ์ทั้งหมด

### ตัวอย่าง

```ts
import { searchThaiAddress } from 'thaizip'

searchThaiAddress(index, 'ลาดพร้าว', { limit: 5 })
searchThaiAddress(index, 'bang rak')
searchThaiAddress(index, '10500') // ไปที่ zip path โดยอัตโนมัติ
```

## `lookupByZipCode`

```ts
function lookupByZipCode(
  index: TrigramIndex,
  zip: string,
  options?: SearchOptions,
): ThaiAddressRecord[]
```

ค้นหาด้วยรหัสไปรษณีย์โดยตรง (แบบเป๊ะหรือขึ้นต้นด้วย) `searchThaiAddress` เรียกฟังก์ชันนี้ให้อัตโนมัติเมื่อ query เป็นตัวเลขล้วน แต่เรียกตรง ๆ เองก็ได้

### พารามิเตอร์

| ชื่อ | ชนิด | ค่าเริ่มต้น | คำอธิบาย |
|---|---|---|---|
| `index` | `TrigramIndex` | — (จำเป็น) | ดัชนีที่ใช้ค้นหา |
| `zip` | `string` | — (จำเป็น) | รหัสไปรษณีย์เต็มหรือบางส่วน ต้องเป็นตัวเลขล้วนความยาวอย่างน้อย 2 หลัก มิฉะนั้นคืนค่า `[]` |
| `options?` | `SearchOptions` | `undefined` | ใช้เฉพาะ field `zipLimit` เท่านั้น field อื่นถูกละเว้น |

### คืนค่า

`ThaiAddressRecord[]` เรียงให้รายการที่ `zipCode` ตรงกับ `zip` แบบเป๊ะขึ้นก่อนเสมอ ตามด้วยรายการที่ขึ้นต้นด้วย `zip` เรียงจากรหัสน้อยไปมาก แล้วตัดจำนวนด้วย `options.zipLimit` (ค่าเริ่มต้น `Infinity` — **ไม่ใช่** `limit`)

### หมายเหตุ

- การค้นหาจะไล่สแกนทุกรหัสไปรษณีย์ใน `index.zipIndex` แล้วเช็คว่ารหัสนั้นขึ้นต้นด้วย `zip` หรือไม่ (`startsWith`) — เป็นแบบนี้เสมอไม่ว่า `zip` จะเป็นรหัส 5 หลักเต็มหรือรหัสบางส่วน จึงมีความซับซ้อนแบบ O(จำนวนรหัสไปรษณีย์ทั้งหมดในดัชนี) เสมอ ไม่ใช่ O(1) แม้กับรหัสเต็ม
- ผลลัพธ์**ไม่ถูกจำกัด**ด้วย `options.limit` — ใช้ `zipLimit` เท่านั้น เพราะรหัสไปรษณีย์เดียวอาจครอบคลุมได้หลายสิบตำบล (เช่น `45000` ครอบคลุมถึง 33 ตำบล)
- คืนค่า `[]` ถ้า `index` หรือ `zip` เป็นค่าว่าง หรือ `zip` ไม่ผ่าน `/^\d+$/` หรือสั้นกว่า 2 หลัก

### ตัวอย่าง

```ts
import { lookupByZipCode } from 'thaizip'

lookupByZipCode(index, '45000')              // exact match ก่อน
lookupByZipCode(index, '450')                // prefix scan
lookupByZipCode(index, '45000', { zipLimit: 10 })
```

## ฟังก์ชันเสริม

ฟังก์ชันสองตัวนี้ทำงานอยู่เบื้องหลัง `searchThaiAddress` และถูก export ออกมาด้วยเผื่อต้องใช้แยกกัน (เช่น normalize ข้อความก่อนเก็บ หรือขยาย alias เอง)

### `normalizeThaiAddressText`

```ts
function normalizeThaiAddressText(input: string): string
```

ตัดคำนำหน้าที่อยู่ไทยออกจากต้นข้อความ ทั้งรูปแบบเต็ม (`จังหวัด`/`อำเภอ`/`ตำบล`/`แขวง`/`เขต`) และแบบย่อ (`จ.`/`อ.`/`ต.`/`ข.`) ตัดวรรณยุกต์ไทยออก แล้วแปลงเป็นตัวพิมพ์เล็กทั้งหมด ใช้ทั้งตอนสร้าง index (กับข้อมูล) และตอนค้นหา (กับ query) เพื่อให้ทั้งสองฝั่งอยู่ในรูปแบบเดียวกัน

| ชื่อ | ชนิด | ค่าเริ่มต้น | คำอธิบาย |
|---|---|---|---|
| `input` | `string` | — (จำเป็น) | ข้อความดิบ |

**คืนค่า:** `string` — ข้อความที่ normalize แล้ว หรือ `''` ถ้า `input` เป็นค่าว่าง/falsy

```ts
normalizeThaiAddressText('จังหวัดลาดพร้าว') // ตัดคำนำหน้า 'จังหวัด' และวรรณยุกต์ออก
```

### `applyRomanizationAliases`

```ts
function applyRomanizationAliases(normalized: string): string
```

แปลงคำสะกดภาษาอังกฤษที่ไม่ใช่ RTGS (เช่น `lardprao`, `krungthep`) ให้ตรงกับสตริง RTGS ที่ปรากฏจริงในชุดข้อมูล ก่อนสกัด trigram ใช้เฉพาะกับ query ที่เป็นตัวอักษรละตินเท่านั้น (`searchThaiAddress` เรียกให้อัตโนมัติเมื่อ `romanizationAliases !== false`)

| ชื่อ | ชนิด | ค่าเริ่มต้น | คำอธิบาย |
|---|---|---|---|
| `normalized` | `string` | — (จำเป็น) | ข้อความที่ผ่าน `normalizeThaiAddressText` มาแล้ว (lowercase, ตัดคำนำหน้า/วรรณยุกต์แล้ว) |

**คืนค่า:** `string` — ถ้า `normalized` ตรงกับ key ใน alias dictionary คืนค่า RTGS string ที่แม็พไว้ทันที ถ้าไม่ตรงจะลองตัดคำศัพท์ทางการปกครองภาษาอังกฤษ (`district`, `province`, `changwat`, `amphoe`, `amphur`, `sub-district`) ออกก่อนแล้วลองแม็พอีกครั้ง ถ้ายังไม่ตรงคืนค่าเดิม (หรือค่าที่ตัดคำศัพท์แล้วถ้าต่างจากเดิม)

### หมายเหตุ

- ต้องเป็นฟังก์ชัน pure — รันทุกครั้งที่มีการกดคีย์บอร์ด
- ข้อความภาษาไทยจะถูกคืนค่ากลับโดยไม่แก้ไข
- alias บางตัวจงใจแม็พไปยัง typo ที่มีอยู่จริงในชุดข้อมูล (`loburi`, `buogkan`) เพราะนั่นคือสิ่งที่ index จริงมีอยู่

```ts
applyRomanizationAliases('lardprao') // 'lat phrao'
applyRomanizationAliases('ลาดพร้าว') // 'ลาดพร้าว' (ข้อความไทยไม่ถูกแก้ไข)
```
