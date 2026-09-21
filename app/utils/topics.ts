type TaggedEntry = { path: string; tags?: string[]; draft?: boolean }
export type Topic = { name: string; count: number }

export function collectTopics(entries: TaggedEntry[]): Topic[] {
  const topics = new Map<string, Set<string>>()
  for (const entry of entries) {
    if (entry.draft) continue
    for (const name of entry.tags || []) {
      if (!name.trim()) continue
      if (!topics.has(name)) topics.set(name, new Set())
      topics.get(name)!.add(entry.path)
    }
  }
  return [...topics].map(([name, paths]) => ({ name, count: paths.size }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN') || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
}

export function filterTopics(topics: Topic[], query: string) {
  const normalize = (value: string) => value.toLocaleLowerCase('zh-CN').replace(/\s+/g, ' ').trim()
  const terms = normalize(query).split(' ').filter(Boolean)
  return topics.filter(topic => terms.every(term => normalize(topic.name).includes(term)))
}

// Model attribution is preserved as tags but is not a subject similarity signal.
export const isSubjectTag = (name: string) => !/^(?:AI$|GPT[-\s]|deepseek|claude|gemini)/i.test(name)

export function relatedEntries<T extends TaggedEntry & { date: string }>(current: T, entries: T[], limit = 3): T[] {
  const subjects = new Set((current.tags || []).filter(isSubjectTag))
  const seen = new Set<string>()
  return entries.filter(entry => {
    if (entry.draft || entry.path === current.path || seen.has(entry.path)) return false
    seen.add(entry.path)
    return true
  }).map(entry => ({ entry, score: [...new Set(entry.tags || [])].filter(tag => subjects.has(tag)).length }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || b.entry.date.localeCompare(a.entry.date) || a.entry.path.localeCompare(b.entry.path))
    .slice(0, limit).map(item => item.entry)
}
