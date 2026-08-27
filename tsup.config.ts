import { defineConfig } from 'tsup'
import { readFileSync, writeFileSync } from 'node:fs'

// esbuild recognizes "use client" as a special module-level directive and
// strips it when it arrives via tsup's `banner` option while bundling —
// see https://github.com/evanw/esbuild/issues/3765. `banner` alone is
// silently dropped ("Module level directives cause errors when bundled,
// \"use client\" ... was ignored"), so the directive is prepended manually
// here as a post-build step, once esbuild is done touching the file.
function prependUseClient(files: string[]) {
  for (const file of files) {
    const contents = readFileSync(file, 'utf8')
    if (contents.startsWith('"use client"')) continue
    writeFileSync(file, `"use client";\n${contents}`)
  }
}

// tsup has no top-level `charset` option (its config schema forwards only a
// subset of esbuild options), but it lets us mutate the esbuild BuildOptions
// per entry via `esbuildOptions`. Emitting Thai text as UTF-8 instead of
// \uXXXX escapes avoids doubling every Thai byte (3 UTF-8 bytes → 6 escape
// bytes): for dist/data.js alone that is ~187 KB raw (~6 KB gzip / ~5 KB
// brotli) for zero benefit on any modern JS runtime.
function setUtf8Charset(options: import('esbuild').BuildOptions): void {
  options.charset = 'utf8'
}

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
    esbuildOptions: setUtf8Charset,
    // Emit Thai text as UTF-8 instead of \uXXXX escapes. esbuild's ASCII
    // default doubles every Thai byte (3 UTF-8 bytes → 6 escape bytes):
    // for dist/data.js alone that is +187 KB raw (~+6 KB gzip / +5 KB
    // brotli) for zero benefit on any modern JS runtime.
    // (charset is applied via esbuildOptions, not this unsupported key.)
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
    esbuildOptions: setUtf8Charset,
    // Required for Next.js App Router: importing this hook from a Server
    // Component must fail fast with a clear directive rather than a build
    // error deep in React's server/client boundary. Core and data entries
    // intentionally do NOT get this directive — they must stay usable
    // server-side. `banner` is set too (harmless, esbuild ignores it while
    // bundling — see prependUseClient above for why the real work happens
    // in onSuccess).
    banner: { js: '"use client"' },
    onSuccess: async () => {
      prependUseClient(['dist/react.js', 'dist/react.cjs'])
    },
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
    esbuildOptions: setUtf8Charset,
  },
])
