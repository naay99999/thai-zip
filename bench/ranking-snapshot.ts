// Ranking regression snapshot: dumps result tambonIds for a broad query set.
// Run: node --import tsx bench/ranking-snapshot.ts > baseline.json (or optimized.json)
import { buildThaiAddressIndex } from '../src/core/indexer'
import { searchThaiAddress, lookupByZipCode } from '../src/core/search'
import { defaultRawData } from './data.ts'

const raw = defaultRawData()
const index = buildThaiAddressIndex(raw, { validate: false })

const QUERIES = [
  'ลาดพร้าว', 'ลาดพร', 'บางรัก', 'เชียงใหม่', 'นครราชสีมา', 'บาง', 'เมือง', 'กรุงเทพ', 'สีลม', 'ดุสิต',
  'bang rak', 'chatuchak', 'lat phrao', 'lardprao', 'ladkrabang', 'krungthep', 'bang', 'ban', 'nong chok',
  'don mueang', 'sathon', 'sukhumvit', 'huai khwang', 'khlong toei', 'bang na', 'pathum wan',
  '10500', '45000', '450', '10', '50', '10900', '50000', '10230',
  'ลาดพร้าว กรุงเทพ', 'khet lat phrao',
]

const out: Record<string, unknown> = {}
for (const q of QUERIES) {
  out[q] = {
    search: searchThaiAddress(index, q).map(r => r.tambonId),
    search_limit5: searchThaiAddress(index, q, { limit: 5 }).map(r => r.tambonId),
    search_limit50: searchThaiAddress(index, q, { limit: 50 }).map(r => r.tambonId),
    search_thr0: searchThaiAddress(index, q, { threshold: 0 }).map(r => r.tambonId),
    zip: lookupByZipCode(index, q).map(r => r.tambonId),
  }
}
console.log(JSON.stringify(out, null, 1))
