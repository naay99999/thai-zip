// Search latency benchmark — representative queries, percentile stats.
// Run: node --expose-gc --import tsx bench/search.ts
import { buildThaiAddressIndex } from '../src/core/indexer'
import { searchThaiAddress, lookupByZipCode } from '../src/core/search'
import { defaultRawData } from './data.ts'
import { header, benchSync, summarize, fmt } from './harness.ts'

const raw = defaultRawData()
const index = buildThaiAddressIndex(raw, { validate: false })

const THAI_QUERIES = ['ลาดพร้าว', 'ลาดพร', 'บางรัก', 'เชียงใหม่', 'นครราชสีมา']
const EN_QUERIES = ['bang rak', 'chatuchak', 'lat phrao', 'lardprao', 'ladkrabang', 'krungthep']
const ZIP_QUERIES = ['10500', '45000', '450', '10']
const EDGE_QUERIES = ['ก', 'บ', 'c', 'ba', 'กร', 'ลาดพร้าว แขวงลาดพร้าว เขตลาดพร้าว กรุงเทพมหานคร 10230', 'xyzxyzxyz', 'zzzzzzz', 'บาง', 'ban', 'bang', 'เมือง', 'khet', 'khwang']
const ALL = [...THAI_QUERIES, ...EN_QUERIES, ...ZIP_QUERIES, ...EDGE_QUERIES]

let sink = 0

function run(label: string, query: string, opts?: Parameters<typeof searchThaiAddress>[2]) {
  const s = benchSync(
    label,
    () => {
      const r = searchThaiAddress(index, query, opts)
      sink += r.length
      return r
    },
    { warmup: 300, samples: 3000 },
  )
  const results = searchThaiAddress(index, query, opts)
  console.log(`      → ${results.length} results`)
  return s
}

header('Thai text queries')
for (const q of THAI_QUERIES) run(q, q)

header('English (RTGS + alias) queries')
for (const q of EN_QUERIES) run(q, q)

header('Postal-code queries')
for (const q of ZIP_QUERIES) run(q, q)

header('Edge cases')
run('1-char Thai (ก)', 'ก')
run('1-char Latin (c)', 'c')
run('2-char (ba)', 'ba')
run('2-char Thai (กร)', 'กร')
run('long query (60 chars)', 'ลาดพร้าว แขวงลาดพร้าว เขตลาดพร้าว กรุงเทพมหานคร 10230')
run('no result (xyzxyzxyz)', 'xyzxyzxyz')
run('no result (zzzzzzz)', 'zzzzzzz')
run('many results (บาง)', 'บาง')
run('many results (ban)', 'ban')
run('many results (bang)', 'bang')
run('many results (เมือง)', 'เมือง')
run('khet', 'khet')
run('khwang', 'khwang')

header('lookupByZipCode direct')
benchSync('lookupByZipCode(10500)', () => lookupByZipCode(index, '10500'), { warmup: 300, samples: 3000 })
benchSync('lookupByZipCode(45000)', () => lookupByZipCode(index, '45000'), { warmup: 300, samples: 3000 })
benchSync('lookupByZipCode(450)', () => lookupByZipCode(index, '450'), { warmup: 300, samples: 3000 })
benchSync('lookupByZipCode(10)', () => lookupByZipCode(index, '10'), { warmup: 300, samples: 3000 })

header('Higher limits (window/collator scale with limit)')
run('บาง limit=50', 'บาง', { limit: 50 })
run('บาง limit=100', 'บาง', { limit: 100 })

if (sink === -1) console.log(sink)
