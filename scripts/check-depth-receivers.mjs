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
const element = initial => ({ box: initial, getBoundingClientRect() { const b = this.box; return { left: b.x, top: b.y, width: b.width, height: b.height } }, parentElement: { closest: () => null } })
const nav = element({ x: 30, y: 18, width: 900, height: 54 })
const card = element(box)
const raf = new Map()
const resizeListeners = new Set()
let nextFrame = 0, mounted, unmounted, settingCallback, scrollCallback, routeCallback
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
  onMounted: fn => { mounted = fn }, onBeforeUnmount: fn => { unmounted = fn },
  watch: (_, fn) => { routeCallback = fn }, nextTick: () => Promise.resolve(),
  ResizeObserver: FakeResizeObserver,
  MutationObserver: class { constructor(fn) { settingCallback = fn } observe() {} disconnect() { settingCallback = null } },
  document: { documentElement: root, querySelector: () => nav, querySelectorAll: () => [card] },
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
scrollCallback(); scrollCallback(); scrollCallback()
assert.equal(raf.size, 1, 'Coalesce all scroll sources into one measurement')
card.box = { ...box, y: -20000, height: 60000 }; flush()
assert.equal(vm.runInContext('surfaces.value[0].y', context), -96)
nav.box = { ...nav.box, width: 0, height: 0 }; scrollCallback(); flush()
assert.equal(root.dataset.depthReceivers, undefined, 'Hidden focus-mode navigation has no projected band')
nav.box = { x: 30, y: 18, width: 900, height: 54 }
await routeCallback(); flush()
assert.equal(root.dataset.depthReceivers, 'true')
root.dataset.visual = 'classic'; settingCallback()
assert.equal(root.dataset.depthReceivers, undefined)
assert.equal(scrollCallback, null)
assert.equal(resizeListeners.size, 0)
assert.equal(observers[0].targets.length, 0)
root.dataset.visual = 'modern'; settingCallback()
assert.equal(raf.size, 1)
unmounted()
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
