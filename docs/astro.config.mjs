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
      plugins: [starlightLinksValidator({ errorOnRelativeLinks: false })],
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
    }),
    react(),
  ],
  vite: {
    resolve: { dedupe: ['react', 'react-dom'] },
  },
})
