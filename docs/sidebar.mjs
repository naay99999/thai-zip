// Shared by astro.config.mjs (site navigation) and src/lib/docs-markdown.ts
// (llms.txt ordering) so both always list pages in the same order.
export const sidebar = [
  {
    label: 'เริ่มต้น',
    translations: { en: 'Start Here' },
    items: [{ slug: 'getting-started' }],
  },
  {
    label: 'คู่มือ',
    translations: { en: 'Guides' },
    items: [
      { slug: 'guides/search' },
      { slug: 'guides/zip-lookup' },
      { slug: 'guides/cascade' },
      { slug: 'guides/english-input' },
      { slug: 'guides/react' },
      { slug: 'guides/custom-data' },
      { slug: 'playground' },
    ],
  },
  {
    label: 'API Reference',
    translations: { en: 'API Reference' },
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
]
