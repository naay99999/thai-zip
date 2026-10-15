# Address data provenance

The four JSON tables in this directory are the source of truth for the
bundled index (`npm run generate-data` → `src/data/defaultData.ts`).

| | |
|---|---|
| Origin | **Unrecorded.** The schema (`geographies` / `provinces` / `amphures` / `tambons` with `deleted_at`) matches the community dataset [kongvut/thai-province-data](https://github.com/kongvut/thai-province-data), but the exact upstream commit was not recorded when the files were first added. Confirm and fill in the URL + commit here. |
| Added | `eceda8c` (2026-04-07, "first commit") |
| Modified | `21bd91f` (2026-09-09) — removed the unused `created_at` / `updated_at` fields; no names, ids or zip codes changed |
| Integrity | `SHA256SUMS` — verified by `src/data/generate.ts` before every generate |

## Updating the data

1. Replace the JSON files from the upstream source and record the source URL,
   commit and date above.
2. Review the diff (`git diff --stat data/` and spot-check names/zip codes) —
   every string here ships to users as suggestion labels.
3. Regenerate the checksums: `cd data && shasum -a 256 thai_*.json > SHA256SUMS`
4. `npm run generate-data && npm test`
