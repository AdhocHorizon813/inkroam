import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import postcss from 'postcss'

const css = postcss.parse(readFileSync('app/assets/css/depth.css', 'utf8'))
css.walkRules(rule => {
  assert(rule.selector.includes("[data-depth='soft']") || rule.selector.includes("[data-depth='defined']"), 'Every rule must opt in')
  assert(rule.selector.includes("[data-visual='modern']"), 'Classic design remains unchanged')
  /* Reading surfaces may only receive a static cast shadow (a card's elevation is fixed
     geometry, so it belongs on the card). Every other optical effect stays banned there. */
  const readingSurface = /\.article-page|\.hero|\.latest-section|\.standard-page/.test(rule.selector)
  if (readingSurface) assert(rule.nodes.every(d => d.type !== 'decl' || d.prop === 'box-shadow' || d.prop.startsWith('--depth-')), 'Reading surfaces may only receive a static box-shadow')
  rule.walkDecls(decl => {
    const allowed = rule.selector.includes('::after')
      ? ['content', 'position', 'inset', 'padding', 'border-radius', 'pointer-events', 'background', 'mask', 'mask-composite', 'opacity', 'transition', 'box-shadow']
      : readingSurface ? ['box-shadow']
        : ['background-image', 'overflow', 'text-shadow', 'filter', 'position']
    assert(decl.prop.startsWith('--depth-') || allowed.includes(decl.prop), 'Do not override original shadows, layout or material filters: ' + decl.prop)
    assert(!decl.important)
    if (decl.prop === 'filter') assert(rule.selector.endsWith('.site-header .nav-search svg') && decl.value.startsWith('drop-shadow('), 'Only the small icon may use silhouette filtering')
    if (decl.prop === 'box-shadow') assert(rule.selector.endsWith('.site-header .brand-mark::after') || rule.selector.endsWith('.site-header::after') || readingSurface, 'Shadow only on navigation decorations and the static card elevation')
    if (decl.prop === 'text-shadow') assert(rule.selector.includes('.site-header :is(.brand > span:last-child, .main-nav > a:not(.nav-search))'), 'Only navigation glyphs project light')
    if (decl.prop === 'overflow') assert(rule.selector.endsWith('.site-header') && decl.value === 'visible')
    if (decl.prop === 'position' && !rule.selector.includes('::after')) assert(rule.selector.endsWith('.brand-mark') && decl.value === 'relative')
    if (decl.prop === '--depth-rim-width') assert.equal(decl.value, '1px', 'No thick plastic rim')
    if (decl.prop === '--depth-rim-opacity') assert(Number(decl.value) <= .42)
  })
})
const optical = css.nodes.find(node => node.name === 'supports').nodes[0]
assert(optical.nodes.some(d => d.prop === 'pointer-events' && d.value === 'none'))
assert(optical.nodes.some(d => d.prop === 'mask-composite' && d.value === 'exclude'), 'Keep light hollow, not over text')
assert(css.nodes.some(node => node.name === 'media' && node.params.includes('prefers-reduced-motion')))
const panel = readFileSync('app/components/AppearancePanel.vue', 'utf8')
assert.match(panel, /<fieldset class="setting-group">\s*<legend class="setting-label">层次感<\/legend>/)
assert.match(readFileSync('nuxt.config.ts', 'utf8'), /main\.css', '~\/assets\/css\/depth\.css'/)
const glass = css.nodes.find(rule => rule.selector?.endsWith(' .site-header::after') && !rule.selector.includes("data-scrolled='true'"))
assert(glass.nodes.some(d => d.prop === 'box-shadow' && d.value.includes('--depth-glass-light')), 'Glass adds a restrained diffuse surface cue')
assert(glass.nodes.some(d => d.prop === 'pointer-events' && d.value === 'none'))
const glassBackground = glass.nodes.find(d => d.prop === 'background')
if (glassBackground) {
  assert(/^linear-gradient\(/.test(glassBackground.value), 'Surface variation must be a gradient, never a flat fill')
  const alphas = [...glassBackground.value.matchAll(/\/\s*([\d.]+)\s*\)/g)].map(m => Number(m[1]))
  assert(alphas.length >= 2 && Math.max(...alphas) <= .03, 'Surface gradient stays under 3% so it never becomes a luminous slab')
  assert(!glassBackground.value.includes('--modern-accent'), 'Accent never drives the glass surface (guideline: Tint, not Emission)')
}
assert(!glass.nodes.some(d => ['opacity', 'filter'].includes(d.prop)), 'No faded or filtered navigation surface')
const declarations = []
css.walkDecls(decl => declarations.push(decl))
assert(declarations.some(d => d.prop === 'text-shadow' && d.value.includes('currentColor') && d.value.includes('--depth-project-y')), 'Project actual glyph colors at an offset')
assert(declarations.some(d => d.prop === 'box-shadow' && d.value.includes('--modern-accent')), 'Colored mark transmits accent-colored light')
assert(css.nodes.some(n => n.name === 'media' && n.params.includes('767.98px')), 'Shorter mobile projection')
const glassShadow = glass.nodes.find(d => d.prop === 'box-shadow')
const glassLayers = glassShadow.value.split(',')
assert(!glassLayers.some(layer => !layer.includes('inset') && /(?:^|\s)0 0 \d+px/.test(layer)), 'No halo hugs the outline: the bar must not glow at its rim (guideline section 9)')
assert(glassLayers.some(layer => layer.includes('inset 0 1px 0') && layer.includes('--depth-glass-top')), 'Depth reads from a top edge highlight, not a full bright ring (guideline 11/12)')
const interiorLayers = glassLayers.filter(layer => layer.includes('--depth-glass-glow-inner'))
assert(interiorLayers.length >= 1, 'The glass surface itself carries light in dark mode')
assert(interiorLayers.length <= 2, 'No more than two interior layers: one even wash, optionally one second')
for (const layer of interiorLayers) {
  const spread = Number(layer.match(/(-?\d+(?:\.\d+)?)px\s+var\(--depth-glass-glow-inner\)/)?.[1] ?? -99)
  assert(spread >= -8, 'The surface light must cover the interior, not just hug the rim with a large negative spread')
  assert(/\binset 0 0 /.test(layer), 'The surface light must be even: no vertical offset, no top-heavy fake highlight')
}
const topLayers = glassLayers.filter(layer => layer.includes('--depth-glass-top'))
assert(topLayers.length === 1 && /inset 0 1px 0/.test(topLayers[0]), 'Exactly one 1px top edge highlight, never a bright ring')
for (const d of declarations.filter(d => d.prop === '--depth-glass-band-blur')) {
  const blur = Number.parseFloat(d.value)
  assert(blur >= 16 && blur <= 64, 'Band blur stays defined (16-64px): a huge faint tail collapses into 8-bit platforms and reads as horizontal bands')
}
const innerGlow = declarations.filter(d => d.prop === '--depth-glass-glow-inner')
for (const d of innerGlow) {
  if (d.value === 'transparent') continue
  assert(Number(d.value.match(/\/\s*([\d.]+)\s*\)/)?.[1] ?? 1) <= .25, 'The inner glow stays a faint surface light, never a filled slab')
  assert(d.parent.selector.includes("[data-color-mode='dark']"), 'Surface light is dark-scoped')
}
/* 2026-10-05：用户要求“向下投射的光条配得上现在的自发光”，两轮加强后定为
   深色 alpha ≥ 内部受光，且光条的几何由 --depth-glass-band-* 单独控制（浅色保持细窄）。 */
const alphaOf = value => Number(value.match(/\/\s*([\d.]+)\s*\)/)?.[1] ?? 0)
const darkInner = innerGlow.find(d => d.parent.selector.includes("[data-color-mode='dark']") && !d.parent.selector.includes('data-scrolled'))
const darkBand = declarations.find(d => d.prop === '--depth-glass-light' && !d.parent.selector.includes('data-color-mode'))
if (darkInner && darkBand) assert(alphaOf(darkBand.value) >= alphaOf(darkInner.value), 'The downward light band must be at least as strong as the lit glass surface')
/* 浅色是遮挡影，2026-10-05 同样加强（.065/.095→.11/.15），但仍须弱于深色的光条，两档才能区分。 */
const lightBand = declarations.find(d => d.prop === '--depth-glass-light' && d.parent.selector.includes("[data-color-mode='light']"))
if (darkBand && lightBand) assert(alphaOf(lightBand.value) < alphaOf(darkBand.value), 'The light-mode occlusion stays weaker than the dark light band')
/* 2026-10-05 Scrolled（tmp/inkroam-dark-navbar-scrolled-layer-tuning.md）：面越大单位面积光效越弱。
   但不能靠逐帧插值那三层大模糊阴影——那会整屏重绘、肉眼可见卡顿（用户："动画太卡了"）；
   改为整片装饰用 compositor 友好的 opacity 淡出，并与 Navbar 宽度变化同相。 */
const baseTransition = glass.nodes.find(d => d.prop === 'transition')
assert(baseTransition && /^opacity /.test(baseTransition.value.trim()) && !/box-shadow|background/.test(baseTransition.value), 'Only composited opacity may transition on the glass, never the big blurred shadows')
const scrolledFade = css.nodes.find(rule => rule.selector?.includes("[data-scrolled='true']") && rule.selector.endsWith('.site-header::after'))
assert(scrolledFade, 'The scrolled state weakens the decoration by fading it')
const fadeOpacity = scrolledFade.nodes.find(d => d.prop === 'opacity')
assert(fadeOpacity && Number(fadeOpacity.value) >= .4 && Number(fadeOpacity.value) <= .9, 'Scrolled fades to 40-90%: weaker per area, still visible')
const fadeTransition = scrolledFade.nodes.find(d => d.prop === 'transition')
assert(fadeTransition && /opacity 320ms cubic-bezier\(\.22, \.8, \.3, 1\)/.test(fadeTransition.value), 'Expand fade leads the widening: opacity 320ms cubic-bezier(.22, .8, .3, 1)')
/* 用户要求两个方向非对称：收起方向走基础规则那条更平滑、更慢的曲线，避免弹回。 */
assert(baseTransition.value.includes('520ms'), 'Collapse fade settles gently: 520ms smooth curve on the base rule')
/* A/B test B（tmp/deepseek-dark-navbar-scrolled-final-ab.md）：只降 Scrolled 的外部环境光（下方那道光），
   本体受光/顶部高光/几何不变；静止态仍是基准值，所以 scrolled 必须严格低于静止态。 */
const scrolledBand = declarations.find(d => d.prop === '--depth-glass-light' && d.parent.selector.includes("data-scrolled='true'") && d.parent.selector.includes("[data-color-mode='dark']"))
assert(scrolledBand && darkBand && alphaOf(scrolledBand.value) < alphaOf(darkBand.value), 'Scrolled ambient stays below rest: the only knob that touches the outer light')
assert(declarations.some(d => d.prop === '--depth-glass-band-y') && declarations.some(d => d.prop === '--depth-glass-band-spread'), 'The band geometry stays explicit so light mode keeps its narrow occlusion')
const glow = declarations.filter(d => ['--depth-glass-top', '--depth-glass-glow-inner', '--depth-element-glow'].includes(d.prop))
assert(glow.some(d => d.value === 'transparent'), 'Light mode keeps the glass self-emission transparent')
assert(glow.some(d => d.value === '0%'), 'Light mode keeps element self-emission off')
assert(glow.some(d => d.parent.selector.includes("[data-color-mode='dark']")), 'Self-emission is dark-scoped only')
assert(declarations.some(d => d.prop === 'text-shadow' && d.value.includes('--depth-element-glow')), 'Navigation glyphs also emit a zero-offset halo')
/* 2026-10-05：用户“看不清浅色的彩色玻璃效果” —— 彩色透光不得再退回发丝级。 */
for (const d of declarations.filter(d => d.prop === '--depth-project-tint')) {
  const value = Number.parseFloat(d.value)
  assert(Number.isFinite(value), 'Accent transmission stays a percentage')
  assert(d.parent.selector.includes("[data-color-mode='light']") ? value >= 15 : value > 0, 'Light-mode accent transmission must stay visible (>= 15%)')
}
/* 2026-10-05：用户要求深色下元素向下投射更强 —— 深色值必须严格大于浅色值，浅色组不得被顺带改强。 */
const strengthByMode = mode => declarations
  .filter(d => d.prop === '--depth-project-strength' && (mode === 'dark' ? !d.parent.selector.includes('data-color-mode') : d.parent.selector.includes("[data-color-mode='light']")))
  .map(d => Number.parseFloat(d.value))
  .sort((a, b) => a - b)
const darkStrength = strengthByMode('dark')
const lightStrength = strengthByMode('light')
assert(darkStrength.length === lightStrength.length && darkStrength.every((v, i) => v > lightStrength[i]), 'Dark element projection stays stronger than the light-mode occlusion')
console.log('PASS: opt-in glass and element lighting; original surface shadows/hit geometry preserved; no luminous slab; the surface carries the light under a top edge highlight instead of a rim halo; no faint wide tail; dark self-emission is dark-scoped and stronger than light mode; mobile range bounded.')
