import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { glassQuality } from '../app/utils/glass-quality.ts'

// Real control adapter with deterministic DOM/engine boundaries. It verifies
// motion inputs and cleanup, not rendered pixels or a browser performance claim.
class Element extends EventTarget {
  constructor(tag = 'SPAN') {
    super(); this.tagName = tag; this.children = []; this.dataset = {}; this.attrs = new Map()
    this.style = { values: new Map(), setProperty(k, v, p = '') { this.values.set(k, [v, p]) },
      getPropertyValue(k) { return this.values.get(k)?.[0] || '' }, getPropertyPriority(k) { return this.values.get(k)?.[1] || '' },
      removeProperty(k) { this.values.delete(k) } }
    for (const k of ['left', 'top', 'width', 'height', 'transform', 'marginLeft', 'borderRadius', 'transition', 'filter', 'backdropFilter']) {
      const css = k.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`)
      Object.defineProperty(this.style, k, { get: () => this.style.getPropertyValue(css), set: v => this.style.setProperty(css, v) })
    }
    this.classes = new Set(); this.classList = { contains: c => this.classes.has(c) }
    this.offsetLeft = 0; this.offsetTop = 4; this.offsetWidth = 80; this.offsetHeight = 32; this.clientWidth = 240
  }
  get childNodes() { return this.children }
  appendChild(c) { this.children.push(c); c.parentElement = this; return c }
  replaceChildren(...c) { this.children = []; c.forEach(e => this.appendChild(e)) }
  remove() { this.parentElement.children = this.parentElement.children.filter(c => c !== this) }
  setAttribute(k, v) { this.attrs.set(k, v) }
  getAttribute(k) { return this.attrs.get(k) ?? null }
  removeAttribute(k) { this.attrs.delete(k) }
  querySelector() { return this.children.find(e => e.tagName === 'INPUT') ?? null }
  querySelectorAll() { return [] }
  closest(selector) { return selector.includes('glass-range') ? this.parentElement : this }
  contains(el) { return el === this || this.children.includes(el) }
  matches() { return Boolean(this.disabled) }
  getBoundingClientRect() { return { left: 0, width: this.clientWidth } }
  click() { this.clicks = (this.clicks ?? 0) + 1 }
}
function fixture(slider = false) {
  const host = new Element(), group = new Element('DIV'), window = new EventTarget()
  host.dataset.glassModule = slider ? 'thumb' : 'indicator'
  group.classes.add(slider ? 'glass-range' : 'main-nav')
  const first = new Element(slider ? 'INPUT' : 'A'), second = new Element('A')
  first.offsetLeft = 4; second.offsetLeft = 89
  if (slider) { first.min = '0'; first.max = '100'; first.value = '50'; first.offsetHeight = 20 }
  else first.setAttribute('aria-current', 'page')
  group.appendChild(host); group.appendChild(first); if (!slider) group.appendChild(second)
  const observers = [], springs = [], calls = [], timers = new Map()
  let direction = 'ltr'
  class Observer {
    constructor(fn) { this.fn = fn; this.targets = []; observers.push(this) }
    observe(el) { this.targets.push(el) }
    disconnect() { this.targets = [] }
  }
  const engine = {
    createSpring(value, fn, config) {
      const spring = { value, config, stopped: false, set(next, opts) { this.target = next; this.immediate = opts?.immediate; fn(next, 0) },
        tick(value, velocity) { fn(value, velocity) }, stop() { this.stopped = true } }
      springs.push(spring); return spring
    },
    createGlass(el, options) { const call = { el, options, updates: [], destroyed: false,
      update(o) { this.updates.push(o) }, destroy() { this.destroyed = true } }; calls.push(call); return call },
  }
  window.setTimeout = fn => { timers.set(1, fn); return 1 }
  const source = fs.readFileSync('app/utils/glass-controls.ts', 'utf8').replace(/^import .*$/gm, '').replace(/^type Engine = .*$/m, '')
    .replace('export function attachGlassControl', 'function attachGlassControl')
  const context = vm.createContext({ HTMLElement: Element, document: { createElement: tag => new Element(tag.toUpperCase()) },
    window, MutationObserver: Observer, ResizeObserver: Observer, clearTimeout: id => timers.delete(id),
    currentGlassQuality: () => glassQuality(86, false),
    getComputedStyle: () => ({ direction, font: '500 12px sans-serif', letterSpacing: '0px', columnGap: '4px', padding: '0px', textTransform: 'none' }) })
  vm.runInContext(ts.transpile(source, { target: ts.ScriptTarget.ES2022 }) + '\nglobalThis.attach = attachGlassControl;', context)
  const cleanup = context.attach(host, engine)
  const decode = () => { calls[0].el.style.backdropFilter = 'url(#lens)'; observers[0].fn() }
  const event = (el, name, values = {}) => { const e = new Event(name, { cancelable: true });
    for (const [k, v] of Object.entries(values)) Object.defineProperty(e, k, { value: v }); el.dispatchEvent(e) }
  return { host, group, first, second, window, springs, calls, observers, timers, cleanup, decode, event, rtl: () => { direction = 'rtl' } }
}

const nav = fixture()
assert.equal(nav.calls[0].options.mode, 'backdrop')
assert.equal(nav.calls[0].el, nav.host, 'Lens sits under original text; no duplicate labels')
assert.equal(nav.group.children.length, 3)
assert.equal(nav.springs[0].config.stiffness, 380)
assert.equal(nav.host.getAttribute('data-liquid-glass-active'), null, 'No visual override before decode')
nav.decode()
assert.equal(nav.host.getAttribute('data-liquid-glass-control'), '')
nav.event(nav.second, 'pointerenter', { pointerType: 'mouse' })
assert.equal(nav.springs[0].target, 4, 'Hover never moves the selected indicator')
nav.springs[0].tick(50, 500)
assert(nav.calls[0].updates.at(-1).width > 80, 'Velocity stretches lens width')
assert(nav.calls[0].updates.at(-1).height < 32, 'Velocity squashes height')
nav.event(nav.group, 'pointerleave')
assert.equal(nav.springs[0].target, 4, 'Leaving returns to actual selection')
nav.event(nav.group, 'pointerdown', { button: 0, pointerId: 1, clientX: 40, clientY: 20, target: nav.first })
nav.event(nav.group, 'pointermove', { pointerId: 1, clientX: 125, clientY: 20 })
assert(nav.springs[0].target > 4, 'Drag moves lens continuously')
nav.event(nav.window, 'pointerup', { pointerId: 1 })
assert.equal(nav.second.clicks, 1, 'Drop commits through the original button')
nav.event(nav.group, 'pointerdown', { button: 0, pointerId: 2, clientX: 40, clientY: 20, target: nav.first })
nav.event(nav.group, 'pointermove', { pointerId: 2, clientX: 125, clientY: 20 })
nav.event(nav.window, 'pointercancel', { pointerId: 2 })
assert.equal(nav.second.clicks, 1, 'Cancelled drag never selects')
nav.cleanup.destroy()
assert(nav.calls[0].destroyed && nav.springs.every(s => s.stopped))
assert(nav.observers.every(o => o.targets.length === 0))
assert.equal(nav.timers.size, 0)
assert.equal(nav.host.getAttribute('data-liquid-glass-active'), null)
assert.equal(nav.group.children.length, 3, 'Decorative copy removed; original controls retained')
assert.equal(nav.host.style.getPropertyValue('transform'), '', 'Restore original CSS movement')
nav.springs[0].target = -1
nav.event(nav.second, 'pointerenter', { pointerType: 'mouse' })
assert.equal(nav.springs[0].target, -1, 'Listeners removed')

const range = fixture(true)
range.decode()
assert.equal(range.calls[0].el, range.host, 'Sample actual rail; never duplicate/tint its right endpoint')
assert.equal(range.calls[0].options.mode, 'backdrop')
assert.equal(range.springs[0].config.stiffness, 900)
range.first.value = '100'; range.event(range.first, 'input')
assert.equal(range.springs[0].target, 236, 'Native half-thumb inset at maximum')
range.rtl(); range.event(range.first, 'input')
assert.equal(range.springs[0].target, 12, 'RTL reverses travel')
range.first.value = '25'; range.event(range.group, 'inkroam:range-update')
assert.equal(range.springs[0].target, 180, 'Property-only updates resync')
range.springs[1].tick(1, 0)
assert.equal(range.calls[0].updates.at(-1).width, 42, 'Press expands thumb')
assert.equal(range.calls[0].updates.at(-1).height, 28)
range.event(range.window, 'blur')
assert.equal(range.springs[1].target, 0, 'Window blur releases pressure')
range.cleanup.destroy()
assert.equal(range.group.children.length, 2)
assert(range.springs.every(s => s.stopped))

const failed = fixture(true)
failed.timers.get(1)()
assert(failed.calls[0].destroyed)
assert.equal(failed.host.getAttribute('data-liquid-glass-control'), null)
assert.equal(failed.group.children.length, 2, 'Decode timeout retains original native input')
console.log('PASS: content-copy lenses, velocity deformation, selection return, range endpoints/RTL/property updates, pressure and cleanup. No visual claim.')
assert.equal(glassQuality(100, false).blur, 0)
assert.equal(glassQuality(0, false).blur, 24)
assert(glassQuality(20, false).blur > glassQuality(80, false).blur)
assert.equal(glassQuality(86, true, 80, 32).mapScale, 2)
assert.equal(glassQuality(86, false, 80, 32).mapScale, 1)
assert.equal(glassQuality(86, true, 4096, 2048).mapScale, .5)
assert.equal(glassQuality(86, true).edgeSoftness, 1.25)
assert.equal(glassQuality(86, false).edgeSoftness, 0)
assert(glassQuality(86, false, 80, 32, true).specular > glassQuality(86, false, 80, 32, false).specular)
assert(glassQuality(86, false, 80, 32, true).specularAmbient < glassQuality(86, false, 80, 32, false).specularAmbient)
assert.equal(nav.calls[0].updates.at(-1).radius, 9, 'Navbar keeps compact corners')
console.log('PASS: clarity controls diffusion, AA doubles bounded texture sampling, drag commit/cancel and no duplicate rail.')

// Inspect actual map alpha, not just a settings flag or a mocked engine call.
const core = fs.readFileSync('app/vendor/liquidglass/liquid-glass.js', 'utf8').replace(/^export /gm, '')
const pixels = vm.createContext({ navigator: { userAgent: 'Chrome/154' },
  window: { matchMedia: () => ({ matches: false }) },
  document: { createElement: () => {
    const canvas = { getContext: () => ({
      createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
      putImageData: image => { canvas.data = image.data },
    }) }; return canvas
  } },
})
vm.runInContext(core + '\nglobalThis.renderMap = renderLensMap;', pixels)
const shape = { width: 80, height: 32, radius: 9 }
const original = pixels.renderMap(shape, 2).canvas.data
const softened = pixels.renderMap({ ...shape, edgeSoftness: 1.25 }, 2).canvas.data
const topMiddleAlpha = (80 * 4) + 3
assert.equal(original[topMiddleAlpha], 255)
assert(softened[topMiddleAlpha] > 0 && softened[topMiddleAlpha] < 255, 'AA actually feathers boundary coverage')
const center = (32 * 160 + 80) * 4
assert.deepEqual(softened.slice(center, center + 4), original.slice(center, center + 4), 'No center/content blur from AA')
assert.deepEqual(pixels.renderMap({ ...shape, edgeSoftness: 0 }, 2).canvas.data, original, 'Off preserves upstream map pixels')
console.log('PASS: actual lens-map boundary alpha changes, interior pixels unchanged, AA-off retains upstream output.')
