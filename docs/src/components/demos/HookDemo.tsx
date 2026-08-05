import { useState } from 'react'
import { useThaiAddressAutocomplete } from 'thaizip/react'
import type { ResolvedThaiAddress, TrigramIndex } from 'thaizip'
import { useDefaultIndex } from './useDefaultIndex'
import './demos.css'

const STRINGS = {
  th: {
    placeholder: 'พิมพ์เพื่อค้นหา แล้วคลิกเลือกผลลัพธ์…',
    loading: 'กำลังโหลดข้อมูลที่อยู่…',
    error: 'โหลดข้อมูลไม่สำเร็จ',
    retry: 'ลองใหม่',
    selected: 'ResolvedThaiAddress ที่ได้จาก onSelect:',
  },
  en: {
    placeholder: 'Type to search, then click a result…',
    loading: 'Loading address data…',
    error: 'Failed to load address data',
    retry: 'Retry',
    selected: 'ResolvedThaiAddress from onSelect:',
  },
}

type Locale = 'th' | 'en'

function HookInner({ index, locale }: { index: TrigramIndex; locale: Locale }) {
  const t = STRINGS[locale]
  const [selected, setSelected] = useState<ResolvedThaiAddress | null>(null)
  const { query, setQuery, setQuerySilent, suggestions, isOpen, selectSuggestion } =
    useThaiAddressAutocomplete({ index, locale, onSelect: setSelected })

  return (
    <div className="tz-demo">
      <input
        className="tz-input"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t.placeholder}
        aria-label={t.placeholder}
      />
      {isOpen && (
        <ul className="tz-list">
          {suggestions.map((s) => (
            <li
              className="tz-item"
              key={s.id}
              style={{ cursor: 'pointer' }}
              onClick={() => {
                const resolved = selectSuggestion(s)
                if (resolved) setQuerySilent(s.label)
              }}
            >
              <span>{s.label}</span>
              <span className="tz-item-zip">{s.zipCode}</span>
            </li>
          ))}
        </ul>
      )}
      {selected && (
        <>
          <p className="tz-meta">{t.selected}</p>
          <pre className="tz-json">{JSON.stringify(selected, null, 2)}</pre>
        </>
      )}
    </div>
  )
}

export default function HookDemo({ locale = 'th' as Locale }) {
  const t = STRINGS[locale]
  const { index, error, retry } = useDefaultIndex()

  if (error)
    return (
      <div className="tz-demo tz-status tz-error">
        {t.error}
        <button onClick={retry}>{t.retry}</button>
      </div>
    )
  if (!index) return <div className="tz-demo tz-status">{t.loading}</div>
  return <HookInner index={index} locale={locale} />
}
