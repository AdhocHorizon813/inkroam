import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import postcss from 'postcss'

/* 滚动时导航只允许「变宽」：吸顶位置（.site-header 的 top）必须等于静止位置
   （.site-shell 的 padding-top）。两者写在不同的媒体块里，任何一边单独改动，
   导航都会在页面一开始滚动时额外向上顶一段（非桌面尺寸尤其明显）。
   这里不跑浏览器：把媒体查询按真实视口样例展开，逐个语境比对两处取值。 */

const css = postcss.parse(readFileSync('app/assets/css/main.css', 'utf8'))
const rules = []
css.walkRules(rule => {
  const chain = []
  for (let parent = rule.parent; parent; parent = parent.parent) {
    if (parent.type === 'atrule' && parent.name === 'media') chain.unshift(parent.params)
  }
  const decls = new Map(rule.nodes.filter(node => node.type === 'decl').map(node => [node.prop, node.value]))
  rules.push({ selector: rule.selector, chain, decls })
})

const SHELL = rules.filter(r => r.selector.includes(":root[data-visual='modern']") && r.selector.includes('.site-shell') && r.decls.has('padding-top'))
const HEADER = rules.filter(r => r.selector.includes(":root[data-visual='modern']") && r.selector.includes('.site-header') && r.decls.has('top'))
assert(SHELL.length && HEADER.length, '仍是现代外观的 shell/header 结构')

const px = (value, where) => {
  const match = /^(\d+(?:\.\d+)?)px$/.exec(value)
  assert(match, `${where} 只能用像素值参与比对，收到 ${value}`)
  return Number(match[1])
}

/* 只实现这份样式表实际用到的媒体特性；一旦有人给相关规则加上没实现的条件，
   这里直接报错，避免「求值不了就当不匹配」把门禁变成空转。 */
function clauseMatches(clause, vp) {
  const pair = /^\(\s*([a-z-]+)\s*:\s*(.+?)\s*\)$/.exec(clause)
  assert(pair, `无法求值的媒体条件：${clause}（请扩展 check-nav-sticky-offset 的求值器）`)
  const [, name, rawValue] = pair
  if (name.endsWith('aspect-ratio')) {
    const ratio = /^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/.exec(rawValue)
    assert(ratio, `宽高比写法不认识：${clause}`)
    const actual = vp.width / vp.height
    const target = Number(ratio[1]) / Number(ratio[2])
    if (name === 'min-aspect-ratio') return actual >= target
    if (name === 'max-aspect-ratio') return actual <= target
    return Math.abs(actual - target) < 0.001
  }
  const value = px(rawValue, `${clause} 的取值`)
  if (name === 'min-width') return vp.width >= value
  if (name === 'max-width') return vp.width <= value
  if (name === 'min-height') return vp.height >= value
  if (name === 'max-height') return vp.height <= value
  if (name === 'width') return vp.width === value
  if (name === 'height') return vp.height === value
  throw new Error(`无法求值的媒体特性：${name}（请扩展 check-nav-sticky-offset 的求值器）`)
}
const queryMatches = (query, vp) => query.split(/\band\b/i).every(clause => clauseMatches(clause.trim(), vp))

/* 样例覆盖这份样式表区分开的所有语境：桌面横屏三档、平板竖屏、手机竖屏、手机横屏。 */
const VIEWPORTS = [
  [1440, 1000], [1920, 1080], [1280, 800], [1024, 768], [1024, 600], [1080, 720],
  [1200, 1300], [1024, 1200], [900, 800], [820, 1180], [768, 1024], [768, 600],
  [767, 1024], [700, 900], [480, 800], [390, 844], [360, 640], [740, 360], [640, 360],
]
for (const [width, height] of VIEWPORTS) {
  const vp = { width, height }
  const resolve = list => list.filter(rule => rule.chain.every(query => queryMatches(query, vp))).at(-1)
  const shell = resolve(SHELL)
  const header = resolve(HEADER)
  assert(shell && header, `${width}×${height} 找不到 shell/header 的粘贴偏移`)
  const rest = px(shell.decls.get('padding-top'), `shell padding-top (${width}×${height})`)
  const stuck = px(header.decls.get('top'), `header top (${width}×${height})`)
  assert.equal(
    stuck, rest,
    `${width}×${height}：吸顶 top=${stuck}px 与静止 padding-top=${rest}px 不等，滚动时导航会额外向上位移 ${rest - stuck}px`,
  )
}

/* 滚动态只写横向：一旦有人在这里顺手加了 top/height/padding，就会重新引入位移或抖动。 */
const scrolled = rules.filter(r => r.selector.includes("[data-scrolled='true']") && r.selector.includes('.site-header'))
assert(scrolled.length, '滚动变宽的规则还在')
const HORIZONTAL = new Set(['margin-inline', 'margin-left', 'margin-right', 'margin-inline-start', 'margin-inline-end', 'width', 'max-width', 'inline-size', 'max-inline-size', 'padding-inline', 'padding-inline-start', 'padding-inline-end', 'border-radius'])
for (const rule of scrolled) {
  for (const prop of rule.decls.keys()) {
    assert(HORIZONTAL.has(prop), `滚动态 .site-header 不该写 ${prop}：滚动只允许横向拉伸`)
  }
}

console.log(`PASS: sticky nav settles where it rests — ${VIEWPORTS.length} sampled viewports pair shell padding-top with header top, and scrolling only stretches the bar horizontally.`)
