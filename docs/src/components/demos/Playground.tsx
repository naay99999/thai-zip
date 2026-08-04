import { useState } from 'react'
import { searchThaiAddress, formatThaiAddressSuggestion } from 'thaizip'
import type { AddressLocale } from 'thaizip'
import { useDefaultIndex } from './useDefaultIndex'
import './demos.css'

const STRINGS = {
  th: {
    placeholder: 'พิมพ์ชื่อที่อยู่หรือรหัสไปรษณีย์…',
    loading: 'กำลังโหลดข้อมูลที่อยู่…',
    error: 'โหลดข้อมูลไม่สำเร็จ',
    retry: 'ลองใหม่',
    empty: 'ไม่พบผลลัพธ์',
    threshold: 'threshold (คุณภาพขั้นต่ำของผลลัพธ์)',
    limit: 'limit (จำนวนผลลัพธ์ข้อความ)',
    zipUnlimited: 'zipLimit ไม่จำกัด (ค่าเริ่มต้น)',
    aliases: 'romanizationAliases (ขยายคำสะกดอังกฤษ)',
    labelLocale: 'ภาษาของ label',
    stats: (n: number, ms: string) => `พบ ${n} รายการ ใน ${ms} ms`,
  },
  en: {
    placeholder: 'Type an address or postal code…',
    loading: 'Loading address data…',
    error: 'Failed to load address data',
    retry: 'Retry',
    empty: 'No results',
    threshold: 'threshold (minimum match quality)',
    limit: 'limit (text-query result cap)',
    zipUnlimited: 'unlimited zipLimit (default)',
    aliases: 'romanizationAliases (expand English spellings)',
    labelLocale: 'Label locale',
    stats: (n: number, ms: string) => `${n} results in ${ms} ms`,
  },
}

export default function Playground({ locale = 'th' as 'th' | 'en' }) {
  const t = STRINGS[locale]
  const { index, error, retry } = useDefaultIndex()
  const [query, setQuery] = useState('ลาดพร้าว')
  const [threshold, setThreshold] = useState(0.4)
  const [limit, setLimit] = useState(10)
  const [zipUnlimited, setZipUnlimited] = useState(true)
  const [aliases, setAliases] = useState(true)
  const [labelLocale, setLabelLocale] = useState<AddressLocale>(locale)

  if (error)
    return (
      <div className="tz-demo tz-status tz-error">
        {t.error}
        <button onClick={retry}>{t.retry}</button>
      </div>
    )
  if (!index) return <div className="tz-demo tz-status">{t.loading}</div>

  let results: ReturnType<typeof searchThaiAddress> = []
  let elapsed = '0.0'
  if (query.trim()) {
    const start = performance.now()
    results = searchThaiAddress(index, query, {
      threshold,
      limit,
      zipLimit: zipUnlimited ? Infinity : limit,
      romanizationAliases: aliases,
    })
    elapsed = (performance.now() - start).toFixed(1)
  }

  return (
    <div className="tz-demo">
      <input
        className="tz-input"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t.placeholder}
        aria-label={t.placeholder}
      />
      <label>
        {t.threshold}: {threshold.toFixed(2)}
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={threshold}
          onChange={(e) => setThreshold(Number(e.target.value))}
          style={{ width: '100%' }}
        />
      </label>
      <label>
        {t.limit}
        <input
          className="tz-input"
          type="number"
          min={1}
          max={50}
          value={limit}
          onChange={(e) => setLimit(Math.max(1, Number(e.target.value) || 1))}
        />
      </label>
      <label>
        <input
          type="checkbox"
          checked={zipUnlimited}
          onChange={(e) => setZipUnlimited(e.target.checked)}
        />{' '}
        {t.zipUnlimited}
      </label>
      <label>
        <input
          type="checkbox"
          checked={aliases}
          onChange={(e) => setAliases(e.target.checked)}
        />{' '}
        {t.aliases}
      </label>
      <label>
        {t.labelLocale}
        <select
          value={labelLocale}
          onChange={(e) => setLabelLocale(e.target.value as AddressLocale)}
        >
          <option value="th">ไทย</option>
          <option value="en">English</option>
        </select>
      </label>
      {query.trim() !== '' && (
        <>
          <p className="tz-meta">{t.stats(results.length, elapsed)}</p>
          <ul className="tz-list">
            {results.length === 0 && <li className="tz-empty">{t.empty}</li>}
            {results.map((r) => {
              const s = formatThaiAddressSuggestion(r, { locale: labelLocale })
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
