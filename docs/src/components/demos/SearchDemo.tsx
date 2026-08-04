import { useState } from 'react'
import { searchThaiAddress, formatThaiAddressSuggestion } from 'thaizip'
import { useDefaultIndex } from './useDefaultIndex'
import './demos.css'

const STRINGS = {
  th: {
    placeholder: 'พิมพ์ชื่อตำบล อำเภอ จังหวัด หรือรหัสไปรษณีย์…',
    loading: 'กำลังโหลดข้อมูลที่อยู่…',
    error: 'โหลดข้อมูลไม่สำเร็จ',
    retry: 'ลองใหม่',
    empty: 'ไม่พบผลลัพธ์',
  },
  en: {
    placeholder: 'Type a subdistrict, district, province, or postal code…',
    loading: 'Loading address data…',
    error: 'Failed to load address data',
    retry: 'Retry',
    empty: 'No results',
  },
}

type Props = { locale?: 'th' | 'en'; initialQuery?: string }

export default function SearchDemo({ locale = 'th', initialQuery = '' }: Props) {
  const t = STRINGS[locale]
  const { index, error, retry } = useDefaultIndex()
  const [query, setQuery] = useState(initialQuery)

  if (error)
    return (
      <div className="tz-demo tz-status tz-error">
        {t.error}
        <button onClick={retry}>{t.retry}</button>
      </div>
    )
  if (!index) return <div className="tz-demo tz-status">{t.loading}</div>

  const results = query.trim() ? searchThaiAddress(index, query) : []

  return (
    <div className="tz-demo">
      <input
        className="tz-input"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t.placeholder}
        aria-label={t.placeholder}
      />
      {query.trim() !== '' && (
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
      )}
    </div>
  )
}
