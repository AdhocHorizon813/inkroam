/** Group once, retaining the original match order within each article. */
export function groupSearchMatches<T extends { id: string }>(matches: readonly T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>()
  for (const match of matches) {
    const path = match.id.split('#', 1)[0]!
    const group = groups.get(path)
    if (group) group.push(match)
    else groups.set(path, [match])
  }
  return groups
}
