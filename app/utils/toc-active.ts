export type HeadingPosition = { id: string; top: number; margin: number }

export function resolveActiveHeading(headings: HeadingPosition[], hash: string, scrollY: number, maxScroll: number, offset: number) {
  if (!headings.length) return ''
  let id = hash.replace(/^#/, '')
  try { id = decodeURIComponent(id) } catch { /* Malformed hashes are simply unmatched. */ }
  const target = headings.find(heading => heading.id === id)
  if (target) {
    // Near the document end the browser clamps the destination, leaving the
    // selected heading below the usual activation line. Respect that destination.
    const destination = Math.max(0, Math.min(maxScroll, scrollY + target.top - target.margin))
    if (Math.abs(scrollY - destination) <= 3) return target.id
  }
  if (maxScroll > 0 && scrollY >= maxScroll - 3) return headings.at(-1)!.id
  let current = headings[0]!.id
  for (const heading of headings) {
    if (heading.top <= Math.max(offset, heading.margin) + 2) current = heading.id
  }
  return current
}
