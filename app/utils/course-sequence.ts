type CourseEntry = { path: string; date: string; order?: number | string | null; draft?: boolean }

// Content's database/payload can return numeric frontmatter as strings.
function numericOrder(order: CourseEntry['order']) {
  if (order == null || (typeof order === 'string' && !order.trim())) return Infinity
  const value = Number(order)
  return Number.isInteger(value) && value >= 0 ? value : Infinity
}

export function courseNeighbours<T extends CourseEntry>(path: string, entries: T[]) {
  const segments = path.split('/')
  if (segments[1] !== 'notes' || segments.length !== 4) return { previous: undefined, next: undefined }
  const prefix = `/notes/${segments[2]}/`
  const sorted = entries.filter(entry => !entry.draft && entry.path.startsWith(prefix))
    .sort((a, b) => {
      const aOrder = numericOrder(a.order)
      const bOrder = numericOrder(b.order)
      return (aOrder === bOrder ? 0 : aOrder < bOrder ? -1 : 1) || a.date.localeCompare(b.date) || a.path.localeCompare(b.path)
    })
  const index = sorted.findIndex(entry => entry.path === path)
  return { previous: index > 0 ? sorted[index - 1] : undefined, next: index >= 0 ? sorted[index + 1] : undefined }
}
