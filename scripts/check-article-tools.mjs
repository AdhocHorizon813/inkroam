import { vmSource } from './lib/vm-source.mjs'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { parse, compileStyle } from '@vue/compiler-sfc'
import postcss from 'postcss'
import { animateArticleTool } from '../app/utils/article-tool-motion.ts'

// Compile the real SFC. Inspecting the source selector alone misses Vue's
// :global transform, which can discard a suffix and leak styles onto :root.
const filename = 'app/components/ArticleTools.vue'
const { descriptor } = parse(readFileSync(filename, 'utf8'))
let noHighlight = false, noInset = false, noDepthHighlight = false
let hoverColorRules = 0, unconditionalSelectionColor = false
for (const style of descriptor.styles) {
  const compiled = compileStyle({ source: style.content, filename, id: 'data-v-tools-check', scoped: style.scoped })
  assert.deepEqual(compiled.errors, [])
  postcss.parse(compiled.code).walkRules(rule => {
    rule.walkDecls('color', decl => {
      if (rule.selector.includes(':hover')) {
        hoverColorRules++
        const media = []
        let parent = rule.parent
        while (parent) {
          if (parent.type === 'atrule' && parent.name === 'media') media.push(parent.params)
          parent = parent.parent
        }
        assert(media.some(query => /hover\s*:\s*hover/.test(query) && /pointer\s*:\s*fine/.test(query)),
          'Hover colours must not apply to primary touch input')
        for (const selector of rule.selectors) assert.match(selector,
          /:not\(\[data-pointer-type=['"]touch['"]\]\)/,
          'Actual touch input must also suppress sticky hover on hybrid devices')
      } else if (rule.selector.includes("[aria-expanded='true']") && decl.value === 'var(--accent)') {
        let parent = rule.parent, gated = false
        while (parent) { gated ||= parent.type === 'atrule'; parent = parent.parent }
        unconditionalSelectionColor ||= !gated
      }
    })
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
assert(hoverColorRules > 0, 'Genuine mouse hover remains available')
assert(unconditionalSelectionColor, 'Selected tool colours must remain available to touch and keyboard users')
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
const copyTemplate = parse(readFileSync('app/components/CopyArticleLink.vue', 'utf8')).descriptor.template.content
assert.match(copyTemplate, /:class="feedback \? 'article-copy-action' : 'text-link'"/, 'Inline Copy is separate from the panel triggers')
for (const style of descriptor.styles) postcss.parse(style.content).walkRules(rule => {
  if (!rule.selector.includes('.article-copy-action') || !rule.selector.includes(':active')) return
  rule.walkDecls('transform', () => assert.fail('Copy must not inherit the panel triggers’ pressed motion'))
})
assert.match(descriptor.template.content, /class="article-tools__indicator"/, 'The row owns one sliding indicator')
assert.match(descriptor.template.content, /'is-ready': indicator\.ready && mode !== null/, 'The block stays hidden until it is measured and active')
assert.match(styleText, /\.article-tools__indicator \{[^}]*background: var\(--line\)/, 'The block keeps the existing visual weight')
assert.match(styleText, /\.article-tools__indicator \{[^}]*border-radius: 11px/, 'The block radius stays concentric: the row radius 12px minus its 1px border')
assert.match(styleText, /\.article-tools__indicator\.is-sliding \{[^}]*transition: width 380ms var\(--ease-settle\), transform 380ms var\(--ease-settle\)/, 'The block moves with the navbar settle curve')
assert.ok(!/\.article-tools__indicator \{[^}]*transition: [^;]*transform/.test(styleText), 'The first placement must not animate its own geometry')
assert.match(descriptor.template.content, /'is-sliding': indicator\.sliding/, 'Sliding unlocks only after the first painted placement')
// The article indicator is measured and its optical map is decoded while the
// tool row is idle. Its visibility (is-ready) still belongs to the active mode.
assert.match(descriptor.template.content, /v-experimental-glass="indicator\.ready"/,
  'The indicator registers its glass as soon as geometry is available, not on click')
assert.match(descriptor.template.content, /'is-ready': indicator\.ready && mode !== null/,
  'The prewarmed indicator must remain hidden while no tool is selected')
assert.match(descriptor.template.content, /v-experimental-glass="mode !== null" data-glass-module="tools-track"/,
  'Only the selection indicator opts out of lazy initialization')
assert.match(descriptor.template.content, /v-glass-presence="mode === 'find'" v-experimental-glass="mode === 'find'"/,
  'Find panel keeps its existing lifecycle')
assert.match(styleText, /\.article-action\[aria-expanded='true'\] \{ color: var\(--accent\); \}/, 'The active tool changes text colour only')
assert.match(styleText, /\.article-action:hover:not\(\[aria-expanded='true'\]\) \{ color: var\(--ink\); \}/, 'Hovering an inactive tool must not paint a block')
assert.ok(!/\.article-action:hover[^{]*\{[^}]*background/.test(styleText), 'No hover background on tool buttons')
assert.match(descriptor.scriptSetup.content, /new ResizeObserver\(\(\) => positionIndicator\(\)\)/, 'The block re-measures when the row resizes')
assert.match(descriptor.scriptSetup.content, /indicator\.x = active\.offsetLeft/, 'Geometry comes from integer layout offsets, not fractional rects')
assert.match(main, /\[data-color-mode='light'\] \.article-tools__actions \.article-tools__indicator[\s\S]{0,300}?color-mix\(in srgb, var\(--accent\) 12%, transparent\)/, 'Light mode keeps the selected block legible')
// Execute the real input handler and mode changes: a synthetic drag-commit
// click must not replace touch modality, while a real mouse can restore hover.
assert.match(descriptor.template.content, /@pointerdown\.capture="rememberPointer"/)
assert.match(descriptor.template.content, /@pointermove\.capture="rememberPointer"/)
const toolProps = { content: null, title: '', encrypted: false }
const clipboardWrites = []
const toolContext = vm.createContext({
  AbortController,
  defineProps: () => toolProps,
  copyTextOnGesture: async value => { clipboardWrites.push(value) },
  ref: value => ({ value }), reactive: value => value,
  shallowRef: value => ({ value }),
  useRuntimeConfig: () => ({ app: { baseURL: '/' } }),
  watch() {}, onMounted() {}, onBeforeUnmount() {},
  nextTick: () => Promise.resolve(), clearTimeout, setTimeout,
  window: { CSS: { highlights: new Map() } },
})
vm.runInContext(ts.transpile(vmSource(descriptor.scriptSetup.content),
  { target: ts.ScriptTarget.ES2022 }) + '\nglobalThis.toolInput = { pointerType, rememberPointer, toggle, mode, indicator, positionIndicator, actions, trigger, requestExport, confirmExport, cancelExport, pendingExport, exportConfirm, exportStep, exportKey, busy };', toolContext)
const toolInput = toolContext.toolInput
toolInput.actions.value = {}
toolInput.trigger.value = { offsetLeft: 12, offsetWidth: 96, offsetHeight: 40 }
await toolInput.positionIndicator()
assert.equal(toolInput.mode.value, null, 'Prewarming the lens must not open either panel')
assert.equal(toolInput.indicator.ready, true, 'The lens is measured while idle')
assert.equal(toolInput.indicator.x, 12)
assert.equal(toolInput.indicator.width, 96)
assert.equal(toolInput.indicator.height, 40)
assert.equal(toolInput.indicator.sliding, false, 'Idle prewarming must not trigger a slide')
toolInput.rememberPointer({ pointerType: 'touch' })
await toolInput.toggle('find')
await toolInput.toggle('export')
assert.equal(toolInput.mode.value, 'export')
assert.equal(toolInput.pointerType.value, 'touch', 'Touch modality survives the drag-commit click and mode change')
toolInput.rememberPointer({ pointerType: '' })
assert.equal(toolInput.pointerType.value, 'touch', 'Untyped compatibility events cannot reactivate sticky hover')
await toolInput.toggle('find')
assert.equal(toolInput.pointerType.value, 'touch', 'Reverse switching also retains touch modality')
toolInput.rememberPointer({ pointerType: 'mouse' })
assert.equal(toolInput.pointerType.value, 'mouse', 'Real mouse input restores hover after a touch interaction')
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
// A protected export must pause at the warning, then require a fresh key.
toolProps.encrypted = true; toolProps.content = {}
toolInput.exportConfirm.value = { showModal() {}, close() {} }
for (const format of ['pdf', 'png']) {
  toolInput.requestExport(format)
  assert.equal(toolInput.pendingExport.value.format, format)
  assert.equal(toolInput.exportStep.value, 'warning')
  assert.equal(toolInput.busy.value, false, 'No export generation before confirmation')
  await toolInput.confirmExport()
  assert.equal(toolInput.exportStep.value, 'key')
  assert.equal(clipboardWrites.at(-1), ' ', 'Explicit confirmation replaces the clipboard with a space')
  assert.equal(toolInput.busy.value, false, 'Confirmation alone cannot export without key verification')
  toolInput.exportKey.value = 'dummy-unsubmitted-key'
  toolInput.cancelExport()
  assert.equal(toolInput.pendingExport.value, null)
  assert.equal(toolInput.exportKey.value, '', 'Cancellation clears the entered key')
}
console.log('PASS: tool styles, motion, cancellation, protected export warning and fresh-key gate.')

