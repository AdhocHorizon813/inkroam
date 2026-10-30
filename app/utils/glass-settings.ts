// Independent optical preferences. Existing material recipes remain authoritative.
export const GLASS_GROUPS = [
  { id: 'navbar', label: '导航栏', material: 'navMaterial', owner: '导航材质' },
  { id: 'content', label: '正文与首页卡片', material: 'material', owner: '内容材质' },
  { id: 'appearance', label: '阅读外观面板', material: 'navMaterial', owner: '导航材质' },
  { id: 'music', label: '音乐面板', material: 'musicMaterial', owner: '音乐材质' },
  { id: 'tools', label: '正文工具', material: 'dropdownMaterial', owner: '下拉材质' },
  { id: 'dropdown', label: '下拉菜单与日历', material: 'dropdownMaterial', owner: '下拉材质' },
  { id: 'confirm', label: '确认弹窗', material: 'navMaterial', owner: '导航材质' },
  { id: 'toolbar', label: 'PDF 工具栏', material: 'material', owner: '内容材质' },
  { id: 'button', label: '图片查看按钮', material: 'navMaterial', owner: '导航材质' },
  { id: 'dock', label: '底部音乐与显示入口', material: '', owner: '分别跟随音乐、导航材质' },
  { id: 'indicator', label: '滑动指示器', material: '', owner: '跟随所在组件的材质' },
  { id: 'thumb', label: '滑条玻璃滑块', material: '', owner: '跟随所在组件的材质' },
] as const
export type GlassGroup = typeof GLASS_GROUPS[number]['id']
export interface GlassPreference {
  enabled: boolean
  clarity: number
  antialias: boolean
  aaScale: number
  resolution: number // 0 = device DPR (bounded); otherwise pixels per CSS pixel
  pixelBudget: number // millions of map pixels per surface, including AA
  maxSide: number
  maxFps: number // 0 keeps the browser's animation cadence
  settleDelay: number // reuse the previous map until shape settles (ms)
  deform: boolean
}
export type GlassPreferences = Record<GlassGroup, GlassPreference>
export interface GlassGlobalOverride { enabled: boolean; settings: GlassPreference }
export function normalizeGlassGlobal(raw?: unknown): GlassGlobalOverride {
  const value = raw && typeof raw === 'object' ? raw as Partial<GlassGlobalOverride> : {}
  return { enabled: value.enabled === true, settings: normalizeGlassPreferences({ navbar: value.settings }).navbar }
}
const bounded = (value: unknown, min: number, max: number, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback
export function normalizeGlassPreferences(raw?: unknown, clarity = 86, antialias = false): GlassPreferences {
  const source = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}
  return Object.fromEntries(GLASS_GROUPS.map(({ id }) => {
    const item = source[id]
    const p = item && typeof item === 'object' ? item as Partial<GlassPreference> : {}
    return [id, {
      enabled: p.enabled !== false,
      clarity: bounded(p.clarity, 0, 100, bounded(clarity, 0, 100, 86)),
      antialias: typeof p.antialias === 'boolean' ? p.antialias : antialias,
      aaScale: [1, 1.5, 2].includes(p.aaScale!) ? p.aaScale! : 1,
      resolution: [0, .25, .5, .75, 1, 1.5, 2].includes(p.resolution!) ? p.resolution! : 0,
      pixelBudget: [.5, 1.5, 3].includes(p.pixelBudget!) ? p.pixelBudget! : 1.5,
      maxSide: [1024, 2048, 4096].includes(p.maxSide!) ? p.maxSide! : 4096,
      maxFps: [0, 15, 30, 60].includes(p.maxFps!) ? p.maxFps! : 0,
      settleDelay: [0, 80, 160].includes(p.settleDelay!) ? p.settleDelay! : 0,
      deform: p.deform !== false,
    }]
  })) as GlassPreferences
}

export function glassGroup(host: HTMLElement): GlassGroup {
  const module = host.dataset.glassModule
  if (GLASS_GROUPS.some(g => g.id === module)) return module as GlassGroup
  if (host.matches?.('.hero, .latest-section, .manifesto, .standard-page, .article-page')) return 'content'
  return 'dock'
}

export function glassMaterialKey(host: HTMLElement): string {
  const group = glassGroup(host)
  const own = GLASS_GROUPS.find(g => g.id === group)!.material
  if (own) return own
  // Resolve from the original host, never its portaled optical layer.
  if (host.closest?.('.music-panel, .music-pill')) return 'musicMaterial'
  if (host.closest?.('.dropdown-surface, .article-tools')) return 'dropdownMaterial'
  if (host.closest?.('.pdf-reader')) return 'material'
  return 'navMaterial'
}

let cachedText: string | undefined, cached: GlassPreferences | undefined
export function readGlassPreferences(data: DOMStringMap): GlassPreferences {
  const text = data.glassComponents
  if (cached && text !== undefined && text === cachedText) return cached
  let raw: unknown
  try { raw = text ? JSON.parse(text) : undefined } catch { /* Broken storage keeps safe defaults. */ }
  const result = normalizeGlassPreferences(raw, Number(data.glassClarity ?? 86), data.glassAntialias === 'on')
  cachedText = text; cached = result
  return result
}
export function glassSurfaceEnabled(host: HTMLElement, data: DOMStringMap): boolean {
  return data[glassMaterialKey(host)] === 'liquid' && effectiveGlassPreference(host, data).enabled
}

let globalText: string | undefined, globalCache: GlassGlobalOverride | undefined
export function effectiveGlassPreference(host: HTMLElement, data: DOMStringMap): GlassPreference {
  if (!globalCache || data.glassGlobal !== globalText) {
    let raw: unknown
    try { raw = JSON.parse(data.glassGlobal || 'null') } catch { /* Ignore malformed preferences. */ }
    globalCache = normalizeGlassGlobal(raw)
    globalText = data.glassGlobal
  }
  return globalCache.enabled ? globalCache.settings : readGlassPreferences(data)[glassGroup(host)]
}

