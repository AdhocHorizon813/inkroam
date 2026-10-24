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
