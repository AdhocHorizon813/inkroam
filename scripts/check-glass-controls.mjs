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
  insertBefore(c, ref) { const i = this.children.indexOf(ref); this.children.splice(i < 0 ? this.children.length : i, 0, c); c.parentElement = this; return c }
  get firstChild() { return this.children[0] ?? null }
  replaceChildren(...c) { this.children = []; c.forEach(e => this.appendChild(e)) }
  remove() { this.parentElement.children = this.parentElement.children.filter(c => c !== this) }
  setAttribute(k, v) { this.attrs.set(k, v) }
  getAttribute(k) { return this.attrs.get(k) ?? null }
  removeAttribute(k) { this.attrs.delete(k) }
  querySelector() { return this.children.find(e => e.tagName === 'INPUT') ?? null }
  querySelectorAll() { return [] }
  closest(selector) {
    const selectors = selector.split(',').map(s => s.trim())
    if (selectors.some(s => s.startsWith('.') ? this.classes.has(s.slice(1)) : this.tagName === s.toUpperCase())) return this
    return this.parentElement?.closest(selector) ?? null
  }
  contains(el) { return el === this || this.children.includes(el) }
  matches() { return Boolean(this.disabled) }
  getBoundingClientRect() { return { left: 0, width: this.clientWidth } }
  click() { this.clicks = (this.clicks ?? 0) + 1 }
}
function fixture(slider = false, portaled = false, nativeAnchors = false) {
  const host = new Element(), group = new Element('DIV'), window = new EventTarget()
  host.dataset.glassModule = slider ? 'thumb' : 'indicator'
  group.classes.add(slider ? 'glass-range' : 'main-nav')
  const first = new Element(slider ? 'INPUT' : 'A'), second = new Element('A')
  first.offsetLeft = 4; second.offsetLeft = 89
  if (slider) { first.min = '0'; first.max = '100'; first.value = '50'; first.offsetHeight = 20 }
  else first.setAttribute('aria-current', 'page')
  group.appendChild(host); group.appendChild(first); if (!slider) group.appendChild(second)
  const panel = new Element('SECTION'), scroller = new Element('DIV')
  if (portaled) {
    panel.classes.add('appearance-panel'); scroller.classes.add('appearance-panel__scroll')
    panel.appendChild(scroller); scroller.appendChild(group)
    panel.clientLeft = panel.clientTop = 1; panel.offsetWidth = 350; panel.offsetHeight = 600
    panel.getBoundingClientRect = () => ({ left: 100, top: 100, right: 450, bottom: 700, width: 350, height: 600 })
    scroller.getBoundingClientRect = () => ({ left: 101, top: 101, right: 449, bottom: 699 })
    host.getBoundingClientRect = () => ({ left: 125, top: 150, right: 205, bottom: 182, width: 80, height: 32 })
  }
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
    CSS: { supports: () => nativeAnchors },
    currentGlassQuality: () => glassQuality(86, false),
    getComputedStyle: () => ({ direction, font: '500 12px sans-serif', letterSpacing: '0px', columnGap: '4px', padding: '0px', textTransform: 'none' }) })
  vm.runInContext(ts.transpile(source, { target: ts.ScriptTarget.ES2022 }) + '\nglobalThis.attach = attachGlassControl;', context)
  const cleanup = context.attach(host, engine)
  const decode = () => { calls[0].el.style.backdropFilter = 'url(#lens)'; observers[0].fn() }
  const event = (el, name, values = {}) => { const e = new Event(name, { cancelable: true });
    for (const [k, v] of Object.entries(values)) Object.defineProperty(e, k, { value: v }); el.dispatchEvent(e) }
  return { host, group, first, second, panel, scroller, window, springs, calls, observers, timers, cleanup, decode, event, rtl: () => { direction = 'rtl' } }
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
assert.equal(nav.springs[0].target, 44, 'Hover never moves the selected indicator center')
nav.springs[0].tick(50, 500)
assert(nav.calls[0].updates.at(-1).width > 80, 'Velocity stretches lens width')
assert(nav.calls[0].updates.at(-1).height < 32, 'Velocity squashes height')
nav.event(nav.group, 'pointerleave')
assert.equal(nav.springs[0].target, 44, 'Leaving returns to actual selection center')
nav.second.offsetWidth = 40
nav.event(nav.group, 'pointerdown', { button: 0, pointerId: 1, clientX: 40, clientY: 20, target: nav.first })
nav.event(nav.group, 'pointermove', { pointerId: 1, clientX: 125, clientY: 20 })
assert.equal(nav.springs[2].target, 80, 'Crossing a narrow candidate never changes drag width')
nav.event(nav.group, 'pointermove', { pointerId: 1, clientX: 400, clientY: 20 })
assert.equal(nav.springs[0].target, 109, 'Farthest drag position aligns centers, not right edges')
nav.event(nav.window, 'pointerup', { pointerId: 1 })
assert.equal(nav.second.clicks, 1, 'Drop commits through the original button')
assert.equal(nav.springs[2].target, 40, 'Only dropping starts the target width spring')
assert.equal(nav.springs[2].immediate, false, 'Width morph uses spring instead of a jump')
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

// The submenu accordion clips its children horizontally. Reserve enough
// native-input runway for the larger optical thumb at both extreme values.
// These geometry checks also cover press + spring stretch (28 + 14 + 10px).
const submenuSource = fs.readFileSync('app/components/GlassSettings.vue', 'utf8')
const submenuPadding = submenuSource.match(/\.glass-settings__parameters\s+:deep\(\.glass-range\)\s*\{[^}]*padding-inline:\s*(\d+)px/)
assert(submenuPadding, 'Submenu glass ranges must provide symmetric end clearance')
const rangeInset = Number(submenuPadding[1])
const glassThumbMax = 28 + 14 + 10, nativeThumb = 16, bodyPadding = 2
for (const rangeWidth of [220, 280, 600]) {
  for (const fraction of [0, 1]) {
    const center = rangeInset + nativeThumb / 2 + fraction * (rangeWidth - 2 * rangeInset - nativeThumb)
    assert(center - glassThumbMax / 2 + bodyPadding >= 0, 'Left-end glass thumb must not be clipped')
    assert(center + glassThumbMax / 2 <= rangeWidth + bodyPadding, 'Right-end glass thumb must not be clipped')
  }
}

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
// Regression contract: the optical portal must follow only the arriving
// appearance subpage, not every hidden control across both retained pages.
const controlsSource = fs.readFileSync('app/utils/glass-controls.ts', 'utf8')
const managerSource = fs.readFileSync('app/utils/experimental-glass.ts', 'utf8')
assert.match(controlsSource, /const panelMotions = new WeakMap/, 'One scheduler per appearance panel')
assert.match(controlsSource, /state\.pages\.get\(page\)/, 'Scheduler updates only the entering subpage')
assert.match(controlsSource, /appearance-subpage-enter-active/, 'Do not chase unrelated transitions')
assert.match(controlsSource, /dataset\.glassPageHidden === 'true'/, 'Outgoing page optics are hidden immediately')
assert.doesNotMatch(controlsSource, /followUntil|followFrame|listen\(panel!, 'transitionstart'/,
  'Individual controls must not install 400ms panel-wide RAF followers')
assert.match(managerSource, /surfaces\.get\(host\)\?\.refreshLayout\?\.\(\)/, 'Let hidden controls release stale portal visibility')
// On supporting Chromium builds, the real control is a CSS anchor. The
// portaled lens follows its compositor scroll and transform without delayed
// scroll listeners or geometry polling. The fallback path is tested below.
const tethered = fixture(false, true, true)
tethered.decode()
const tether = tethered.calls[0].el
assert.match(tethered.host.style.getPropertyValue('anchor-name'), /^--inkroam-optic-\d+$/)
assert.equal(tether.style.getPropertyValue('position-anchor'),
  tethered.host.style.getPropertyValue('anchor-name'))
assert.equal(tether.style.left, 'anchor(left)')
assert.equal(tether.style.top, 'anchor(top)')
assert.equal(tether.style.width, 'anchor-size(width)')
assert.equal(tether.style.height, 'anchor-size(height)')
assert.equal(tether.style.getPropertyValue('position-visibility'), 'anchors-visible')
tethered.event(tethered.scroller, 'scroll') // no JS rAF read/scroll follower
tethered.cleanup.destroy()
assert.equal(tethered.host.style.getPropertyValue('anchor-name'), '', 'Restore original anchor-name on unmount')

const masked = fixture(false, true)
masked.decode()
assert.equal(masked.calls[0].el.parentElement, masked.panel, 'Lens escapes the masked scroll backdrop root')
assert.equal(masked.panel.firstChild, masked.calls[0].el, 'Optics paint before original labels, not over their glyphs')
assert.equal(masked.calls[0].el.style.left, '24px', 'Portal maps viewport coordinates to panel padding box')
assert.equal(masked.calls[0].el.style.top, '49px')
assert.equal(masked.group.children.length, 3, 'Original labels/hit targets stay in masked scroller')
masked.cleanup.destroy()
assert.equal(masked.panel.children.length, 1, 'Portal removed on disable/unmount')
console.log('PASS: no label copies, center-clamped drag, release-only size morph, range endpoints/RTL/property updates and cleanup. No visual claim.')
assert.equal(glassQuality(100, false).blur, 0)
assert.equal(glassQuality(0, false).blur, 24)
assert(glassQuality(20, false).blur > glassQuality(80, false).blur)
assert.equal(glassQuality(86, true, 80, 32).mapScale, 1)
assert.equal(glassQuality(86, false, 80, 32).mapScale, 1)
assert.equal(glassQuality(86, true, 4096, 2048).mapScale, 1)
assert.equal(glassQuality(86, true).edgeSoftness, .8)
for (const [w, h] of [[80, 32], [350, 720], [1920, 1080]]) {
  const off = glassQuality(86, false, w, h, false, 2)
  const on = glassQuality(86, true, w, h, false, 2)
  assert.equal(on.mapScale, off.mapScale, 'AA cannot increase texture area')
  assert(on.mapScale >= 1 && on.mapScale <= 2, 'No sub-CSS-pixel displacement map')
}
assert.equal(glassQuality(86, false, 80, 32, false, 2).mapScale, 2, 'HiDPI clarity without enabling AA')
assert.equal(glassQuality(86, false).edgeSoftness, 0)
assert(glassQuality(86, false, 80, 32, true).specular > glassQuality(86, false, 80, 32, false).specular)
assert(glassQuality(86, false, 80, 32, true).specularAmbient < glassQuality(86, false, 80, 32, false).specularAmbient)
assert.equal(nav.calls[0].updates.at(-1).radius, 9, 'Navbar keeps compact corners')
console.log('PASS: clarity controls diffusion; DPR sampling independent of AA; light/dark rim tint differs.')

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

// A broad bezel must not reach the medial-axis discontinuity inside a tight
// corner. These are actual generated map pixels, not a source-string assertion.
const wideShape = { width: 350, height: 600, radius: 12, bezel: .3, specular: 0, boundedBezel: true }
const bounded = pixels.renderMap(wideShape, 1).canvas.data
for (const [x, y] of [[13, 14], [14, 13], [16, 16], [175, 300]]) {
  const at = (y * 350 + x) * 4
  assert.equal(bounded[at], 128, 'No horizontal displacement across inner corner seam')
  assert.equal(bounded[at + 1], 128, 'No vertical displacement across inner corner seam')
}
const rimOnly = pixels.renderMap({ ...wideShape, specular: 1, specularWidth: 1, rimGlow: 0 }, 2).canvas.data
const innerTop = (6 * 700 + 350) * 4
assert.equal(rimOnly[innerTop + 2], 128, 'No broad inward white wash: highlight stays on geometric rim')
console.log('PASS: bounded bevel removes diagonal corner seam; rim-only highlight leaves inner surface untinted.')
