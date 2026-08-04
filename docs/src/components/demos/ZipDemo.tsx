import { useState } from 'react'
import { lookupByZipCode, formatThaiAddressSuggestion } from 'thaizip'
import { useDefaultIndex } from './useDefaultIndex'
import './demos.css'

const STRINGS = {
  th: {
    placeholder: 'กรอกรหัสไปรษณีย์ เช่น 45000 หรือแค่ 450…',
    loading: 'กำลังโหลดข้อมูลที่อยู่…',
    error: 'โหลดข้อมูลไม่สำเร็จ',
    retry: 'ลองใหม่',
    empty: 'ไม่พบรหัสนี้',
    hint: 'ต้องเป็นตัวเลขอย่างน้อย 2 หลัก',
    count: (n: number) => `พบ ${n} ตำบล`,
  },
  en: {
    placeholder: 'Enter a postal code, e.g. 45000 or just 450…',
    loading: 'Loading address data…',
    error: 'Failed to load address data',
    retry: 'Retry',
    empty: 'No match for this code',
    hint: 'Needs at least 2 digits',
    count: (n: number) => `${n} subdistricts found`,
  },
}

export default function ZipDemo({ locale = 'th' as 'th' | 'en' }) {
  const t = STRINGS[locale]
  const { index, error, retry } = useDefaultIndex()
  const [zip, setZip] = useState('45000')

  if (error)
    return (
      <div className="tz-demo tz-status tz-error">
        {t.error}
        <button onClick={retry}>{t.retry}</button>
      </div>
    )
  if (!index) return <div className="tz-demo tz-status">{t.loading}</div>

  const trimmed = zip.trim()
  const valid = /^\d{2,}$/.test(trimmed)
  const results = valid ? lookupByZipCode(index, trimmed) : []

  return (
    <div className="tz-demo">
      <input
        className="tz-input"
        inputMode="numeric"
        value={zip}
        onChange={(e) => setZip(e.target.value)}
        placeholder={t.placeholder}
        aria-label={t.placeholder}
      />
      {trimmed !== '' && !valid && <p className="tz-meta">{t.hint}</p>}
      {valid && (
        <>
          <p className="tz-meta">{t.count(results.length)}</p>
          <ul className="tz-list">
            {results.length === 0 && <li className="tz-empty">{t.empty}</li>}
            {results.map((r) => {
              const s = formatThaiAddressSuggestion(r, { locale })
              return (
                <li className="tz-item" key={s.id}>
                  <span>{s.label}</span>
                  <span className="tz-item-zip">{s.zipCode}</span>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
