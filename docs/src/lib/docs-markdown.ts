import type { CollectionEntry } from 'astro:content'
import { sidebar } from '../../sidebar.mjs'
import { getDemoSource } from './demo-source'

export const SITE_URL = 'https://naay99999.github.io/thai-zip'
const BASE_PATH = '/thai-zip'
const REACT_THAIZIP_LLMS_URL = 'https://react-thai-zip.vercel.app/llms.txt'

type DocsEntry = CollectionEntry<'docs'>
type Locale = 'th' | 'en'

const COPY = {
  th: {
    heading: 'ไทย',
    demo: 'ตัวอย่างแบบโต้ตอบดูได้ที่',
  },
  en: {
    heading: 'English',
    demo: 'Try the interactive demo at',
  },
} as const

export function getLocale(id: string): Locale {
  return id === 'en' || id.startsWith('en/') ? 'en' : 'th'
}

/** `index` → `''`, `en` → `en`, `guides/search` → `guides/search` */
function getPageSlug(id: string): string {
  return id === 'index' ? '' : id.replace(/\/index$/, '')
}

function getMarkdownSlug(id: string): string {
  const slug = getPageSlug(id)
  if (slug === '') return 'index'
  if (slug === 'en') return 'en/index'
  return slug
}

export function getPageUrl(id: string): string {
  const slug = getPageSlug(id)
  return `${SITE_URL}/${slug ? `${slug}/` : ''}`
}

/** Site-relative URL of a page's markdown, e.g. `/thai-zip/guides/search.md`. */
export function getPageMarkdownUrl(id: string): string {
  return `${BASE_PATH}/${getMarkdownSlug(id)}.md`
}

function getAbsoluteMarkdownUrl(id: string): string {
  return `${SITE_URL}/${getMarkdownSlug(id)}.md`
}

export function getMarkdownParams(entries: DocsEntry[]) {
  return entries.map((entry) => ({ params: { slug: getMarkdownSlug(entry.id) }, props: { entry } }))
}

function fence(lang: string, code: string, title?: string): string {
  return `\`\`\`${lang}${title ? ` title="${title}"` : ''}\n${code}\n\`\`\``
}

function bodyToMarkdown(entry: DocsEntry): string {
  const pageUrl = getPageUrl(entry.id)
  const copy = COPY[getLocale(entry.id)]

  return (entry.body ?? '')
    .replace(/^import .+ from '.+'\s*$/gm, '')
    .replace(/<ComponentPreview source="(\w+)">[\s\S]*?<\/ComponentPreview>/g, (_, source: string) =>
      getDemoSource(source)
        .map((file) => fence(file.lang, file.code, file.name))
        .join('\n\n'),
    )
    .replace(/^<[A-Z]\w*\b[^>]*\/>\s*$/gm, `> ${copy.demo} ${pageUrl}`)
    .replace(/^:::(\w+)\n([\s\S]*?)\n:::$/gm, (_, type: string, content: string) => {
      const label = type.charAt(0).toUpperCase() + type.slice(1)
      return content
        .split('\n')
        .map((line, i) => `> ${i === 0 ? `**${label}:** ` : ''}${line}`)
        .join('\n')
    })
    .replace(/\]\(([^)\s]+)\)/g, (match, href: string) =>
      /^(?:[a-z]+:|#)/i.test(href) ? match : `](${new URL(href, pageUrl).toString()})`,
    )
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function getDescription(entry: DocsEntry): string | undefined {
  return entry.data.description ?? entry.data.hero?.tagline
}

export function renderPageMarkdown(entry: DocsEntry): string {
  const description = getDescription(entry)
  return [
    `# ${entry.data.title}`,
    description ? `> ${description}` : '',
    `Source: ${getPageUrl(entry.id)}`,
    bodyToMarkdown(entry),
  ]
    .filter(Boolean)
    .join('\n\n') + '\n'
}

type SidebarGroup = { label: string; translations?: { en?: string }; items: { slug: string }[] }

/** Pages of one locale in sidebar order, grouped by sidebar section. */
function getSections(entries: DocsEntry[], locale: Locale) {
  const byId = new Map(entries.map((entry) => [entry.id, entry]))
  const prefix = locale === 'en' ? 'en/' : ''
  const home = byId.get(locale === 'en' ? 'en' : 'index')

  return [
    { label: locale === 'en' ? 'Overview' : 'ภาพรวม', pages: home ? [home] : [] },
    ...(sidebar as SidebarGroup[]).map((group) => ({
      label: locale === 'en' ? (group.translations?.en ?? group.label) : group.label,
      pages: group.items
        .map((item) => byId.get(`${prefix}${item.slug}`))
        .filter((entry): entry is DocsEntry => entry !== undefined),
    })),
  ]
}

export function renderDocsIndex(entries: DocsEntry[]): string {
  const lines = [
    '# thaizip documentation',
    '',
    '> Headless fuzzy search for Thai addresses (subdistrict, district, province, postal code) with Thai and English input. Zero runtime dependencies, optional React hook.',
    '',
    `- [Full documentation](${SITE_URL}/llms-full.txt): every page below in one file`,
    `- [react-thaizip documentation](${REACT_THAIZIP_LLMS_URL}): ready-made React components built on thaizip, scaffolded by a CLI`,
  ]

  for (const locale of ['th', 'en'] as const) {
    lines.push('', `## ${COPY[locale].heading}`)
    for (const section of getSections(entries, locale)) {
      lines.push('', `### ${section.label}`, '')
      for (const entry of section.pages) {
        const description = getDescription(entry)
        lines.push(`- [${entry.data.title}](${getAbsoluteMarkdownUrl(entry.id)})${description ? `: ${description}` : ''}`)
      }
    }
  }

  return `${lines.join('\n')}\n`
}

export function renderFullDocs(entries: DocsEntry[]): string {
  const ordered = (['th', 'en'] as const).flatMap((locale) =>
    getSections(entries, locale).flatMap((section) => section.pages),
  )
  return ordered.map((entry) => renderPageMarkdown(entry).trim()).join('\n\n---\n\n') + '\n'
}
