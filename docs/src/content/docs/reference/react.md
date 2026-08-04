---
title: react
description: อ้างอิง API ของ useThaiAddressAutocomplete จาก thaizip/react — ตัวเลือกทั้งหมดและค่าที่คืนกลับ
---

`import { useThaiAddressAutocomplete } from 'thaizip/react'`

## `useThaiAddressAutocomplete`

```ts
function useThaiAddressAutocomplete(options: UseThaiAddressAutocompleteOptions): {
  query: string
  setQuery: (value: string) => void
  setQuerySilent: (value: string) => void
  suggestions: ThaiAddressSuggestion[]
  isOpen: boolean
  selectSuggestion: (item: ThaiAddressSuggestion) => ResolvedThaiAddress | null
  clear: () => void
}
```

Hook แบบ headless ที่ครอบ `searchThaiAddress` พร้อม debounce ในตัว และจัดการ state ของ query/suggestions ให้เสร็จสรรพ `react`/`react-dom` เป็น peer dependency แบบ optional และไฟล์ที่ build ออกมาแนบ `"use client"` มาให้แล้ว จึงใช้ได้ใน Next.js App Router โดยไม่ต้องห่อ wrapper เพิ่ม

### พารามิเตอร์ (`UseThaiAddressAutocompleteOptions`)

| ชื่อ | ชนิด | ค่าเริ่มต้น | คำอธิบาย |
|---|---|---|---|
| `index` | `TrigramIndex` | — (จำเป็น) | ดัชนีที่ใช้ค้นหา ต้องไม่เป็น `null`/`undefined` ตอนเรียก hook (hook เรียกแบบมีเงื่อนไขไม่ได้ — ถ้า index โหลดแบบ async ให้แยก component ชั้นนอกที่รอ index พร้อมก่อน) |
| `limit?` | `number` | `10` | ส่งต่อให้ `searchThaiAddress` ตรง ๆ — จำกัดจำนวนผลลัพธ์สำหรับ query แบบข้อความ |
| `debounce?` | `number` | `200` | ระยะเวลารอ (มิลลิวินาที) ก่อนค้นหาจริงหลังผู้ใช้หยุดพิมพ์ |
| `threshold?` | `number` | `0.4` | ส่งต่อให้ `searchThaiAddress` ตรง ๆ — คะแนนขั้นต่ำที่นับว่า match |
| `zipLimit?` | `number` | `undefined` | ส่งต่อให้ `searchThaiAddress` ตรง ๆ (ไม่ได้ตั้งค่า default ในตัว hook เอง — ถ้าไม่ส่งมา `searchThaiAddress` จะใช้ค่าเริ่มต้นของตัวเอง คือ `Infinity`) |
| `initialQuery?` | `string` | `''` | ค่าเริ่มต้นของ `query` ตอน render ครั้งแรก **ไม่ trigger การค้นหา** — เหมาะกับการเติมข้อความในช่อง input จากที่อยู่ที่เลือกไว้แล้ว (เช่น `defaultValues` ของ react-hook-form) โดยไม่เปิด dropdown ขึ้นมาเอง |
| `locale?` | `AddressLocale` (`'th' \| 'en'`) | `undefined` | ภาษาของ field `label` ใน `suggestions` ที่คืนกลับ ส่งต่อให้ `formatThaiAddressSuggestion` |
| `onSelect?` | `(address: ResolvedThaiAddress) => void` | `undefined` | เรียกหลังจาก `selectSuggestion` resolve ที่อยู่สำเร็จ |

### ค่าที่คืนกลับ

| ชื่อ | ชนิด | คำอธิบาย |
|---|---|---|
| `query` | `string` | ข้อความในช่องค้นหาปัจจุบัน |
| `setQuery` | `(value: string) => void` | ตั้งค่า query ใหม่ — trigger การค้นหาแบบ debounce (`debounce` มิลลิวินาทีหลังพิมพ์ครั้งสุดท้าย) |
| `setQuerySilent` | `(value: string) => void` | ตั้งค่า query โดย**ไม่**ค้นหาซ้ำและไม่เปิด dropdown ใหม่ — ใช้ตอนเอา label ที่เลือกแล้วมาแสดงในช่อง input หลัง `selectSuggestion`, หรือ seed ค่า query หลัง mount (เช่นตอน `defaultValues` แบบ async resolve เสร็จทีหลัง) |
| `suggestions` | `ThaiAddressSuggestion[]` | อาเรย์ผลลัพธ์จากการค้นหาล่าสุด |
| `isOpen` | `boolean` | `query.length > 0 && suggestions.length > 0` — ใช้ตัดสินใจว่าจะแสดง dropdown หรือไม่ |
| `selectSuggestion` | `(item: ThaiAddressSuggestion) => ResolvedThaiAddress \| null` | รับ suggestion (ออบเจ็กต์เต็มจาก `suggestions` ไม่ใช่แค่ `id`) แล้ว lookup record ต้นฉบับด้วย `item.id` แบบ O(1) ภายใน, resolve เป็น `ResolvedThaiAddress`, เคลียร์ `suggestions`, ยิง `onSelect`, แล้วคืนค่าที่ resolve ได้ — คืนค่า `null` (ไม่โยน exception) ถ้า `item.id` ไม่ตรงกับ suggestion ชุดล่าสุด (เช่นค้างจากผลลัพธ์เก่า) **ไม่แก้ `query`** ให้เอง — เรียก `setQuerySilent`/`clear` เองถ้าต้องการอัปเดตช่อง input ด้วย |
| `clear` | `() => void` | รีเซ็ต `query` และ `suggestions` กลับเป็นค่าว่าง |

### หมายเหตุ

- `index` ถูกอ่านผ่าน ref ภายใน hook เอง — object reference ใหม่ของ `index` ที่ส่งเข้ามาในแต่ละ render จะ**ไม่**รีสตาร์ท debounce timer ที่กำลังรออยู่ แต่ถ้า `index` เปลี่ยนค่าจริง ๆ (เช่นสลับไปใช้ข้อมูลชุดอื่น) และมี query ค้างอยู่ hook จะค้นหาซ้ำทันทีด้วย index ใหม่โดยไม่รอ debounce
- `initialQuery` และ `setQuerySilent('...')` (ค่าที่ไม่ว่าง) ต่างก็กัน 1 รอบการค้นหาที่จะเกิดขึ้นถัดไปไม่ให้ trigger — กันทั้ง effect debounce และ effect ที่ตอบสนองต่อ `index` เปลี่ยนพร้อมกัน (ทั้งสอง effect รันพร้อมกันตอน mount) ส่วน `setQuerySilent('')` (ค่าว่าง) จะไม่ arm การกันนี้ไว้ค้าง เพื่อไม่ให้กันคีย์สโตรกจริงถัดไปโดยไม่ตั้งใจ
- `query.length === 0` จะเคลียร์ `suggestions` ทันทีโดยไม่รอ debounce

### ตัวอย่าง

```tsx
import { useState } from 'react'
import { useThaiAddressAutocomplete } from 'thaizip/react'
import type { ResolvedThaiAddress, TrigramIndex } from 'thaizip'

function AddressAutocomplete({ index }: { index: TrigramIndex }) {
  const [selected, setSelected] = useState<ResolvedThaiAddress | null>(null)
  const { query, setQuery, setQuerySilent, suggestions, isOpen, selectSuggestion } =
    useThaiAddressAutocomplete({ index, onSelect: setSelected })

  return (
    <div>
      <input value={query} onChange={(e) => setQuery(e.target.value)} />
      {isOpen && (
        <ul>
          {suggestions.map((s) => (
            <li
              key={s.id}
              onClick={() => {
                const resolved = selectSuggestion(s)
                if (resolved) setQuerySilent(s.label)
              }}
            >
              {s.label} ({s.zipCode})
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

:::tip
อยากได้ component สำเร็จรูปแบบ shadcn (Base UI + Tailwind)? ดู [react-thaizip](https://github.com/naay99999/react-thai-zip)
:::
