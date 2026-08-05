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
