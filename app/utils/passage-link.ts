export type PassageSelection = { heading: string; passage?: string }
const BLOCKS = 'p, li, blockquote'
const UNSAFE = 'math, .katex, pre, table, svg, script, style, [aria-hidden="true"]'

export function passageKey(text: string): string {
  const normalized = text.normalize('NFC').replace(/\s+/g, ' ').trim()
  let hash = 2166136261
  for (let i = 0; i < normalized.length; i++) hash = Math.imul(hash ^ normalized.charCodeAt(i), 16777619)
  return `v1-${(hash >>> 0).toString(16).padStart(8, '0')}-${normalized.length.toString(36)}`
}

function blockKey(block: Element): string | undefined {
  if (block.closest(UNSAFE) || block.querySelector(UNSAFE)) return
  const text = block.textContent?.trim()
  return text ? passageKey(text) : undefined
}

export function findPassageTarget(article: Element, key: string): Element | null {
  if (!/^v1-[a-f0-9]{8}-[a-z0-9]+$/.test(key)) return null
  const matches = Array.from(article.querySelectorAll(BLOCKS)).filter(block => blockKey(block) === key)
  return matches.length === 1 ? matches[0]! : null
}

export function selectedPassage(article: Element | null, selection: Selection | null): PassageSelection | null {
  if (!article || !selection || selection.isCollapsed || selection.rangeCount !== 1 || !selection.toString().trim()) return null
  const range = selection.getRangeAt(0)
  if (!article.contains(range.startContainer) || !article.contains(range.endContainer)) return null
  const start = range.startContainer.nodeType === 1 ? range.startContainer as Element : range.startContainer.parentElement
  if (!start || start.closest('input, textarea, [contenteditable="true"]')) return null
  let heading = ''
  for (const item of article.querySelectorAll('h2[id], h3[id], h4[id]')) {
    if (item.contains(range.startContainer) || (item.compareDocumentPosition(range.startContainer) & 4)) heading = item.id
  }
  const block = start.closest(BLOCKS)
  const key = block && article.contains(block) && block.contains(range.endContainer) ? blockKey(block) : undefined
  return { heading, passage: key && findPassageTarget(article, key) === block ? key : undefined }
}

export function passageUrl(href: string, selection: PassageSelection | null): string {
  const url = new URL(href)
  url.search = ''
  url.hash = selection?.heading ? encodeURIComponent(selection.heading) : ''
  if (selection?.passage) url.searchParams.set('passage', selection.passage)
  return url.href
}
