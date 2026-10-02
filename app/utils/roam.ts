export type RoamEntry = { path: string; draft?: boolean }

/** Accept only canonical article/note routes, never external or query-string destinations. */
export function roamPaths(entries: readonly RoamEntry[]): string[] {
  return [...new Set(entries.filter(entry => !entry.draft
    && /^\/(?:posts\/[^/?#\\]+|notes\/[^/?#\\]+\/[^/?#\\]+)$/.test(entry.path))
    .map(entry => entry.path))]
}

export function readRoamHistory(raw: string | null): string[] | null {
  if (!raw) return null
  try {
    const value: unknown = JSON.parse(raw)
    return Array.isArray(value) && value.every(path => typeof path === 'string') ? value : null
  } catch { return null }
}

export function chooseRoamPath(paths: readonly string[], history: readonly string[], random = Math.random): string | undefined {
  const seen = new Set(history)
  const remaining = paths.filter(path => !seen.has(path))
  // At the cycle boundary, avoid immediately reopening the last page if possible.
  const pool = remaining.length ? remaining : paths.filter(path => paths.length === 1 || path !== history.at(-1))
  if (!pool.length) return undefined
  return pool[Math.floor(random() * pool.length)]
}

export function rememberRoamPath(paths: readonly string[], history: readonly string[], selected: string): string[] {
  const available = new Set(paths)
  const current = [...new Set(history.filter(path => available.has(path)))]
  if (!available.has(selected)) return current
  const next = current.length === paths.length ? [] : current.filter(path => path !== selected)
  return [...next, selected]
}
