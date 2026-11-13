// Shared by the wheel and its editor. Slot order is clockwise from twelve o'clock.
export const RADIAL_ACTIONS = [
  { id: 'appearance', label: '阅读外观', path: 'M5 4v16M12 4v16M19 4v16M2 8h6M9 16h6M16 10h6' },
  { id: 'find', label: '页内查找', path: 'M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Zm-2 5 6 6' },
  { id: 'sidebar', label: '阅读目录', path: 'M4 4h16v16H4ZM9 4v16M12 8h5M12 12h5M12 16h5' },
  { id: 'focus', label: '专注模式', path: 'M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5' },
  { id: 'music', label: '音乐', path: 'M9 18V5l11-2v13M9 8l11-2M9 18a3 2 0 1 1-6 0 3 2 0 0 1 6 0Zm11-2a3 2 0 1 1-6 0 3 2 0 0 1 6 0Z' },
  // Same centered arcs as CopyArticleLink; leave room for the stroke at the left edge.
  { id: 'copy', label: '复制链接', path: 'm11.5 13 4-4m-6 6-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 3 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0' },
  { id: 'export', label: '导出正文', path: 'M12 3v12m-4-4 4 4 4-4M5 16v4h14v-4' },
  { id: 'search', label: '全站搜索', path: 'M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Zm-2 5 6 6M6 10h7M9.5 6.5v7' },
  { id: 'top', label: '回到顶部', path: 'M5 4h14M12 21V8m-5 5 5-5 5 5' },
  { id: 'none', label: '留空', path: '' },
] as const
export const defaultRadialSlots = () => ['appearance', 'find', 'sidebar', 'focus', 'music', 'copy']
export function normalizeRadialSlots(raw: unknown): string[] {
  const defaults = defaultRadialSlots()
  return defaults.map((fallback, index) => Array.isArray(raw) && RADIAL_ACTIONS.some(action => action.id === raw[index]) ? raw[index] : fallback)
}
