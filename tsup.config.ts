import { defineConfig } from 'tsup'
import { readFileSync, writeFileSync } from 'node:fs'
import { sep } from 'node:path'
import type { Plugin } from 'esbuild'

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

// src/data/loader.ts does `await import('./defaultData')`. With `splitting:
// false` on the data entry, esbuild would otherwise flatten that dynamic
// import into an in-file `__esm`/lazy-init wrapper, inlining all ~489 KB of
// generated tuple arrays into dist/data.js itself — only *evaluation* is
// deferred, the bytes always download with the rest of the module.
//
// This plugin marks that one specifier external so the dynamic import
// survives into the emitted output as a real `import('./defaultData.js')`,
// letting a consumer bundler defer downloading the data chunk until
// loadDefaultIndex() actually runs. It's scoped to loader.ts as the importer
// so it can never externalize an unrelated relative import elsewhere later.
//
// We deliberately use onResolve + `{ external: true }` here instead of
// tsup's/esbuild's top-level `external: [...]` string array: entries there
// are matched as path-like and resolved relative to the process CWD, not to
// the importing file, so matching a nested relative specifier like
// './defaultData' from src/data/loader.ts is not guaranteed to work
// consistently. onResolve's `external: true` return is fully specified
// regardless of CWD.
function externalizeDefaultDataChunk(): Plugin {
  return {
    name: 'externalize-default-data-chunk',
    setup(build) {
      build.onResolve({ filter: /^\.\/defaultData$/ }, (args) => {
        if (!args.importer.endsWith(`${sep}loader.ts`)) return undefined
        return { path: './defaultData.js', external: true }
      })
    },
  }
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
  // Data entry: loader + indexer glue only. The generated tuple data itself
  // is externalized (via externalizeDefaultDataChunk above) into the
  // separate `defaultData` entry below, so this file stays small and a
  // consumer bundler can defer downloading the data chunk until
  // loadDefaultIndex() is actually called.
  {
    entry: { data: 'src/data/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    splitting: false,
    sourcemap: false,
    external: [],
    treeshake: true,
    esbuildOptions: setUtf8Charset,
    esbuildPlugins: [externalizeDefaultDataChunk()],
  },
  // Private sibling chunk: the generated tuple arrays only. Not part of the
  // public API (no exports subpath — package.json's "files": ["dist/*.js",
  // ...] flat glob already matches it, but it's reached only via the
  // relative `import('./defaultData.js')` left behind inside dist/data.js
  // by externalizeDefaultDataChunk, never through the package's `exports`
  // map). ESM-only: both dist/data.js and dist/data.cjs import() this one
  // file — dynamic import() of an ESM module works fine from CJS too.
  {
    entry: { defaultData: 'src/data/defaultData.ts' },
    format: ['esm'],
    dts: false, // internal chunk; Compact* types were never in the public dist/data.d.ts
    splitting: false,
    sourcemap: false,
    treeshake: true,
    // MUST be here — this is now the file holding all the Thai text;
    // omitting it re-introduces the +187 KB raw \uXXXX-escape regression.
    esbuildOptions: setUtf8Charset,
  },
])
