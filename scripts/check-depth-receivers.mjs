import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { parse, compileStyle } from '@vue/compiler-sfc'
import postcss from 'postcss'
import { visibleSurface } from '../app/utils/depth-receivers.ts'

const box = { x: 30, y: 90, width: 800, height: 400, radius: 18 }
assert.deepEqual(visibleSurface(box, 1000, 800), box)
assert.equal(visibleSurface({ ...box, width: 0 }, 1000, 800), null)
assert.equal(visibleSurface({ ...box, x: NaN }, 1000, 800), null)
assert.equal(visibleSurface({ ...box, y: 1000 }, 1000, 800), null)
assert.equal(visibleSurface({ ...box, y: -900, height: 100 }, 1000, 800), null)
assert.equal(visibleSurface({ ...box, radius: 500 }, 1000, 800).radius, 200)
const long = visibleSurface({ ...box, y: -20000, height: 60000 }, 1000, 800)
assert.equal(long.y, -96, 'Do not invent an edge at the top of the viewport')
assert.equal(long.height, 992, 'Bound long-lesson raster bounds to the viewport plus blur margin')

const source = readFileSync('app/components/DepthReceivers.vue', 'utf8')
// Vue :global(root) followed by a descendant can compile to bare root, dropping
// that descendant. Test emitted CSS, not the reassuring-looking SFC source.
const style = parse(source).descriptor.styles[0]
const compiled = compileStyle({ source: style.content, id: 'data-v-depth-test', scoped: true })
assert.equal(compiled.errors.length, 0)
postcss.parse(compiled.code).walkRules(rule => {
  assert(rule.selector.includes('.depth-receivers'), `Projection style escaped to the page: ${rule.selector}`)
  if (rule.selector.includes(':root')) assert.match(rule.selector, /\]\s+\.depth-receivers__/)
  rule.walkDecls(decl => {
    if (decl.prop === 'filter') assert(/\.depth-receivers__(near|far|elevation)/.test(rule.selector), 'Blur only decorative SVG shapes')
  })
})
const script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm, '')
const root = { dataset: { visual: 'modern', depth: 'off' }, clientWidth: 1000 }
const element = initial => ({ reads: 0, box: initial, getBoundingClientRect() { this.reads++; const b = this.box; return { left: b.x, top: b.y, width: b.width, height: b.height } }, parentElement: { closest: () => null } })
const nav = element({ x: 30, y: 18, width: 900, height: 54 })
const card = element(box)
const raf = new Map()
const resizeListeners = new Set()
let nextFrame = 0, mounted, unmounted, settingCallback, scrollCallback, routeCallback
let scrollTop = 0, pageFinish, pageHookStopped = false, scrollReads = 0
const observers = []
class FakeResizeObserver {
  targets = []
  constructor(callback) { this.callback = callback; observers.push(this) }
  observe(target) { this.targets.push(target) }
  disconnect() { this.targets = [] }
}
const context = vm.createContext({
  visibleSurface, console,
  ref: value => ({ value }), shallowRef: value => ({ value }),
  useRoute: () => ({ path: '/' }), useId: () => 'test:1',
  useNuxtApp: () => ({ hook: (name, fn) => { assert.equal(name, 'page:finish'); pageFinish = fn; return () => { pageHookStopped = true } } }),
  pageScrollTop: () => { scrollReads++; return scrollTop },
  onMounted: fn => { mounted = fn }, onBeforeUnmount: fn => { unmounted = fn },
  watch: (_, fn) => { routeCallback = fn }, nextTick: () => Promise.resolve(),
  ResizeObserver: FakeResizeObserver,
  MutationObserver: class { constructor(fn) { settingCallback = fn } observe() {} disconnect() { settingCallback = null } },
  document: { documentElement: root, querySelector: selector => selector === '.site-header' ? nav : null, querySelectorAll: () => [card] },
  window: { innerHeight: 800, addEventListener: (_, fn) => resizeListeners.add(fn), removeEventListener: (_, fn) => resizeListeners.delete(fn) },
  getComputedStyle: () => ({ borderTopLeftRadius: '18px' }),
  requestAnimationFrame: fn => { const id = ++nextFrame; raf.set(id, fn); return id },
  cancelAnimationFrame: id => raf.delete(id),
  onPageScroll: fn => { scrollCallback = fn; return () => { scrollCallback = null } },
})
vm.runInContext(ts.transpileModule(script, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText, context)
function flush() { const callbacks = [...raf.values()]; raf.clear(); callbacks.forEach(fn => fn()) }
mounted()
assert.equal(scrollCallback, undefined, 'Off does not subscribe to scroll')
assert.equal(raf.size, 0)
root.dataset.depth = 'soft'; settingCallback(); flush()
assert.equal(root.dataset.depthReceivers, 'true')
assert.equal(resizeListeners.size, 1)
assert.equal(observers[0].targets.length, 2)
assert.equal(vm.runInContext('viewport.value.height', context), 244, 'Limit masks and output to the navigation light band')
const initialCardReads = card.reads
scrollTop = 20
const beforeScrollReads = scrollReads
scrollCallback(); scrollCallback(); scrollCallback()
assert.equal(scrollReads, beforeScrollReads, 'Scroll callbacks must not synchronously read scroll/layout state')
assert.equal(raf.size, 1, 'Coalesce all scroll sources into one update')
flush()
assert.equal(scrollReads, beforeScrollReads + 1, 'One scroll read per coalesced frame')
assert.equal(vm.runInContext('surfaces.value[0].y', context), 70)
assert.equal(card.reads, initialCardReads, 'Ordinary scroll must not read card layout')
scrollCallback()
const beforeNestedNavReads = nav.reads
flush()
assert.equal(nav.reads, beforeNestedNavReads, 'Nested scrollers skip geometry measurement inside the frame')
scrollCallback(); settingCallback(); flush()
assert.equal(nav.reads, beforeNestedNavReads + 1, 'Settings upgrade a queued scroll even when page position is unchanged')
const refreshedCardReads = card.reads
for (let i = 0; i < 100; i++) { scrollTop += 10; scrollCallback(); flush() }
assert.equal(card.reads, refreshedCardReads, '100 scroll frames reuse receiver geometry')
assert.equal(vm.runInContext('surfaces.value.length', context), 0)
assert.equal(root.dataset.depthReceivers, 'true', 'Empty receiver band must not flash the old CSS projection')
card.box = { ...box, y: -20000, height: 60000 }
observers[0].callback([{ target: card }]); flush()
assert.equal(vm.runInContext('surfaces.value[0].y', context), -96)
assert.equal(card.reads, refreshedCardReads + 1, 'Content resize refreshes cached geometry')
const beforeNavResize = card.reads
const beforeSurfaces = vm.runInContext('surfaces.value', context)
const beforeViewport = vm.runInContext('viewport.value', context)
scrollTop += 1; scrollCallback()
assert.equal(raf.size, 1)
// Simulate scrolling back before the pending update is delivered.
scrollTop -= 1
nav.box.width = 700; observers[0].callback([{ target: nav }])
assert.equal(raf.size, 0, 'Resize consumes the pending frame instead of adding a frame of projection latency')
assert.equal(vm.runInContext('header.value.width', context), 700, 'Resize updates geometry before another animation frame')
assert.equal(vm.runInContext('surfaces.value', context), beforeSurfaces, 'Width-only animation preserves receiver mask data identity')
assert.equal(vm.runInContext('viewport.value', context), beforeViewport, 'Width-only animation preserves drawing viewport')
assert.equal(card.reads, beforeNavResize, 'Navbar width transition does not remeasure normal-flow cards')
assert.equal(vm.runInContext('header.value.width', context), 700)
nav.box = { ...nav.box, width: 0, height: 0 }; settingCallback(); flush()
assert.equal(root.dataset.depthReceivers, undefined, 'Hidden focus-mode navigation has no projected band')
nav.box = { x: 30, y: 18, width: 900, height: 54 }
await routeCallback(); flush()
assert.equal(root.dataset.depthReceivers, 'true')
card.box = { ...box, y: 120 }; pageFinish(); flush()
assert.equal(vm.runInContext('surfaces.value[0].y', context), 120, 'Async page finish binds the new page geometry')
root.clientWidth = 390; resizeListeners.forEach(fn => fn()); flush()
assert.equal(vm.runInContext('viewport.value.height', context), 202, 'Mobile keeps its own far blur envelope')
root.dataset.visual = 'classic'; settingCallback()
assert.equal(root.dataset.depthReceivers, undefined)
assert(source.includes('<svg v-if="enabled"'), 'Receiver gaps must not unmount the projection layer')
assert.equal(scrollCallback, null)
assert.equal(resizeListeners.size, 0)
assert.equal(observers[0].targets.length, 0)
root.dataset.visual = 'modern'; settingCallback()
assert.equal(raf.size, 1)
unmounted()
assert.equal(pageHookStopped, true)
assert.equal(raf.size, 0)
assert.equal(scrollCallback, null)
assert.equal(settingCallback, null)
assert.equal(root.dataset.depthReceivers, undefined)
assert(source.includes('pointer-events: none') && source.includes('aria-hidden="true"'))
assert(source.includes(':mask="`url(#${nearId})`"') && source.includes(':mask="`url(#${farId})`"'), 'Separate near/far receiver masks')
assert(!source.includes('backdrop-filter'), 'Do not replace existing material filters')
assert(source.includes('prefers-reduced-motion'))
const css = readFileSync('app/assets/css/depth.css', 'utf8')
assert(css.includes('var(--depth-direct-band, var(--depth-glass-light))'), 'Original broad band remains the no-JS fallback')
console.log('PASS: near/far receiver masks, bounded offscreen geometry, opt-in scroll lifecycle, coalescing, focus fallback and teardown. Not browser visual verification.')
