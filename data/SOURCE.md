# Address data provenance

The four JSON tables in this directory are the source of truth for the
bundled index (`npm run generate-data` → `src/data/defaultData.ts`).

| | |
|---|---|
| Upstream | [kongvut/thai-province-data](https://github.com/kongvut/thai-province-data), files `json/thai_{geographies,provinces,amphures,tambons}.json` |
| Upstream commit | [`4cea2a04139ac3b6ae891287d7a9d3223dc51e47`](https://github.com/kongvut/thai-province-data/tree/4cea2a04139ac3b6ae891287d7a9d3223dc51e47) (2024-09-25, "update tambons") |
| License | MIT, © Kongvut Sangkla — notice reproduced in [`LICENSE`](../LICENSE) |
| Added here | `eceda8c` (2026-04-07, "first commit") |
| Modified | `21bd91f` (2026-09-09) — removed the unused `created_at` / `updated_at` fields; no names, ids or zip codes changed |
| Modified | 2026-10-16 — restored the เกาะ… rows and added amphure 5025 (see below) |
| Integrity | `SHA256SUMS` — verified by `src/data/generate.ts` before every generate |

The upstream commit was identified after the fact (2026-10-16) by comparing
every record against the upstream history: `geographies` and `provinces` are
identical to that commit, and every `amphures` / `tambons` record here is
identical to its upstream counterpart (differences are listed below).

## Differences from the upstream commit

**Restored 2026-10-16.** The files as first added were missing every amphure
and every tambon whose Thai name starts with "เกาะ" — 9 amphures and 24 tambons
(e.g. เกาะเต่า, เกาะยอ, เกาะลิบง). The remaining tambons of those amphures were
orphaned and skipped by the indexer, so zip codes such as 84320 (เกาะสมุย),
84280 (เกาะพะงัน) and 23170 (เกาะช้าง) returned nothing. No commit explains the
omission; the rows were restored verbatim from the upstream commit above
(minus `created_at` / `updated_at`). Restored amphures:

| id | amphure |
|---|---|
| 2008 | เกาะสีชัง (ชลบุรี) |
| 2011 | เกาะจันทร์ (ชลบุรี) |
| 2306 | เกาะกูด (ตราด) |
| 2307 | เกาะช้าง (ตราด) |
| 5203 | เกาะคา (ลำปาง) |
| 8103 | เกาะลันตา (กระบี่) |
| 8202 | เกาะยาว (พังงา) |
| 8404 | เกาะสมุย (สุราษฎร์ธานี) |
| 8405 | เกาะพะงัน (สุราษฎร์ธานี) |

**Added beyond the upstream commit:** amphure `5025` กัลยาณิวัฒนา / Galyani
Vadhana (เชียงใหม่). Its three tambons (502501–502503, zip 58130) were already
present but orphaned because the 2024 upstream commit lacked the amphure;
upstream added it later in
[`922c115`](https://github.com/kongvut/thai-province-data/commit/922c115992a75228df4130aed6033d28a0097ead)
(2025-11-15). The values match that commit.

After these changes no tambon is orphaned (asserted by
`src/__tests__/integration.test.ts`).

## Updating the data

1. Replace the JSON files from the upstream source and record the source URL,
   commit and date above.
2. Review the diff (`git diff --stat data/` and spot-check names/zip codes) —
   every string here ships to users as suggestion labels.
3. Regenerate the checksums: `cd data && shasum -a 256 thai_*.json > SHA256SUMS`
4. `npm run generate-data && npm test`
