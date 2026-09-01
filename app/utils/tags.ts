export const tagSlugMap: Record<string, string> = {
  '生活方式': 'lifestyle',
  '数字工具': 'digital-tools',
  '独立创作': 'indie-publishing',
  '写作': 'writing',
  '设计': 'design',
  '阅读体验': 'reading',
}

const tagNameMap = Object.fromEntries(
  Object.entries(tagSlugMap).map(([name, slug]) => [slug, name]),
) as Record<string, string>

export const getTagSlug = (name: string) => tagSlugMap[name] || encodeURIComponent(name)
export const getTagName = (slug: string) => tagNameMap[slug] || decodeURIComponent(slug)
