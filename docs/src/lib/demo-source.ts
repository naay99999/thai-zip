const rawSources = import.meta.glob<string>('../components/demos/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
})

export type DemoSourceFile = { name: string; lang: 'ts' | 'tsx'; code: string }

function readDemoFile(name: string): string {
  const code = rawSources[`../components/demos/${name}`]
  if (code === undefined) throw new Error(`Unknown demo source: ${name}`)
  // The stylesheet is specific to this docs site; leave it out of the copyable code.
  return code.replace(/^import '\.\/demos\.css'\n/m, '').trim()
}

/**
 * Source files shown for a demo: the demo itself, followed by any local helper
 * modules it imports (e.g. `useDefaultIndex`), so the code is copyable as a whole.
 */
export function getDemoSource(source: string): DemoSourceFile[] {
  const main = `${source}.tsx`
  const files: DemoSourceFile[] = [{ name: main, lang: 'tsx', code: readDemoFile(main) }]
  for (const [, local] of files[0].code.matchAll(/from '\.\/(\w+)'/g)) {
    const name = `../components/demos/${local}.ts` in rawSources ? `${local}.ts` : `${local}.tsx`
    files.push({ name, lang: name.endsWith('.tsx') ? 'tsx' : 'ts', code: readDemoFile(name) })
  }
  return files
}
