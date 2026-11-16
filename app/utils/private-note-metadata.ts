import { parseDocument } from 'yaml'

export interface PrivateNoteMetadata {
  title?: string
  description?: string
  date?: string
  readingTime?: string
  tags?: string[]
  pinned?: boolean
  featured?: boolean
  aiGenerated?: boolean
  aiAssisted?: boolean
}

/** Parse locally after authentication. Only allow display fields, never component props. */
export function splitPrivateNote(source: string): { body: string, metadata: PrivateNoteMetadata } {
  const text = source.replace(/^\uFEFF/, '')
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text)
  if (!frontmatter) return { body: text, metadata: {} }
  const document = parseDocument(frontmatter[1]!, { schema: 'core', uniqueKeys: true })
  if (document.errors.length) throw new Error('Invalid private frontmatter')
  const raw: unknown = document.toJS({ maxAliasCount: 0 })
  const metadata: PrivateNoteMetadata = {}
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const fields = raw as Record<string, unknown>
    for (const name of ['title', 'description', 'readingTime'] as const) {
      if (typeof fields[name] === 'string') metadata[name] = fields[name]
    }
    if (typeof fields.date === 'string' && /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(fields.date) && Number.isFinite(Date.parse(fields.date))) metadata.date = fields.date
    if (Array.isArray(fields.tags)) metadata.tags = fields.tags.filter((tag): tag is string => typeof tag === 'string')
    for (const name of ['pinned', 'featured', 'aiGenerated', 'aiAssisted'] as const) {
      if (typeof fields[name] === 'boolean') metadata[name] = fields[name]
    }
  }
  return { body: text.slice(frontmatter[0].length), metadata }
}
