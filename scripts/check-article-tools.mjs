import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse, compileStyle } from '@vue/compiler-sfc'
import postcss from 'postcss'

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
console.log('PASS: scoped root safety, shared dropdown blur/material for both tools, no faux highlights and retained JS transition hooks.')
