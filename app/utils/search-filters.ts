export type SearchFilters = { type: string; course: string; tag: string; from: string; to: string; sort: string }
export const emptySearchFilters = (): SearchFilters => ({ type: '', course: '', tag: '', from: '', to: '', sort: '' })
export function readSearchFilters(query: Record<string, unknown>): SearchFilters {
  const text = (key: string) => typeof query[key] === 'string' ? query[key] as string : ''
  const date = (key: string) => {
    const value = text(key)
    const parsed = new Date(`${value}T00:00:00Z`)
    return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(parsed.getTime()) && parsed.toISOString() === `${value}T00:00:00.000Z` ? value : ''
  }
  const course = text('course')
  return {
    // 课程只属于笔记：网址里带 course 时一律按笔记处理（即使 type 写了别的），
    // 否则会出现「课程筛选在生效，但课程框因为类型不是笔记而被禁用」的矛盾界面。
    type: course ? 'notes' : (['posts', 'notes'].includes(text('type')) ? text('type') : ''),
    course,
    tag: text('tag'),
    from: date('from'),
    to: date('to'),
    sort: ['newest', 'oldest'].includes(text('sort')) ? text('sort') : '',
  }
}
export function matchesSearchFilters(post: { path: string; tags?: string[]; date: string }, filters: SearchFilters) {
  if (filters.type && !post.path.startsWith(`/${filters.type}/`)) return false
  if (filters.course && !post.path.startsWith(`/notes/${filters.course}/`)) return false
  if (filters.tag && !post.tags?.includes(filters.tag)) return false
  const date = post.date.slice(0, 10)
  return (!filters.from || date >= filters.from) && (!filters.to || date <= filters.to)
}
