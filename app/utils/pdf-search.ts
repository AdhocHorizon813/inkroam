/** Offsets refer to original PDF text items, not the normalized search string. */
export type PdfSearchItem = { str: string; hasEOL?: boolean }
export type PdfMatch = { page: number; parts: { item: number; start: number; end: number }[] }

export function findPdfMatches(items: PdfSearchItem[], query: string, page: number): PdfMatch[] {
  const needle = query.normalize('NFKC').toLowerCase().replace(/\s+/gu, ' ').trim()
  if (!needle) return []
  let text = ''
  const offsets: { item: number; start: number; end: number }[] = []
  items.forEach((item, index) => {
    let start = 0
    for (const char of item.str) {
      const normalized = char.normalize('NFKC').toLowerCase().replace(/\s/gu, ' ')
      for (const unit of normalized) {
        if (unit === ' ' && text.endsWith(' ')) continue
        text += unit
        for (let n = 0; n < unit.length; n++) offsets.push({ item: index, start, end: start + char.length })
      }
      start += char.length
    }
    if (item.hasEOL && !text.endsWith(' ')) {
      text += ' '
      offsets.push({ item: index, start, end: start })
    }
  })
  const matches: PdfMatch[] = []
  for (let at = text.indexOf(needle); at !== -1; at = text.indexOf(needle, at + needle.length)) {
    const parts: PdfMatch['parts'] = []
    for (const offset of offsets.slice(at, at + needle.length)) {
      if (offset.start === offset.end) continue
      const last = parts[parts.length - 1]
      if (last?.item === offset.item) last.end = offset.end
      else parts.push({ ...offset })
    }
    const previous = matches[matches.length - 1]?.parts
    // A compatibility ligature may expand into multiple identical matches at
    // the same original glyph; do not draw overlapping copies of that glyph.
    if (parts.length && !(previous && JSON.stringify(previous) === JSON.stringify(parts))) matches.push({ page, parts })
  }
  return matches
}
