import { defineConfig } from 'tsup'

export default defineConfig([
  // Core entry: pure headless API, no React
  {
    entry: { index: 'src/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    treeshake: true,
  },
  // React entry: hook + hook options type
  {
    entry: { react: 'src/react/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    splitting: false,
    sourcemap: true,
    external: ['react', 'react-dom'],
    treeshake: true,
  },
  // Data entry: compact raw data + async loader
  {
    entry: { data: 'src/data/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    splitting: false,
    sourcemap: false,
    external: [],
    treeshake: true,
  },
])
