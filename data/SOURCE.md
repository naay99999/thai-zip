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
| Integrity | `SHA256SUMS` — verified by `src/data/generate.ts` before every generate |

The upstream commit was identified after the fact (2026-10-16) by comparing
every record against the upstream history: `geographies` and `provinces` are
identical to that commit, and every `amphures` / `tambons` record here is
identical to its upstream counterpart.

## Known gap versus upstream

Upstream contains **9 amphures and 24 tambons that are missing here** — every
amphure and every tambon whose Thai name starts with "เกาะ" (e.g. เกาะเต่า,
เกาะยอ, เกาะลิบง). The remaining tambons of the missing amphures are still in
`thai_tambons.json` but are orphaned, so the indexer skips them. Missing amphures:

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

The omission predates this file and looks accidental (no commit explains it).
Until it is fixed, addresses in these districts and islands — e.g. zip codes
84320 (เกาะสมุย), 84280 (เกาะพะงัน), 84360 (เกาะเต่า) — cannot be found.

## Updating the data

1. Replace the JSON files from the upstream source and record the source URL,
   commit and date above.
2. Review the diff (`git diff --stat data/` and spot-check names/zip codes) —
   every string here ships to users as suggestion labels.
3. Regenerate the checksums: `cd data && shasum -a 256 thai_*.json > SHA256SUMS`
4. `npm run generate-data && npm test`
