export type ExcerptPart = { kind: 'text' | 'math'; text: string }
type Node = { type?: string; tag?: string; value?: unknown; props?: Record<string, unknown>; children?: unknown[] }

function unpack(value: unknown): Node {
  if (typeof value === 'string') return { type: 'text', value }
  if (Array.isArray(value)) return { tag: value[0], props: value[1], children: value.slice(2) }
  return value && typeof value === 'object' ? value as Node : {}
}

function textOf(value: unknown): string {
  const node = unpack(value)
  return node.type === 'text' ? String(node.value || '') : (node.children || []).map(textOf).join('')
}

function texOf(value: unknown): string | undefined {
  const node = unpack(value)
  if (node.tag === 'annotation' && node.props?.encoding === 'application/x-tex') return textOf(value)
  for (const child of node.children || []) {
    const tex = texOf(child)
    if (tex !== undefined) return tex
  }
}

function partsOf(value: unknown): ExcerptPart[] {
  const node = unpack(value)
  if (node.type === 'text') return [{ kind: 'text', text: String(node.value || '').replace(/\s+/g, ' ') }]
  const classes = String(node.props?.className || node.props?.class || '').split(/[\s,]+/)
  if (classes.includes('katex')) {
    const tex = texOf(value)
    // Stop at the outer formula: never extract MathML and visual HTML twice.
    return [{ kind: tex === undefined ? 'text' : 'math', text: tex ?? '〔公式〕' }]
  }
  if (['script', 'style', 'annotation', 'annotation-xml', 'math'].includes(node.tag || '')) return []
  return (node.children || []).flatMap(partsOf)
}

/** Same top-level heading boundaries and IDs as Content's section index. */
export function articleExcerptSections(body: unknown, path: string, description = '') {
  const root = unpack(body)
  const nodes = root.type === 'minimark' && Array.isArray(root.value) ? root.value : root.children || []
  const sections = new Map<string, ExcerptPart[]>([[path, [{ kind: 'text', text: description + ' ' }]]])
  let id = path
  for (const value of nodes) {
    const node = unpack(value)
    if (/^h[1-6]$/.test(node.tag || '')) {
      id = `${path}#${node.props?.id}`
      sections.set(id, [])
    } else {
      sections.get(id)!.push(...partsOf(value), { kind: 'text', text: ' ' })
    }
  }
  return sections
}

/** Treat each formula as one indivisible unit, so truncation cannot break TeX. */
export function excerptParts(parts: ExcerptPart[], query: string, limit = 150): ExcerptPart[] {
  const plain = parts.map(part => part.kind === 'math' ? '\uFFFC' : part.text).join('')
  const term = query.toLocaleLowerCase('zh-CN').trim().split(/\s+/)[0] || ''
  let match = term ? plain.toLocaleLowerCase('zh-CN').indexOf(term) : 0
  if (match < 0) {
    let position = 0
    for (const part of parts) {
      if (part.kind === 'math' && part.text.toLocaleLowerCase('zh-CN').includes(term)) { match = position; break }
      position += part.kind === 'math' ? 1 : part.text.length
    }
  }
  const start = Math.max(0, match - 52)
  const end = Math.min(plain.length, start + limit)
  const result: ExcerptPart[] = start ? [{ kind: 'text', text: '…' }] : []
  let position = 0
  for (const part of parts) {
    const length = part.kind === 'math' ? 1 : part.text.length
    if (position < end && position + length > start) {
      result.push(part.kind === 'math' ? part : { kind: 'text', text: part.text.slice(Math.max(0, start - position), end - position) })
    }
    position += length
  }
  if (end < plain.length) result.push({ kind: 'text', text: '…' })
  return result.length ? result : [{ kind: 'text', text: '打开文章继续阅读。' }]
}
