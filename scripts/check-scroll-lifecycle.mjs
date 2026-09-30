import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import * as pageScroll from '../app/utils/page-scroll.ts'

// Execute the whole composable, retaining its nested closures and hook wiring.
// The deterministic frame/observer harness checks scheduling, not browser paint.
const code = ts.transpileModule(readFileSync('app/composables/usePageScrollable.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
function harness({ available = true, present = true } = {}) {
  let mount, unmount, scroll, serial = 0, stopped = 0, syncs = 0
  const frames = new Map(), listeners = new Map(), observers = []
  class Observer {
    targets = new Set()
    constructor(callback) { this.callback = callback; observers.push(this) }
    observe(target) { this.targets.add(target) }
    disconnect() { this.targets.clear() }
  }
  const attributes = new Map(), properties = new Map()
  const element = {
    clientHeight: 800, scrollHeight: 4800, scrollTop: 0, children: [{}, {}],
    getAttribute: key => attributes.get(key) ?? null,
    hasAttribute: key => attributes.has(key),
    setAttribute: (key, value) => attributes.set(key, value),
    removeAttribute: key => attributes.delete(key),
    style: {
      getPropertyValue: key => properties.get(key) ?? '',
      getPropertyPriority: () => '',
      setProperty: (key, value) => properties.set(key, value),
    },
  }
  const context = vm.createContext({
    exports: {},
    require: path => {
      assert.equal(path, '~/utils/page-scroll')
      return { ...pageScroll, onPageScroll: callback => { scroll = callback; return () => { stopped++; scroll = undefined } } }
    },
    onMounted: callback => { mount = callback }, onBeforeUnmount: callback => { unmount = callback },
    ResizeObserver: available ? Observer : undefined, MutationObserver: Observer,
    requestAnimationFrame: callback => { frames.set(++serial, callback); return serial },
    cancelAnimationFrame: id => frames.delete(id),
    window: {
      matchMedia: () => ({ matches: true }),
      addEventListener: (name, callback) => listeners.set(name, callback),
      removeEventListener: (name, callback) => { if (listeners.get(name) === callback) listeners.delete(name) },
    },
  })
  // Track actual thumb measurements without replacing the production function.
  Object.defineProperty(element, 'clientHeight', { get() { syncs++; return 800 } })
  vm.runInContext(code, context)
  context.exports.usePageScrollable({ value: present ? element : null })
  const tick = () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback()) }
  return { mount, unmount, tick, frames, listeners, observers, attributes, properties, element,
    scroll: () => scroll(), counts: () => ({ stopped, syncs }) }
}
const h = harness()
h.mount()
assert.equal(h.observers.length, 2)
assert.deepEqual([...h.observers[0].targets], h.element.children)
assert.equal(h.attributes.get(pageScroll.PAGE_SCROLLABLE_SETTLED_ATTRIBUTE), 'false')
h.tick()
assert.equal(h.attributes.get(pageScroll.PAGE_SCROLLABLE_SETTLED_ATTRIBUTE), 'false', 'First frame must not enable delay')
h.tick()
assert.equal(h.attributes.get(pageScroll.PAGE_SCROLLABLE_SETTLED_ATTRIBUTE), 'true', 'Second frame enables delay')
const initialSyncs = h.counts().syncs
for (let i = 0; i < 100; i++) h.scroll()
assert.equal(h.frames.size, 1, '100 scroll events coalesce to one scheduled update')
assert.equal(h.counts().syncs, initialSyncs, 'Scroll handler does not synchronously measure')
h.element.scrollTop = 400
h.tick()
assert.equal(h.counts().syncs, initialSyncs + 1)
assert.equal(h.properties.get(pageScroll.PAGE_SCROLLBAR_OFFSET_PROPERTY), '67px')
h.element.children = [{}]
h.observers[1].callback()
assert.deepEqual([...h.observers[0].targets], h.element.children, 'Replaced children replace observer subscriptions')
h.element.scrollHeight = 800
h.observers[0].callback()
assert.equal(h.attributes.get(pageScroll.PAGE_SCROLLABLE_ATTRIBUTE), 'false')
h.scroll(); h.unmount()
assert.equal(h.frames.size, 0, 'Pending scroll frame is cancelled')
assert.equal(h.listeners.size, 0)
assert.equal(h.counts().stopped, 1)
assert.ok(h.observers.every(observer => observer.targets.size === 0))
for (const options of [{ available: false }, { present: false }]) {
  const inactive = harness(options); inactive.mount()
  assert.equal(inactive.observers.length, 0)
  assert.equal(inactive.frames.size, 0)
  inactive.unmount()
  assert.equal(inactive.counts().stopped, 0)
}
for (const elapsedFrames of [0, 1]) {
  const early = harness(); early.mount()
  // Observer deliveries may schedule several first-paint callbacks before settling.
  early.observers[0].callback()
  early.observers[0].callback()
  for (let i = 0; i < elapsedFrames; i++) early.tick()
  early.unmount()
  assert.equal(early.frames.size, 0, `Unmount after ${elapsedFrames} frames cancels every pending fade callback`)
  early.tick(); early.tick()
  assert.equal(early.attributes.get(pageScroll.PAGE_SCROLLABLE_SETTLED_ATTRIBUTE), 'false', 'Detached element receives no delayed write')
}
console.log('PASS: actual composable mount, double-rAF delay, event coalescing, child replacement, resize and teardown before/after first paint. No browser paint/timing claim.')
