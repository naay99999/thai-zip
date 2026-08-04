# thaizip Starlight Docs Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the bilingual (Thai-root + English) Astro Starlight documentation site for `thaizip` at `docs/`, with five live React demo islands and a GitHub Pages deploy workflow.

**Architecture:** Starlight project in `docs/` inside the `thai-zip` repo, Thai at `/`, English under `/en/`. Demos are React islands (`client:visible`) that consume `thaizip` via a `file:..` dependency resolving to the repo's built `dist/`. One shared `useDefaultIndex()` loader hook feeds all demos. Deploy = hand-written GitHub Actions workflow (build library → build docs → deploy Pages).

**Tech Stack:** Astro 5 + @astrojs/starlight + @astrojs/react (React 19), starlight-links-validator, GitHub Actions + GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-08-05-starlight-docs-design.md`

## Global Constraints

- Branch: `docs-site`. Every commit message uses the `docs:` prefix (never triggers release-please) and ends with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- `docs/package.json` must have `"private": true`.
- `astro.config.mjs`: `site: 'https://naay99999.github.io'`, `base: '/thai-zip'`.
- Thai is the root locale (`/`); English lives under `/en/`. Every content page exists in both locales with identical slug structure.
- Internal links inside page bodies use **relative** paths (e.g. `../zip-lookup/`) so they survive the `/thai-zip` base. Only frontmatter `hero.actions` links use absolute paths including the base (`/thai-zip/getting-started/`).
- Demos: plain scoped CSS with Starlight variables (`--sl-color-*`); no Tailwind. Demo UI strings come from a `locale: 'th' | 'en'` prop, defaulting to `'th'`.
- The library must be built (`npm run build` at repo root) before `npm install`/`npm run build` in `docs/` — `file:..` resolves against `dist/`.
- `docs/**` build artifacts are already gitignored via unanchored `node_modules/`, `dist/` patterns and the `.astro/` entry.
- Spec deviation (approved): Playground shows **result count + elapsed ms**, not per-record score — `searchThaiAddress` returns `ThaiAddressRecord[]` without exposing scores.

## Verified public API (use these exact signatures)

```ts
// 'thaizip'
searchThaiAddress(index: TrigramIndex, query: string, options?: SearchOptions): ThaiAddressRecord[]
lookupByZipCode(index: TrigramIndex, zip: string): ThaiAddressRecord[]
listProvinces(index: TrigramIndex): ProvinceSummary[]              // {id, nameTh, nameEn}
listAmphures(index: TrigramIndex, provinceId: number): AmphureSummary[]  // + provinceId
listTambons(index: TrigramIndex, amphureId: number): TambonSummary[]     // + amphureId, zipCode
formatThaiAddressSuggestion(record: ThaiAddressRecord, options?: { locale?: 'th' | 'en' }): ThaiAddressSuggestion
resolveThaiAddress(record: ThaiAddressRecord): ResolvedThaiAddress
buildThaiAddressIndex(data: RawData, options?: BuildIndexOptions): TrigramIndex
validateRawData(data: RawData): void
normalizeThaiAddressText(text: string): string
applyRomanizationAliases(normalized: string): string
// SearchOptions = { limit?, threshold?, zipLimit?, romanizationAliases? }

// 'thaizip/data'
loadDefaultIndex(): Promise<TrigramIndex>
clearDefaultIndex(): void

// 'thaizip/react'
useThaiAddressAutocomplete(options: UseThaiAddressAutocompleteOptions): {
  query, setQuery, setQuerySilent, suggestions /* ThaiAddressSuggestion[] */,
  isOpen, selectSuggestion /* (item: ThaiAddressSuggestion) => ResolvedThaiAddress | null — takes
    the full suggestion, not a bare id; looks it up by item.id internally */, clear
}
```

## File Structure

```
docs/
├── package.json                     # Task 1
├── astro.config.mjs                 # Task 1, sidebar grows in later tasks
├── tsconfig.json                    # Task 1
├── src/
│   ├── content.config.ts            # Task 1
│   ├── components/demos/
│   │   ├── demos.css                # Task 2 (shared demo styles)
│   │   ├── useDefaultIndex.ts       # Task 2 (shared index loader hook)
│   │   ├── SearchDemo.tsx           # Task 2
│   │   ├── ZipDemo.tsx              # Task 4
│   │   ├── CascadeDemo.tsx          # Task 5
│   │   ├── HookDemo.tsx             # Task 6
│   │   └── Playground.tsx           # Task 7
│   └── content/docs/
│       ├── index.mdx                # Task 1 (minimal) → Task 2 (demo added)
│       ├── getting-started.mdx      # Task 3
│       ├── guides/{search,english-input}.mdx        # Task 3
│       ├── guides/zip-lookup.mdx    # Task 4
│       ├── guides/cascade.mdx       # Task 5
│       ├── guides/{react,custom-data}.mdx           # Task 6
│       ├── playground.mdx           # Task 7
│       ├── reference/{search,enumerate,formatter,resolver,data,react,types}.md  # Task 8
│       └── en/**                    # English mirror, added in the same task as each Thai page
.github/workflows/docs.yml           # Task 9
README.md                            # Task 9 (add docs link)
```

Each task ends with `npm run build` in `docs/` passing (which also runs starlight-links-validator) and a `docs:` commit.

---

### Task 1: Scaffold the Starlight project with bilingual i18n

**Files:**
- Create: `docs/package.json`, `docs/astro.config.mjs`, `docs/tsconfig.json`, `docs/src/content.config.ts`, `docs/src/content/docs/index.mdx`, `docs/src/content/docs/en/index.mdx`

**Interfaces:**
- Produces: a building Starlight site; `astro.config.mjs` whose `sidebar` array later tasks append to; the `docs` content collection.

- [ ] **Step 1: Build the library so `file:..` has a `dist/` to resolve**

Run: `npm ci && npm run build` (repo root). Expected: tsup writes `dist/`.

- [ ] **Step 2: Write `docs/package.json`**

```json
{
  "name": "thaizip-docs",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "check": "astro check"
  },
  "dependencies": {
    "@astrojs/react": "^4.2.0",
    "@astrojs/starlight": "^0.36.0",
    "astro": "^5.6.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "starlight-links-validator": "^0.18.0",
    "thaizip": "file:.."
  },
  "devDependencies": {
    "@astrojs/check": "^0.9.4",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "typescript": "^5.6.0"
  }
}
```

If `npm install` reports version conflicts (these are caret floors, newer majors may exist), re-resolve with `npm install astro@latest @astrojs/starlight@latest @astrojs/react@latest starlight-links-validator@latest` and keep whatever versions npm picks.

- [ ] **Step 3: Write `docs/astro.config.mjs`**

```js
// @ts-check
import { defineConfig } from 'astro/config'
import starlight from '@astrojs/starlight'
import react from '@astrojs/react'
import starlightLinksValidator from 'starlight-links-validator'

export default defineConfig({
  site: 'https://naay99999.github.io',
  base: '/thai-zip',
  integrations: [
    starlight({
      title: 'thaizip',
      description: 'Fast fuzzy autocomplete for Thai addresses',
      defaultLocale: 'root',
      locales: {
        root: { label: 'ไทย', lang: 'th' },
        en: { label: 'English', lang: 'en' },
      },
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/naay99999/thai-zip' },
      ],
      plugins: [starlightLinksValidator()],
      sidebar: [],
    }),
    react(),
  ],
  vite: {
    resolve: { dedupe: ['react', 'react-dom'] },
  },
})
```

The `dedupe` block matters: `thaizip` is a symlinked `file:..` dependency whose own `node_modules` may contain a second React copy — without dedupe, `useThaiAddressAutocomplete` dies with "invalid hook call". If the installed Starlight version rejects the `social` array shape, use the older object shape `social: { github: 'https://github.com/naay99999/thai-zip' }`.

- [ ] **Step 4: Write `docs/tsconfig.json` and `docs/src/content.config.ts`**

```json
{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "src/**/*"],
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "react"
  }
}
```

```ts
import { defineCollection } from 'astro:content'
import { docsLoader } from '@astrojs/starlight/loaders'
import { docsSchema } from '@astrojs/starlight/schema'

export const collections = {
  docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }),
}
```

- [ ] **Step 5: Write minimal landing pages**

`docs/src/content/docs/index.mdx`:

```mdx
---
title: thaizip
description: ค้นหาที่อยู่ไทยแบบ autocomplete — ตำบล อำเภอ จังหวัด รหัสไปรษณีย์
template: splash
hero:
  tagline: ค้นหาที่อยู่ไทยแบบ fuzzy — ตำบล อำเภอ จังหวัด รหัสไปรษณีย์ รองรับทั้งภาษาไทยและอังกฤษ ไม่มี runtime dependency
  actions:
    - text: เริ่มต้นใช้งาน
      link: /thai-zip/getting-started/
      icon: right-arrow
    - text: ดูบน GitHub
      link: https://github.com/naay99999/thai-zip
      icon: external
      variant: minimal
---
```

`docs/src/content/docs/en/index.mdx`: same structure with `description: Fast fuzzy autocomplete for Thai addresses`, `tagline: Fast fuzzy autocomplete for Thai addresses — subdistrict, district, province, postal code. Thai and English input, zero runtime dependencies.`, `text: Get started`, `link: /thai-zip/en/getting-started/`, `text: View on GitHub`.

The `getting-started` hero links point at a page that doesn't exist until Task 3 — starlight-links-validator will fail the build on them. Until Task 3 lands, temporarily point both actions at the GitHub URL, then fix them in Task 3. (Do NOT disable the validator.)

- [ ] **Step 6: Install and build**

Run: `cd docs && npm install && npm run build`
Expected: build succeeds, `docs/dist/index.html` and `docs/dist/en/index.html` exist. Run `npm run dev` and eyeball `http://localhost:4321/thai-zip` — Thai splash renders, language picker shows ไทย/English.

- [ ] **Step 7: Commit**

```bash
git add docs/package.json docs/package-lock.json docs/astro.config.mjs docs/tsconfig.json docs/src
git commit -m "docs: scaffold bilingual Starlight site"
```

---

### Task 2: Demo infrastructure + SearchDemo on the landing pages

**Files:**
- Create: `docs/src/components/demos/useDefaultIndex.ts`, `docs/src/components/demos/demos.css`, `docs/src/components/demos/SearchDemo.tsx`
- Modify: `docs/src/content/docs/index.mdx`, `docs/src/content/docs/en/index.mdx`

**Interfaces:**
- Produces: `useDefaultIndex(): { index: TrigramIndex | null; error: boolean; retry: () => void }` — every later demo consumes this. `SearchDemo` props: `{ locale?: 'th' | 'en'; initialQuery?: string }`. Shared CSS classes: `tz-demo`, `tz-status`, `tz-input`, `tz-list`, `tz-item`, `tz-item-zip`, `tz-empty`, `tz-error`.

- [ ] **Step 1: Write `useDefaultIndex.ts`**

```ts
import { useEffect, useState } from 'react'
import { loadDefaultIndex } from 'thaizip/data'
import type { TrigramIndex } from 'thaizip'

/**
 * Loads the bundled address index. `loadDefaultIndex()` caches a module-level
 * singleton, so every demo island on a page shares one load.
 */
export function useDefaultIndex() {
  const [index, setIndex] = useState<TrigramIndex | null>(null)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setError(false)
    loadDefaultIndex().then(
      (i) => {
        if (!cancelled) setIndex(i)
      },
      () => {
        if (!cancelled) setError(true)
      },
    )
    return () => {
      cancelled = true
    }
  }, [attempt])

  return { index, error, retry: () => setAttempt((a) => a + 1) }
}
```

- [ ] **Step 2: Write `demos.css`**

```css
.tz-demo {
  border: 1px solid var(--sl-color-gray-5);
  border-radius: 0.5rem;
  padding: 1rem;
  margin: 1.5rem 0;
  background: var(--sl-color-bg-nav);
}
.tz-status { color: var(--sl-color-gray-3); font-size: var(--sl-text-sm); }
.tz-error { color: var(--sl-color-red); }
.tz-input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--sl-color-gray-4);
  border-radius: 0.375rem;
  background: var(--sl-color-bg);
  color: var(--sl-color-text);
  font-size: var(--sl-text-base);
}
.tz-input:focus { outline: 2px solid var(--sl-color-accent); outline-offset: 1px; }
.tz-list { list-style: none; padding: 0; margin: 0.5rem 0 0; max-height: 16rem; overflow-y: auto; }
.tz-item {
  padding: 0.375rem 0.5rem;
  border-radius: 0.25rem;
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
}
.tz-item:hover { background: var(--sl-color-gray-6); }
.tz-item-zip { color: var(--sl-color-text-accent); font-variant-numeric: tabular-nums; }
.tz-empty { color: var(--sl-color-gray-3); padding: 0.375rem 0.5rem; }
.tz-demo button {
  margin-inline-start: 0.5rem;
  padding: 0.25rem 0.75rem;
  border: 1px solid var(--sl-color-gray-4);
  border-radius: 0.375rem;
  background: var(--sl-color-bg);
  color: var(--sl-color-text);
  cursor: pointer;
}
.tz-demo select {
  padding: 0.5rem;
  border: 1px solid var(--sl-color-gray-4);
  border-radius: 0.375rem;
  background: var(--sl-color-bg);
  color: var(--sl-color-text);
}
.tz-demo label { display: block; font-size: var(--sl-text-sm); margin-top: 0.75rem; }
.tz-meta { color: var(--sl-color-gray-3); font-size: var(--sl-text-sm); margin-top: 0.5rem; }
.tz-json {
  margin-top: 0.75rem;
  padding: 0.75rem;
  background: var(--sl-color-bg);
  border: 1px solid var(--sl-color-gray-5);
  border-radius: 0.375rem;
  font-size: var(--sl-text-xs);
  overflow-x: auto;
}
```

- [ ] **Step 3: Write `SearchDemo.tsx`**

```tsx
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
```

- [ ] **Step 4: Embed on both landing pages**

In `docs/src/content/docs/index.mdx`, after the frontmatter add:

```mdx
import SearchDemo from '../../components/demos/SearchDemo'

## ลองเลย

พิมพ์ชื่อตำบล อำเภอ จังหวัด (ไทยหรืออังกฤษ) หรือรหัสไปรษณีย์:

<SearchDemo client:visible initialQuery="ลาดพร้าว" />
```

In `en/index.mdx` (note the extra `../`):

```mdx
import SearchDemo from '../../../components/demos/SearchDemo'

## Try it

Type a subdistrict, district, or province name (Thai or English), or a postal code:

<SearchDemo client:visible locale="en" initialQuery="bang rak" />
```

- [ ] **Step 5: Build and verify interactively**

Run: `cd docs && npm run build` → passes. Then `npm run dev`: on `/thai-zip` the demo shows ลาดพร้าว results after data loads; typing `10500` lists Bang Rak-area subdistricts; `/thai-zip/en/` shows English labels.

- [ ] **Step 6: Commit**

```bash
git add docs/src
git commit -m "docs: add shared demo infrastructure and SearchDemo island"
```

---

### Task 3: Getting-started, search guide, english-input guide (both locales)

**Files:**
- Create: `docs/src/content/docs/getting-started.mdx`, `guides/search.mdx`, `guides/english-input.mdx` + the three `en/` mirrors
- Modify: `docs/astro.config.mjs` (sidebar), `docs/src/content/docs/index.mdx` + `en/index.mdx` (restore hero links)

**Interfaces:**
- Consumes: `SearchDemo` (`locale`, `initialQuery` props) from Task 2.
- Produces: slugs `getting-started`, `guides/search`, `guides/english-input` that the sidebar and later cross-links rely on.

- [ ] **Step 1: Point the hero actions back at `/thai-zip/getting-started/` (th) and `/thai-zip/en/getting-started/` (en)** — reverting the Task 1 placeholder.

- [ ] **Step 2: Write `getting-started.mdx` (th + en)**

Frontmatter: `title: เริ่มต้นใช้งาน` / `title: Getting Started`; `description` one line each. Content outline (write real prose in each language — English mirrors the Thai content, not a word-for-word translation):

1. **ติดตั้ง** — `npm install thaizip`; needs Node ≥ 18; React optional.
2. **สาม entry points** — table straight from README: `thaizip` (core, 4.4 KB gzip), `thaizip/react` (hook, ships `"use client"`), `thaizip/data` (132 KB gzip).
3. **โหลด index แล้วค้นหา** — the README quick-start block verbatim:

```ts
import { loadDefaultIndex } from 'thaizip/data'
import { searchThaiAddress, formatThaiAddressSuggestion, resolveThaiAddress } from 'thaizip'

const index = await loadDefaultIndex() // ~40ms of synchronous work, cached after

searchThaiAddress(index, 'ลาดพร้าว')
searchThaiAddress(index, 'bang rak')
searchThaiAddress(index, '10500')
```

4. **เคล็ดลับ performance** — call `loadDefaultIndex()` at mount/route load, not on first keystroke (~2 dropped frames otherwise).
5. **ไปต่อ** — relative links to `guides/search/`, `guides/react/`, `../playground/` (links to pages created in later tasks will fail the validator — use only links to pages that exist as of this task: link to `guides/search/` and `guides/english-input/`; add more "ไปต่อ" links in Task 7's final sweep).

- [ ] **Step 3: Write `guides/search.mdx` (th + en)**

Frontmatter `title: การค้นหา` / `title: Searching`. Embed `<SearchDemo client:visible />` (th) / `<SearchDemo client:visible locale="en" />` (en) near the top (import path from `guides/` is `../../../components/demos/SearchDemo`, en is `../../../../…`). Sections:

1. **การใช้งานพื้นฐาน** — `searchThaiAddress(index, query, options?)` returns `ThaiAddressRecord[]`; show the options block from README with all four options and their defaults (`limit: 10`, `threshold: 0.4`, `zipLimit: Infinity`, `romanizationAliases: true`).
2. **การจัดอันดับ** — trigram score → own-name match (exact → prefix → substring) → Thai alphabetical; include the README's ตำบลลาดพร้าว-vs-เขตลาดพร้าว example.
3. **ข้อจำกัด** — combined text + zip (`"ลาดพร้าว 10900"`) not supported; search separately.
4. **เบื้องหลังการค้นหา** (closing section, per spec) — normalization strips จังหวัด/อำเภอ/ตำบล/แขวง/เขต prefixes, abbreviations (จ. อ. ต. ข.) and tone marks, then trigram matching with `hits/queryTrigrams` scoring against `threshold`.

- [ ] **Step 4: Write `guides/english-input.mdx` (th + en)**

Frontmatter `title: ค้นหาด้วยภาษาอังกฤษ` / `title: English Input`. Embed `<SearchDemo client:visible initialQuery="bang rak" />` (en variant: `locale="en"`). Sections: RTGS spellings indexed directly (`bang rak`, `chatuchak` work as-is); 84 curated non-RTGS aliases (`lardprao` → `lat phrao`, `krungthep` → `bangkok`) applied first — a dictionary, not a transliterator, unlisted spellings miss; opt out with `romanizationAliases: false`.

- [ ] **Step 5: Add the first sidebar groups to `astro.config.mjs`**

```js
sidebar: [
  {
    label: 'เริ่มต้น',
    translations: { en: 'Start Here' },
    items: [{ slug: 'getting-started' }],
  },
  {
    label: 'คู่มือ',
    translations: { en: 'Guides' },
    items: [{ slug: 'guides/search' }, { slug: 'guides/english-input' }],
  },
],
```

- [ ] **Step 6: Build, verify, commit**

`cd docs && npm run build` passes (validator now checks hero links resolve). Verify sidebar + language toggle on both locales in dev.

```bash
git add docs/astro.config.mjs docs/src
git commit -m "docs: add getting-started, search, and english-input pages"
```

---

### Task 4: ZipDemo + zip-lookup guide (both locales)

**Files:**
- Create: `docs/src/components/demos/ZipDemo.tsx`, `docs/src/content/docs/guides/zip-lookup.mdx`, `en/guides/zip-lookup.mdx`
- Modify: `docs/astro.config.mjs` (add `{ slug: 'guides/zip-lookup' }` after `guides/search`)

**Interfaces:**
- Consumes: `useDefaultIndex`, CSS classes from Task 2.
- Produces: slug `guides/zip-lookup`; `ZipDemo` props `{ locale?: 'th' | 'en' }`.

- [ ] **Step 1: Write `ZipDemo.tsx`**

```tsx
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
```

- [ ] **Step 2: Write `guides/zip-lookup.mdx` (th + en)**

Frontmatter `title: ค้นหาด้วยรหัสไปรษณีย์` / `title: Postal Code Lookup`. Embed `<ZipDemo client:visible />`. Sections:

1. **พฤติกรรม** — all-digit queries ≥ 2 digits route to zip lookup automatically inside `searchThaiAddress`; `lookupByZipCode(index, zip)` is the direct API; exact match first, then prefix matches ascending.
2. **ทำไม `zipLimit` ถึงไม่จำกัด** — one code covers many subdistricts (`45000` → 33; 230 of 953 codes cover > 10), capping at `limit` would silently hide valid subdistricts. Default the demo to `45000` so this is visible immediately.
3. Code block:

```ts
import { lookupByZipCode } from 'thaizip'

lookupByZipCode(index, '45000') // exact
lookupByZipCode(index, '450')   // prefix scan
```

- [ ] **Step 3: Build, verify (typing `45000` shows "พบ 33 ตำบล"), commit**

```bash
git add docs/astro.config.mjs docs/src
git commit -m "docs: add ZipDemo and zip-lookup guide"
```

---

### Task 5: CascadeDemo + cascade guide (both locales)

**Files:**
- Create: `docs/src/components/demos/CascadeDemo.tsx`, `docs/src/content/docs/guides/cascade.mdx`, `en/guides/cascade.mdx`
- Modify: `docs/astro.config.mjs` (add `{ slug: 'guides/cascade' }`)

**Interfaces:**
- Consumes: `useDefaultIndex`, CSS from Task 2; `listProvinces` / `listAmphures` / `listTambons` summaries (`nameTh`/`nameEn` fields).
- Produces: slug `guides/cascade`; `CascadeDemo` props `{ locale?: 'th' | 'en' }`.

- [ ] **Step 1: Write `CascadeDemo.tsx`**

```tsx
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
```

- [ ] **Step 2: Write `guides/cascade.mdx` (th + en)**

Frontmatter `title: Dropdown จังหวัด → อำเภอ → ตำบล` / `title: Cascade Dropdowns`. Embed `<CascadeDemo client:visible />`. Content: the enumeration API code block from README (`listProvinces` → 77 provinces sorted by Thai name; `listAmphures(index, provinceId)`; `listTambons(index, amphureId)` each with `zipCode`); backed by pre-built groupings, not scans over all 7,385 records; unknown ids return `[]` — no throw, safe for stale UI state.

- [ ] **Step 3: Build, verify (กรุงเทพมหานคร → เขตบางรัก → แขวงสีลม → 10500), commit**

```bash
git add docs/astro.config.mjs docs/src
git commit -m "docs: add CascadeDemo and cascade guide"
```

---

### Task 6: HookDemo + react guide + custom-data guide (both locales)

**Files:**
- Create: `docs/src/components/demos/HookDemo.tsx`, `docs/src/content/docs/guides/react.mdx`, `guides/custom-data.mdx` + `en/` mirrors
- Modify: `docs/astro.config.mjs` (add `{ slug: 'guides/react' }`, `{ slug: 'guides/custom-data' }`)

**Interfaces:**
- Consumes: `useDefaultIndex`; `useThaiAddressAutocomplete` from `thaizip/react` (needs a non-null `index`, hence the inner-component split).
- Produces: slugs `guides/react`, `guides/custom-data`.

- [ ] **Step 1: Write `HookDemo.tsx`**

The hook requires `index` in its options, and hooks can't be called conditionally — so the outer component gates on index readiness and an inner component calls the hook.

```tsx
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
```

- [ ] **Step 2: Write `guides/react.mdx` (th + en)**

Frontmatter `title: React Hook` (both). Embed `<HookDemo client:visible />`. Sections:

1. Intro — `useThaiAddressAutocomplete` from `thaizip/react`; built-in 200 ms debounce; `react`/`react-dom` are optional peers; built files ship `"use client"` so it works in Next.js App Router without a wrapper.
2. Minimal unstyled example — the HookInner source, presented as copyable code.
3. Return values table: `query`, `setQuery`, `setQuerySilent` (echo a choice into the input without reopening the dropdown), `suggestions`, `isOpen` (`query.length > 0 && suggestions.length > 0`), `selectSuggestion` (takes the full suggestion object, looks it up by `id` internally — O(1); returns `null` for a stale/unknown suggestion, never throws; leaves `query` unchanged by design), `clear`.
4. **Callout (Starlight `:::tip`)** — "อยากได้ component สำเร็จรูปแบบ shadcn (Base UI + Tailwind)? ดู [react-thaizip](https://github.com/naay99999/react-thai-zip)" — the scope boundary from the spec: this page teaches the headless hook only, no styling.

- [ ] **Step 3: Write `guides/custom-data.mdx` (th + en)**

Frontmatter `title: ใช้ข้อมูลของคุณเอง` / `title: Custom Data`. No demo. Sections:

1. When: newer official data, private subset, or extra fields.
2. `RawData` shape — four tables (`geographies` optional/unused, `provinces`, `amphures`, `tambons`), snake_case fields, `deleted_at` soft deletes (deleted rows and orphaned tambons are skipped at build).
3. Example:

```ts
import { buildThaiAddressIndex, validateRawData } from 'thaizip'

const index = buildThaiAddressIndex({ provinces, amphures, tambons }, {
  onSkip: (tambon) => console.warn('skipped', tambon.name_th),
})
```

4. `validate` defaults to `true` (no measurable cost — leave it on for data you didn't generate); `validateRawData(data)` is the standalone version for validating before shipping.

- [ ] **Step 4: Build, verify hook demo select-flow (click result → input echoes label, JSON panel shows both naming conventions), commit**

```bash
git add docs/astro.config.mjs docs/src
git commit -m "docs: add HookDemo, react guide, and custom-data guide"
```

---

### Task 7: Playground (both locales)

**Files:**
- Create: `docs/src/components/demos/Playground.tsx`, `docs/src/content/docs/playground.mdx`, `en/playground.mdx`
- Modify: `docs/astro.config.mjs` (add `{ slug: 'playground' }` at the end of the คู่มือ group), `getting-started.mdx` both locales (add remaining "ไปต่อ" links now that all guide pages exist)

**Interfaces:**
- Consumes: `useDefaultIndex`, CSS from Task 2, `SearchOptions` fields verified above.
- Produces: slug `playground`.

- [ ] **Step 1: Write `Playground.tsx`**

Spec deviation reminder: show result count + elapsed ms, not per-record scores (not exposed by the public API).

```tsx
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
```

- [ ] **Step 2: Write `playground.mdx` (th + en)**

Frontmatter `title: Playground` (both). One intro paragraph (ปรับ option แล้วดูผลทันที — เช่น ลด `threshold` เพื่อรับผลลัพธ์ที่ fuzzy ขึ้น, ปิด `romanizationAliases` แล้วลองพิมพ์ `lardprao`, ลองรหัส `45000` เพื่อดูผล `zipLimit`), then `<Playground client:visible />` / `<Playground client:visible locale="en" />`. Suggested experiments as a short bullet list mirroring those three.

- [ ] **Step 3: Complete the "ไปต่อ" sections in both `getting-started` pages** with relative links to all six guides + playground.

- [ ] **Step 4: Build, verify (threshold slider changes result count live; `lardprao` stops matching with aliases off), commit**

```bash
git add docs/astro.config.mjs docs/src
git commit -m "docs: add Playground page"
```

---

### Task 8: API reference (7 pages × 2 locales)

**Files:**
- Create: `docs/src/content/docs/reference/{search,enumerate,formatter,resolver,data,react,types}.md` + the 7 `en/reference/` mirrors
- Modify: `docs/astro.config.mjs` (add the third sidebar group)

**Interfaces:**
- Consumes: the "Verified public API" section above — signatures must match it exactly.

- [ ] **Step 1: Write the 7 Thai reference pages**

Every page: frontmatter `title`, then per export — signature block (copied from "Verified public API" above), parameter table (ชื่อ / ชนิด / ค่าเริ่มต้น / คำอธิบาย), return type, notes, one short example. Page-specific content:

- `reference/search.md` — `searchThaiAddress` (all 4 `SearchOptions` fields with defaults `limit: 10`, `threshold: 0.4`, `zipLimit: Infinity`, `romanizationAliases: true`; all-digit ≥ 2 queries route to the zip path; ranking: score → own-name matchRank → Thai collation) and `lookupByZipCode` (exact `Map.get` for full codes, prefix scan otherwise; exact-first then ascending).
- `reference/enumerate.md` — `listProvinces` (77, sorted by Thai name), `listAmphures`, `listTambons`; summary types with fields; unknown id → `[]`.
- `reference/formatter.md` — `formatThaiAddressSuggestion`; `ThaiAddressSuggestion` always carries both `labelTh` and `labelEn`, `label` follows `options.locale` (default `'th'`); `id` is `String(tambonId)` and is the key `selectSuggestion` uses.
- `reference/resolver.md` — `resolveThaiAddress`; dual naming: Thai-convention (`tambon`/`amphure`/`province`/`zipCode`) + English-convention aliases (`subdistrict`/`district`/`postalCode`) — same values, take your pick when saving to a DB.
- `reference/data.md` — `loadDefaultIndex` (async, ~30-40 ms synchronous build on first call, module-level singleton; call at mount/route load), `clearDefaultIndex` (reset singleton — for tests), `buildThaiAddressIndex` (+ `BuildIndexOptions`: `onSkip`, `validate` default `true`), `validateRawData` (throws descriptive `TypeError`).
- `reference/react.md` — `useThaiAddressAutocomplete`: full `UseThaiAddressAutocompleteOptions` table (`index` required; `limit`, `debounce` 200 ms, `threshold`, `zipLimit`, `initialQuery` seeds without searching on mount, `locale`, `onSelect`) and full return-value table (as in the react guide, but exhaustive).
- `reference/types.md` — `ThaiAddressRecord` (all 10 fields), `TrigramIndex` (opaque — "build via `buildThaiAddressIndex` or `loadDefaultIndex`, don't construct by hand"), `ThaiAddressSuggestion`, `ResolvedThaiAddress`, `ProvinceSummary`/`AmphureSummary`/`TambonSummary`, `SearchOptions`, `BuildIndexOptions`, `RawData` + raw row types (snake_case, `deleted_at`).

- [ ] **Step 2: Write the 7 English mirrors** — same structure, English prose.

- [ ] **Step 3: Add the reference sidebar group**

```js
{
  label: 'API Reference',
  items: [
    { slug: 'reference/search' },
    { slug: 'reference/enumerate' },
    { slug: 'reference/formatter' },
    { slug: 'reference/resolver' },
    { slug: 'reference/data' },
    { slug: 'reference/react' },
    { slug: 'reference/types' },
  ],
},
```

- [ ] **Step 4: Build, verify, commit**

```bash
git add docs/astro.config.mjs docs/src
git commit -m "docs: add hand-written API reference"
```

---

### Task 9: CI workflow + README link

**Files:**
- Create: `.github/workflows/docs.yml`
- Modify: `README.md` (docs link near the top)

- [ ] **Step 1: Write `.github/workflows/docs.yml`**

```yaml
name: Docs

on:
  push:
    branches: [main]
    paths:
      - 'docs/**'
      - 'src/**'
      - 'package.json'
      - 'package-lock.json'
      - '.github/workflows/docs.yml'
  pull_request:
    paths:
      - 'docs/**'
      - 'src/**'
      - 'package.json'
      - 'package-lock.json'
      - '.github/workflows/docs.yml'
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: docs-${{ github.ref }}
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: |
            package-lock.json
            docs/package-lock.json
      - name: Build library (docs consume it via file:..)
        run: |
          npm ci
          npm run build
      - name: Build docs
        working-directory: docs
        run: |
          npm ci
          npm run build
      - uses: actions/upload-pages-artifact@v3
        if: github.event_name != 'pull_request'
        with:
          path: docs/dist

  deploy:
    if: github.event_name != 'pull_request'
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Add the docs link to `README.md`** — right under the intro paragraph:

```markdown
**Docs:** https://naay99999.github.io/thai-zip/ (ไทย / [English](https://naay99999.github.io/thai-zip/en/))
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/docs.yml README.md
git commit -m "docs: add GitHub Pages deploy workflow and README link"
```

Note for the final report to the user: the one-time manual step — repo **Settings → Pages → Source = "GitHub Actions"** — must be done before the first deploy run succeeds.

---

### Task 10: Final verification pass

**Files:** none new — fixes only.

- [ ] **Step 1: Full clean build**

```bash
npm run build            # repo root — library
cd docs && npm run check # astro check: TS errors in demos/MDX
npm run build            # full site + links validator
```

Expected: all pass. Fix anything that doesn't.

- [ ] **Step 2: Manual smoke test in `npm run dev`**

- Landing (th + en): SearchDemo works, language toggle round-trips to the same page.
- Every guide page: demo loads (one shared index fetch — check the network tab shows the data chunk once), dark/light toggle keeps demos readable.
- Playground: threshold slider changes counts; `45000` returns 33 rows; aliases toggle changes `lardprao` behavior.
- Sidebar: three groups, translated labels on `/en/`.

- [ ] **Step 3: Verify the library itself is untouched**

Run: `git status` — no modified files under `src/`, `data/`, or root config except `README.md` and `.github/workflows/docs.yml`. Run `npm test` at repo root; expected: all pass (nothing in this plan touches library code).

- [ ] **Step 4: Commit any fixes**

```bash
git add -A && git commit -m "docs: final verification fixes"
```

(Skip the commit if Step 1-3 produced no changes.)

- [ ] **Step 5: Finish the branch** — use superpowers:finishing-a-development-branch (push `docs-site`, open a PR to `main` titled `docs: add Starlight documentation site`; after merge, the Docs workflow deploys automatically once Pages is set to "GitHub Actions").
