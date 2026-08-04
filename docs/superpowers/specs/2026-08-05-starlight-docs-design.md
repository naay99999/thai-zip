# thaizip documentation site — design spec

Date: 2026-08-05
Status: approved pending user review

## Goal

A bilingual (Thai-primary, English-secondary) documentation website for the `thaizip`
package, built with Astro Starlight, hosted on GitHub Pages, with live demos powered
by the real library — a full-page Playground plus small embedded demos on the pages
they illustrate.

Out of scope: custom domain, versioned docs, analytics, docs for `react-thaizip`
(that package will get its own Fumadocs site after its v2 redesign; this site only
cross-links to it), replacing Starlight's built-in Pagefind search.

## Decisions (locked)

| Topic | Decision |
|---|---|
| Framework | Astro Starlight, project lives at `docs/` inside the `thai-zip` repo |
| Hosting | GitHub Pages at `https://naay99999.github.io/thai-zip/`, deployed via GitHub Actions |
| Root locale | Thai at `/`, English under `/en/` (Starlight built-in i18n) |
| Content scope | Full coverage: getting started, all guides, hand-written API reference for every export |
| API reference | Hand-written (curated, bilingual) — NOT generated via starlight-typedoc (English-only output conflicts with Thai-primary goal) |
| Demos | React islands via `@astrojs/react`; `thaizip` installed as `file:..` so demos always match repo source |
| Demo scope boundary | Demos show the *engine's* capabilities (search quality, zip lookup, scoring), not polished UI. The React hook page uses a minimal unstyled example and points to `react-thaizip` for styled components |
| Styling | Plain scoped CSS using Starlight CSS variables (`--sl-color-*`) for automatic dark/light support; no Tailwind |
| Branch | All work on `docs-site` branch; commits use `docs:` prefix (no release-please trigger) |

## Project structure

```
thai-zip/docs/                  # Astro Starlight project ("private": true, never published)
├── package.json                # astro, @astrojs/starlight, @astrojs/react, react, react-dom,
│                               # starlight-links-validator, thaizip (file:..)
├── astro.config.mjs            # site: 'https://naay99999.github.io', base: '/thai-zip',
│                               # i18n config, sidebar, links-validator plugin
├── src/
│   ├── components/demos/       # React demo components (.tsx)
│   └── content/docs/           # Thai pages at root, English mirror under en/
└── public/
```

The `docs/superpowers/` folder (this spec) sits inside the Astro project root but
outside `src/`, so it does not affect the build.

## Sitemap (identical structure in both locales)

| Page | Content | Live demo |
|---|---|---|
| `/` | Hero, small search demo, links into docs | `SearchDemo` |
| `/getting-started/` | Install, load index, first search, the three entry points (`thaizip`, `thaizip/react`, `thaizip/data`) | — |
| `/guides/search/` | Thai/English text search, options (`limit`, `threshold`), ranking explanation; "how search works" (trigram + normalization) as a closing section, not a separate page | `SearchDemo` |
| `/guides/zip-lookup/` | Postal-code search, prefix scan, why `zipLimit` defaults to unlimited | `ZipDemo` |
| `/guides/english-input/` | RTGS spellings, romanization aliases, limitations | `SearchDemo` (EN preset) |
| `/guides/cascade/` | Province → amphure → tambon selects via enumeration API | `CascadeDemo` |
| `/guides/react/` | `useThaiAddressAutocomplete`, minimal unstyled example, callout linking to `react-thaizip` | `HookDemo` |
| `/guides/custom-data/` | `buildThaiAddressIndex` + `validateRawData` with user-supplied data | — |
| `/playground/` | Full demo with tweakable options | `Playground` |
| `/reference/search/` | `searchThaiAddress`, `lookupByZipCode` | — |
| `/reference/enumerate/` | `listProvinces`, `listAmphures`, `listTambons` | — |
| `/reference/formatter/` | `formatThaiAddressSuggestion` | — |
| `/reference/resolver/` | `resolveThaiAddress` | — |
| `/reference/data/` | `loadDefaultIndex`, `clearDefaultIndex`, `buildThaiAddressIndex`, `validateRawData` | — |
| `/reference/react/` | `useThaiAddressAutocomplete` full API | — |
| `/reference/types/` | `ThaiAddressRecord`, `ThaiAddressSuggestion`, `ResolvedThaiAddress`, options types | — |

Sidebar groups: เริ่มต้น / คู่มือ / API Reference (labels translated via Starlight's
sidebar i18n). Content sources: README.md and CLAUDE.md already cover most material.

## Demo architecture

- All demos are React components in `src/components/demos/`, embedded in MDX with
  `client:visible` so JS loads only when scrolled into view; pages without demos stay
  pure static HTML.
- Every demo calls `loadDefaultIndex()` from `thaizip/data`, which is already a
  module-level singleton — multiple demos on one page share one index load (Vite
  bundles `thaizip` once, shared across islands).
- Loading state: while the index loads (~132 KB gzip + ~40 ms build), show a
  localized "loading address data…" message inside the component. On failure, show
  an error message with a retry button. A demo must never render blank.
- Localization: demos take a `locale: 'th' | 'en'` prop from the embedding MDX page
  for their UI strings (placeholder, loading, error). Demos know nothing about
  Starlight i18n.

### Components (5)

| Component | Used on | Behavior |
|---|---|---|
| `SearchDemo` | landing, guides/search, guides/english-input | Input + results dropdown using core `searchThaiAddress` directly (not the hook — showcases the headless API). `initialQuery` prop lets each page preset a different example (e.g. `"bang rak"` on english-input) |
| `ZipDemo` | guides/zip-lookup | Numeric input, shows `lookupByZipCode` results + count of matched tambons |
| `CascadeDemo` | guides/cascade | Three selects province → amphure → tambon, shows resulting zipCode |
| `HookDemo` | guides/react | Uses `useThaiAddressAutocomplete` for real; unstyled; renders the `ResolvedThaiAddress` from `onSelect` as JSON |
| `Playground` | playground | Combines search + zip with an options panel: `threshold` (slider), `limit`, `zipLimit`, `locale`, `romanizationAliases` (toggle); results display per-record `score` to make threshold effects visible |

## CI / Deploy

New workflow `.github/workflows/deploy-docs.yml` in the `thai-zip` repo:

- **Deploy job** — on push to `main` filtered to `docs/**` and `src/**` paths (demos
  consume real library code, so library changes must rebuild docs), plus
  `workflow_dispatch`. Steps are hand-written (not `withastro/action`) because the
  library must build first:
  1. checkout, setup-node
  2. `npm ci && npm run build` at repo root (produces `dist/` that `file:..` resolves to)
  3. `npm ci && npx astro build` in `docs/`
  4. `actions/upload-pages-artifact` → `actions/deploy-pages`
  - Workflow permissions: `pages: write`, `id-token: write`.
- **PR check job** — same build steps, runs on pull requests touching `docs/**` or
  `src/**`; broken MDX, bad imports, TS errors in demos, or broken internal links
  fail before merge.
- **Link validation** — `starlight-links-validator` plugin runs at build time and
  catches cross-locale link rot (the most common bug in mirrored bilingual docs).
- **One-time manual step** — repo Settings → Pages → Source = "GitHub Actions".

## Testing

The build is the quality gate (MDX validity, imports, demo TypeScript, internal
links). No unit tests for demo components — they are thin wrappers over an
already-tested library; verify visually in the dev server during development.

## Release hygiene

- All commits on this work use the `docs:` prefix → release-please never triggers a
  `thaizip` release from docs work.
- `docs/package.json` sets `"private": true` → can never be published.
- No change to `release-please-config.json` is needed — release-please only reacts
  to conventional-commit types, and `docs/` is not a tracked release path.
