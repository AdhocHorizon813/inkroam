// Search rendered text without rewriting Vue's DOM or losing code highlighting.
export function articleMatches(root: HTMLElement, query: string): Range[] {
  if (!query.trim()) return []
  const groups = new Map<Element, Text[]>()
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let node: Node | null
  while ((node = walker.nextNode())) {
    const parent = node.parentElement
    if (!parent || parent.closest('script,style,button,input,textarea,select,.katex-mathml,.article-code-toolbar,.article-diagram__panel,[hidden],[inert],[aria-hidden="true"]')) continue
    if (!node.textContent || !parent.getClientRects().length || getComputedStyle(parent).visibility === 'hidden') continue
    const block = parent.closest('p,h1,h2,h3,h4,h5,h6,pre,li,td,th,figcaption') || parent
    const nodes = groups.get(block) || []
    nodes.push(node as Text)
    groups.set(block, nodes)
  }
  const pattern = new RegExp(query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'giu')
  const result: Range[] = []
  for (const nodes of groups.values()) {
    const text = nodes.map(node => node.data).join('')
    for (const match of text.matchAll(pattern)) {
      const start = match.index!, end = start + match[0].length
      let offset = 0
      const range = document.createRange()
      for (const node of nodes) {
        const next = offset + node.length
        if (start >= offset && start < next) range.setStart(node, start - offset)
        if (end > offset && end <= next) { range.setEnd(node, end - offset); break }
        offset = next
      }
      result.push(range)
    }
  }
  return result
}
