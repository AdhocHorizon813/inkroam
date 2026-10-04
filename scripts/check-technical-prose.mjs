import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import postcss from 'postcss'
import vm from 'node:vm'
import ts from 'typescript'
import { ref, computed } from 'vue'
const component = readFileSync('app/components/content/ArticleCode.vue', 'utf8')
/* 图标保持原来的 out-in 交换；文字状态（复制代码/已复制/请手动复制）自己做上下换位。 */
assert.match(component, /<Transition name="code-icon" mode="out-in">/)
assert.match(component, /<Transition name="code-label">/)
assert.match(component, /class="article-code-state" aria-live="polite"/)
assert.match(component, /article-code-sun/)
assert.match(component, /article-code-moon/)
const script = component.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1]
function makeCode(clipboardFails = false) {
  let copied, selected = false, cleanup
  const context = vm.createContext({
    ref, computed, defineProps: () => ({ code: 'int x = 1;\n', language: 'c' }),
    defineAsyncComponent: () => ({}), onBeforeUnmount: fn => { cleanup = fn },
    setTimeout: () => 1, clearTimeout: () => {},
    navigator: { clipboard: { writeText: async text => { if (clipboardFails) throw Error('denied'); copied = text } } },
    document: { documentElement: { dataset: { colorMode: 'dark' } }, createRange: () => ({ selectNodeContents: () => { selected = true } }) },
    window: { getSelection: () => ({ removeAllRanges() {}, addRange() {} }) },
  })
  vm.runInContext(ts.transpile(script, { target: ts.ScriptTarget.ES2022 }) + '\nglobalThis.api = {mode, pre, copyState, toggleTheme, copyCode, languageLabel}', context)
  return { context, api: context.api, copied: () => copied, selected: () => selected, cleanup: () => cleanup() }
}
const block = makeCode()
assert.equal(block.api.languageLabel.value, 'C')
block.api.toggleTheme()
assert.equal(block.api.mode.value, 'light')
block.api.toggleTheme()
assert.equal(block.api.mode.value, 'dark')
assert.equal(block.context.document.documentElement.dataset.colorMode, 'dark')
assert.equal(makeCode().api.mode.value, undefined, 'other blocks keep following site appearance')
await block.api.copyCode()
assert.equal(block.copied(), 'int x = 1;\n')
assert.equal(block.api.copyState.value, '已复制')
block.cleanup()
const fallback = makeCode(true)
fallback.api.pre.value = { focus() {} }
await fallback.api.copyCode()
assert.equal(fallback.selected(), true)
assert.equal(fallback.api.copyState.value, '请手动复制')
fallback.cleanup()
const css = readFileSync('app/assets/css/article-technical.css', 'utf8')
const cssTree = postcss.parse(css)
assert.match(css, /prefers-reduced-motion/)
/* 代码板的模糊与底色都复用「内容」那一套：半径退回内容模糊，密度取内容材质的 alpha。 */
assert.match(css, /blur\(var\(--code-blur, var\(--content-blur, 10px\)\)\)/)
const densities = []
cssTree.walkDecls('--code-opacity', decl => densities.push(parseFloat(decl.value)))
assert.equal(densities.length, 3, '三套代码材质各写一次密度')
for (const density of densities) {
  assert.ok(density <= 70, `代码板必须复用内容材质的半透明密度，不能做成不透明的板：${density}%`)
}
assert.match(css, /data-code-material='acrylic'/)
assert.match(css, /data-code-material='liquid'/)
assert.match(css, /\.article-code-state \{ display: inline-grid; justify-items: center; width: 5em; overflow: hidden; \}/)
assert.match(css, /article-content pre code/)
assert.match(css, /overflow-x: auto/)
assert.match(css, /:root\[data-visual='modern'\] \.article-content pre code/)
assert.match(readFileSync('app/components/ArticleReader.vue', 'utf8'), /pre: ArticleCode, table: ArticleTable/)
const diagram = readFileSync('app/components/content/MermaidDiagram.vue', 'utf8')
assert.match(diagram, /IntersectionObserver/)
/* 图的宽度 = mermaid 原生尺寸 × 阅读设置里的 --diagram-scale，且容器只滚不缩（max-width: none）。
   两条必须同时成立：少了前者「图表尺寸」滑条没有落点，少了后者宽图会被压到看不清。 */
assert.match(diagram, /root\.style\.width = `calc\(\$\{width\}px \* var\(--diagram-scale, 1\)\)`/, 'The SVG width is the native size times the reading preference')
assert.match(diagram, /:deep\(svg\) \{ display: block; width: auto; max-width: none; height: auto; margin-inline: auto; \}/, 'Wide diagrams keep their size and let the container pan')
assert.match(diagram, /appearance\?\.disconnect/)
const utility = readFileSync('app/utils/mermaid.ts', 'utf8')
assert.match(utility, /import\('mermaid'\)/)
assert.match(utility, /securityLevel: 'strict'/)
assert.match(utility, /htmlLabels: false/)
const files = readdirSync('content/notes/data-structures').filter(name => name.endsWith('.md')).sort()
assert.equal(files.length, 12)
for (const [order, file] of files.entries()) {
  const text = readFileSync(`content/notes/data-structures/${file}`, 'utf8')
  assert.match(text, new RegExp(`order: ${order}\\r?\\n`))
  assert.match(text, /aiGenerated: true/)
  assert.match(text, /draft: false/)
  if (process.argv.includes('--built')) {
    const html = readFileSync(`.output/public/notes/data-structures/${file.slice(0, -3)}/index.html`, 'utf8')
    assert.match(html, /article-content/)
    if (text.includes('| ---')) assert.match(html, /article-table-scroll/)
    if (text.includes('```c')) {
      assert.match(html, /data-language="c"/)
      assert.match(html, /article-code-toolbar/)
      assert.match(html, /--shiki-default:/)
      assert.match(html, /--shiki-dark:/)
      assert.match(html, /切换此代码块的明暗/)
    }
    if (text.includes('```mermaid')) assert.match(html, /article-diagram/)
  }
}
console.log('PASS: twelve notes and technical-prose contracts' + (process.argv.includes('--built') ? ', SSR table/code/diagram routing' : '') + '. Not browser geometry or SVG rendering.')
