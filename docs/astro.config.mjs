// @ts-check
import { defineConfig } from 'astro/config'
import starlight from '@astrojs/starlight'
import react from '@astrojs/react'
import starlightLinksValidator from 'starlight-links-validator'
import { sidebar } from './sidebar.mjs'

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
      sidebar,
      components: {
        PageTitle: './src/components/PageTitle.astro',
      },
    }),
    react(),
  ],
  vite: {
    resolve: { dedupe: ['react', 'react-dom'] },
  },
})
