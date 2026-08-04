import { useState } from 'react'
import { listProvinces, listAmphures, listTambons } from 'thaizip'
import { useDefaultIndex } from './useDefaultIndex'
import './demos.css'

const STRINGS = {
  th: {
    loading: 'กำลังโหลดข้อมูลที่อยู่…',
    error: 'โหลดข้อมูลไม่สำเร็จ',
    retry: 'ลองใหม่',
    province: 'จังหวัด',
    amphure: 'อำเภอ/เขต',
    tambon: 'ตำบล/แขวง',
    pick: '— เลือก —',
    zip: 'รหัสไปรษณีย์',
  },
  en: {
    loading: 'Loading address data…',
    error: 'Failed to load address data',
    retry: 'Retry',
    province: 'Province',
    amphure: 'District',
    tambon: 'Subdistrict',
    pick: '— select —',
    zip: 'Postal code',
  },
}

export default function CascadeDemo({ locale = 'th' as 'th' | 'en' }) {
  const t = STRINGS[locale]
  const { index, error, retry } = useDefaultIndex()
  const [provinceId, setProvinceId] = useState(0)
  const [amphureId, setAmphureId] = useState(0)
  const [tambonId, setTambonId] = useState(0)

  if (error)
    return (
      <div className="tz-demo tz-status tz-error">
        {t.error}
        <button onClick={retry}>{t.retry}</button>
      </div>
    )
  if (!index) return <div className="tz-demo tz-status">{t.loading}</div>

  const name = (x: { nameTh: string; nameEn: string }) =>
    locale === 'th' ? x.nameTh : x.nameEn
  const provinces = listProvinces(index)
  const amphures = provinceId ? listAmphures(index, provinceId) : []
  const tambons = amphureId ? listTambons(index, amphureId) : []
  const zipCode = tambons.find((tb) => tb.id === tambonId)?.zipCode

  return (
    <div className="tz-demo">
      <label>
        {t.province}
        <select
          value={provinceId}
          onChange={(e) => {
            setProvinceId(Number(e.target.value))
            setAmphureId(0)
            setTambonId(0)
          }}
        >
          <option value={0}>{t.pick}</option>
          {provinces.map((p) => (
            <option key={p.id} value={p.id}>{name(p)}</option>
          ))}
        </select>
      </label>
      <label>
        {t.amphure}
        <select
          value={amphureId}
          disabled={!provinceId}
          onChange={(e) => {
            setAmphureId(Number(e.target.value))
            setTambonId(0)
          }}
        >
          <option value={0}>{t.pick}</option>
          {amphures.map((a) => (
            <option key={a.id} value={a.id}>{name(a)}</option>
          ))}
        </select>
      </label>
      <label>
        {t.tambon}
        <select
          value={tambonId}
          disabled={!amphureId}
          onChange={(e) => setTambonId(Number(e.target.value))}
        >
          <option value={0}>{t.pick}</option>
          {tambons.map((tb) => (
            <option key={tb.id} value={tb.id}>{name(tb)}</option>
          ))}
        </select>
      </label>
      {zipCode && (
        <p className="tz-meta">
          {t.zip}: <strong>{zipCode}</strong>
        </p>
      )}
    </div>
  )
}
