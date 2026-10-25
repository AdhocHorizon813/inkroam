import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse, compileStyle } from '@vue/compiler-sfc'
import postcss from 'postcss'
import { animateArticleTool } from '../app/utils/article-tool-motion.ts'

// Compile the real SFC. Inspecting the source selector alone misses Vue's
// :global transform, which can discard a suffix and leak styles onto :root.
const filename = 'app/components/ArticleTools.vue'
const { descriptor } = parse(readFileSync(filename, 'utf8'))
let noHighlight = false, noInset = false, noDepthHighlight = false
for (const style of descriptor.styles) {
  const compiled = compileStyle({ source: style.content, filename, id: 'data-v-tools-check', scoped: style.scoped })
  assert.deepEqual(compiled.errors, [])
  postcss.parse(compiled.code).walkRules(rule => {
    for (const selector of rule.selectors) {
      if (!selector.includes(':root')) continue
      assert(selector.includes('.article-tools .dropdown-surface'), `Unexpected global root rule: ${selector}`)
    }
    if (rule.selector.includes('.dropdown-surface::before')) rule.walkDecls('content', decl => { noHighlight ||= decl.value === 'none' })
    if (rule.selector.includes(':root') && !rule.selector.includes('::before')) rule.walkDecls('box-shadow', decl => { noInset ||= decl.value === 'none' })
    if (rule.selector === ":root[data-visual='modern'][data-depth] .article-tools .dropdown-surface") {
      rule.walkDecls('background-image', decl => { noDepthHighlight ||= decl.value === 'none' })
    }
  })
}
assert(noHighlight && noInset, 'Tools and their nested dropdown omit faux highlights')
assert(noDepthHighlight, 'Depth mode radial highlights must also be removed for every material')
assert.equal((descriptor.template.content.match(/class="[^"]*article-tools__panel[^"\n]*dropdown-surface/g) || []).length, 2, 'Both panels use the shared dropdown material')
const main = readFileSync('app/assets/css/main.css', 'utf8')
assert.match(main, /\.dropdown-surface\s*\{[^}]*backdrop-filter:\s*blur\(var\(--dropdown-blur\)\)/)
assert.match(descriptor.template.content, /:css="false"/)
assert.match(descriptor.template.content, /@leave="leavePanel"/)
// The tool row paints one sliding block (the navbar recipe) instead of giving
// every button its own background: hovering an inactive tool only brightens its
// text, and switching moves/resizes the block on the settle curve.
const styleText = descriptor.styles.map(style => style.content).join('\n')
assert.match(descriptor.template.content, /class="article-tools__indicator"/, 'The row owns one sliding indicator')
assert.match(descriptor.template.content, /'is-ready': indicator\.ready && mode !== null/, 'The block stays hidden until it is measured and active')
assert.match(styleText, /\.article-tools__indicator \{[^}]*background: var\(--line\)/, 'The block keeps the existing visual weight')
assert.match(styleText, /\.article-tools__indicator \{[^}]*border-radius: 11px/, 'The block radius stays concentric: the row radius 12px minus its 1px border')
assert.match(styleText, /\.article-tools__indicator\.is-sliding \{[^}]*transition: width 380ms var\(--ease-settle\), transform 380ms var\(--ease-settle\)/, 'The block moves with the navbar settle curve')
assert.ok(!/\.article-tools__indicator \{[^}]*transition: [^;]*transform/.test(styleText), 'The first placement must not animate its own geometry')
assert.match(descriptor.template.content, /'is-sliding': indicator\.sliding/, 'Sliding unlocks only after the first painted placement')
assert.match(styleText, /\.article-action\[aria-expanded='true'\] \{ color: var\(--accent\); \}/, 'The active tool changes text colour only')
assert.match(styleText, /\.article-action:hover:not\(\[aria-expanded='true'\]\) \{ color: var\(--ink\); \}/, 'Hovering an inactive tool must not paint a block')
assert.ok(!/\.article-action:hover[^{]*\{[^}]*background/.test(styleText), 'No hover background on tool buttons')
assert.match(descriptor.scriptSetup.content, /new ResizeObserver\(\(\) => positionIndicator\(\)\)/, 'The block re-measures when the row resizes')
assert.match(descriptor.scriptSetup.content, /indicator\.x = active\.offsetLeft/, 'Geometry comes from integer layout offsets, not fractional rects')
assert.match(main, /\[data-color-mode='light'\] \.article-tools__actions \.article-tools__indicator[\s\S]{0,300}?color-mix\(in srgb, var\(--accent\) 12%, transparent\)/, 'Light mode keeps the selected block legible')
let keyframes, options, finish, completions = 0
const element = {
  ownerDocument: { defaultView: {
    matchMedia: () => ({ matches: false }),
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
  } },
  animate: (frames, config) => {
    keyframes = frames; options = config
    return { finished: new Promise(resolve => { finish = resolve }), cancel() {} }
  },
}
animateArticleTool(element, true, () => completions++)
assert.deepEqual(keyframes, [{ gridTemplateRows: '0fr' }, { gridTemplateRows: '1fr' }], 'Reveal the clipping window without an ancestor opacity/filter/transform')
assert.equal(options.duration, 360)
finish(); await Promise.resolve(); assert.equal(completions, 1)
const cancel = animateArticleTool(element, false, () => completions++)
assert.deepEqual(keyframes, [{ gridTemplateRows: '1fr' }, { gridTemplateRows: '0fr' }])
assert.equal(options.duration, 180)
cancel(); finish(); await Promise.resolve(); assert.equal(completions, 1, 'Cancelled transitions must not finish an old Vue hook')
element.ownerDocument.defaultView.matchMedia = () => ({ matches: true })
animateArticleTool(element, true, () => completions++)
assert.equal(completions, 2)
console.log('PASS: scoped root safety, shared dropdown material, grid reveal/collapse, cancellation and reduced motion without opacity animation.')
