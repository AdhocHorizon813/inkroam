export type ReadingLink = { path: string; kind: 'review' | 'next'; reason: string }
type Target = { path: string; title: string; draft?: boolean }

/** Author-curated relationships, never inferred from tags or course order.
 * Only published, same-course targets are available in this first iteration. */
export function resolveReadingLinks<T extends Target>(current: string, links: readonly ReadingLink[] | null | undefined, entries: readonly T[]) {
  if (!/^\/notes\/[a-z0-9-]+\/[a-z0-9-]+$/.test(current)) return []
  const prefix = current.slice(0, current.lastIndexOf('/') + 1)
  const targets = new Map(entries.filter(entry => !entry.draft).map(entry => [entry.path, entry]))
  const seen = new Set([current])
  return (links || []).flatMap(link => {
    const target = targets.get(link.path)
    if (!target || seen.has(link.path) || !link.path.startsWith(prefix)
      || !/^\/notes\/[a-z0-9-]+\/[a-z0-9-]+$/.test(link.path)
      || !['review', 'next'].includes(link.kind) || !link.reason?.trim()) return []
    seen.add(link.path)
    return [{ ...link, reason: link.reason.trim(), title: target.title }]
  }).slice(0, 3)
}
