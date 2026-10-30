import { glassSurfaceEnabled, effectiveGlassPreference } from '../app/utils/glass-settings.ts'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { glassOptics } from '../app/utils/glass-optics.ts'
import { glassQuality } from '../app/utils/glass-quality.ts'

// Exercise the real adapter with a controllable engine/DOM boundary. This checks
// ownership, async cancellation and exact restoration, not browser optics or FPS.
class Style {
  values = new Map()
  getPropertyValue(key) { return this.values.get(key)?.value || '' }
  getPropertyPriority(key) { return this.values.get(key)?.priority || '' }
  setProperty(key, value, priority = '') { this.values.set(key, { value, priority }) }
  removeProperty(key) { this.values.delete(key) }
}
for (const [property, css] of Object.entries({ position: 'position', zIndex: 'z-index', backdropFilter: 'backdrop-filter', filter: 'filter' })) {
  Object.defineProperty(Style.prototype, property, {
    get() { return this.getPropertyValue(css) }, set(value) { this.setProperty(css, value) },
  })
}
class Element {
  constructor(module) { this.dataset = module ? { glassModule: module } : {}; this.style = new Style(); this.attrs = new Map(); this.children = []; this.isConnected = true; this.clientWidth = 380; this.clientHeight = 320 }
  appendChild(el) { this.children.push(el); el.parent = this }
  remove() { this.isConnected = false; if (this.parent) this.parent.children = this.parent.children.filter(el => el !== this) }
  hasAttribute(key) { return this.attrs.has(key) }
  closest(selector) { return selector.includes('data-glass-presence="closed"') && this.closed ? this : null }
  getAttribute(key) { return this.attrs.get(key) ?? null }
  setAttribute(key, value) { this.attrs.set(key, value) }
  removeAttribute(key) { this.attrs.delete(key) }
}
const source = readFileSync('app/utils/experimental-glass.ts', 'utf8')
  .replace(/^import .*$/gm, '')
  .replace(/^type EngineModule = .*$/m, '')
  .replace("import('../vendor/liquidglass/liquid-glass.js')", 'loadEngine()')
  .replace('export function mountExperimentalGlass', 'function mountExperimentalGlass')
const compiled = ts.transpile(source, { target: ts.ScriptTarget.ES2022 })
const settle = async () => { for (let i = 0; i < 6; i++) await Promise.resolve() }

function setup({ engineName = 'blink', delayed = false, decode = true } = {}) {
  const root = new Element(), dock = new Element(), panel = new Element('music'), pill = new Element()
  root.dataset = { visual: 'modern', experimentalLiquidGlass: 'off', navMaterial: 'liquid', musicMaterial: 'liquid' }
  panel.style.setProperty('backdrop-filter', 'blur(7px)', 'important')
  panel.style.setProperty('filter', 'brightness(.9)')
  const originals = [...panel.style.values].map(([k, v]) => [k, { ...v }])
  const registered = new Set([panel]), observers = new Set(), timers = new Map(), calls = []
  let loads = 0, timerId = 0, resolve
  class Observer {
    constructor(fn) { this.fn = fn; this.targets = new Map(); observers.add(this) }
    observe(el, options) { this.targets.set(el, options) }
    disconnect() { this.targets.clear(); observers.delete(this) }
  }
  function emit(el, attributeName) {
    for (const observer of [...observers]) {
      const options = observer.targets.get(el)
      if (options?.attributeFilter?.includes(attributeName)) observer.fn([{ attributeName }])
    }
  }
  const engine = { engine: engineName, createGlass(target, options) {
    const call = { target, options, updates: [], destroyed: false }; calls.push(call)
    if (decode) queueMicrotask(() => { if (!call.destroyed) { target.style.backdropFilter = 'url(#test-glass)'; emit(target, 'style') } })
    return { update: value => call.updates.push(value), flush() {}, destroy() { call.destroyed = true; target.style.removeProperty('backdrop-filter'); target.style.removeProperty('-webkit-backdrop-filter'); target.style.removeProperty('filter') } }
  } }
  const pending = delayed ? new Promise(r => { resolve = r }) : Promise.resolve(engine)
  const win = new EventTarget(), media = new EventTarget(); media.matches = false
  win.setTimeout = fn => { timers.set(++timerId, fn); return timerId }
  const context = vm.createContext({
    document: { documentElement: root, querySelectorAll: () => [dock], querySelector: () => pill, createElement: () => new Element() },
    window: win, matchMedia: () => media, glassSurfaces: registered, GLASS_SURFACES_CHANGED: 'changed', glassOptics,
    GLASS_CONTENT_SELECTOR: '.article-page', glassSurfaceEnabled, effectiveGlassPreference,
    currentGlassQuality: (w, h) => glassQuality(Number(root.dataset.glassClarity ?? 86), root.dataset.glassAntialias === 'on', w, h),
    MutationObserver: Observer, ResizeObserver: Observer,
    getComputedStyle: () => ({ position: 'static', zIndex: 'auto', borderTopLeftRadius: '12px' }),
    clearTimeout: id => timers.delete(id), console,
    loadEngine: () => { loads++; return pending },
  })
  vm.runInContext(`${compiled}\nglobalThis.mount = mountExperimentalGlass`, context)
  const stop = context.mount()
  const enabled = value => { root.dataset.experimentalLiquidGlass = value ? 'on' : 'off'; emit(root, 'data-experimental-liquid-glass') }
  return { root, dock, panel, originals, registered, win, media, calls, observers, timers, stop, enabled, emit,
    loads: () => loads, resolve: () => resolve?.(engine), change: () => win.dispatchEvent(new Event('changed')) }
}

const run = setup()
assert.equal(run.loads(), 0, 'default off does not import the engine')
run.enabled(true); await settle()
assert.equal(run.calls.length, 2)
assert.equal(run.dock.children.length, 0, 'dock has no injected negative-z layer or extra flex item')
assert.equal(run.calls[0].target, run.dock, 'dock optics filter backdrop on host, never label content')
assert.equal(run.panel.children.length, 0, 'clipped panels filter their backdrop directly')
assert.equal(run.panel.getAttribute('data-liquid-glass-active'), '')
run.enabled(false); await settle()
assert(run.calls.every(call => call.destroyed))
assert.deepEqual(run.panel.style.values, new Map(run.originals), 'restore original filter values and priorities')
assert.equal(run.panel.getAttribute('data-liquid-glass-active'), null)
assert.equal(run.dock.children.length, 0)
run.enabled(true); await settle()
assert.equal(run.loads(), 1, 'reuse lazy module after toggling')
run.registered.delete(run.panel); run.change(); await settle()
assert(run.calls.at(-1).destroyed, 'unregistered panel releases its filter')
run.root.dataset.visual = 'classic'; run.emit(run.root, 'data-visual'); await settle()
assert(run.calls.every(call => call.destroyed), 'paper mode restores original surfaces')
run.stop()
assert.equal(run.observers.size, 0)
assert.equal(run.timers.size, 0)

const scoped = setup()
scoped.enabled(true); await settle()
const dockUpdates = scoped.calls[0].updates.length
scoped.root.dataset.glassComponents = JSON.stringify({ music: { clarity: 25 } })
scoped.emit(scoped.root, 'data-glass-components'); await settle()
assert.equal(scoped.calls[0].updates.length, dockUpdates, 'Editing music does not refresh the dock optics')
scoped.root.dataset.musicMaterial = 'mica'; scoped.emit(scoped.root, 'data-music-material'); await settle()
assert(scoped.calls[1].destroyed, 'Material change releases experimental renderer')
assert.deepEqual(scoped.panel.style.values, new Map(scoped.originals))
scoped.root.dataset.glassGlobal = JSON.stringify({ enabled: true, settings: { enabled: false } })
scoped.emit(scoped.root, 'data-glass-global'); await settle()
assert(scoped.calls.every(call => call.destroyed), 'Global disable releases all lenses')
scoped.root.dataset.glassGlobal = JSON.stringify({ enabled: false })
scoped.emit(scoped.root, 'data-glass-global'); await settle()
assert.equal(scoped.calls.length, 3, 'Global off restores only eligible component materials')
scoped.stop()

const pending = setup({ delayed: true })
pending.enabled(true); pending.enabled(false); pending.resolve(); await settle()
assert.equal(pending.calls.length, 0, 'late import cannot re-enable an off experiment')
pending.stop()
const teardown = setup({ delayed: true })
teardown.enabled(true); teardown.stop(); teardown.resolve(); await settle()
assert.equal(teardown.calls.length, 0, 'late import cannot revive an unmounted owner')

const fallback = setup({ engineName: 'webkit' })
fallback.enabled(true); await settle()
assert.equal(fallback.calls.length, 0)
assert.deepEqual(fallback.panel.style.values, new Map(fallback.originals))
fallback.stop()

const reduced = setup()
reduced.media.matches = true; reduced.enabled(true); await settle()
assert.equal(reduced.loads(), 0, 'reduced transparency avoids loading optics')
reduced.media.matches = false; reduced.media.dispatchEvent(new Event('change')); await settle()
assert.equal(reduced.calls.length, 2)
reduced.media.matches = true; reduced.media.dispatchEvent(new Event('change')); await settle()
assert(reduced.calls.every(call => call.destroyed))
reduced.stop()

const timeout = setup({ decode: false })
timeout.enabled(true); await settle()
for (const callback of [...timeout.timers.values()]) callback()
assert(timeout.calls.every(call => call.destroyed))
assert.deepEqual(timeout.panel.style.values, new Map(timeout.originals))
timeout.stop()

const focus = setup()
focus.panel.dataset.glassModule = 'navbar'
focus.root.dataset.displayMode = 'focus'; focus.enabled(true); await settle()
assert.equal(focus.calls.length, 1, 'focus mode does not build a hidden navbar lens')
focus.root.dataset.displayMode = 'off'; focus.emit(focus.root, 'data-display-mode'); await settle()
assert.equal(focus.calls.length, 2, 'leaving focus mode restores navbar optics')
assert.equal(focus.calls.at(-1).options.refraction, glassOptics('navbar').refraction)
focus.root.dataset.displayMode = 'focus'; focus.emit(focus.root, 'data-display-mode'); await settle()
assert(focus.calls.at(-1).destroyed, 'entering focus mode releases navbar optics')
focus.stop()
console.log('PASS glass adapter: lazy loading, host ownership, exact restoration, async cancellation, fallback, reduced transparency, focus-mode return and decode timeout. No browser optics measured.')

const sleeping = setup()
sleeping.enabled(true); await settle()
const existing = sleeping.calls.find(call => call.target === sleeping.panel)
const close = () => { sleeping.panel.closed = true; sleeping.registered.delete(sleeping.panel); sleeping.change() }
const reopen = () => { sleeping.panel.closed = false; sleeping.registered.add(sleeping.panel); sleeping.change() }
for (let i = 0; i < 25; i++) {
  close(); await settle()
  assert.equal(sleeping.panel.getAttribute('data-liquid-glass-dormant'), '')
  assert.equal(existing.destroyed, false, 'Visited decoded surface sleeps without rebuilding')
  reopen(); await settle()
  assert.equal(sleeping.panel.getAttribute('data-liquid-glass-dormant'), null)
  assert.equal(sleeping.calls.length, 2, 'Close/reopen creates no additional controllers')
}
close(); await settle()
const updates = existing.updates.length
sleeping.root.dataset.glassClarity = '25'; sleeping.emit(sleeping.root, 'data-glass-clarity'); await settle()
assert.equal(existing.updates.length, updates, 'Dormant surfaces generate no quality updates')
sleeping.panel.isConnected = false; sleeping.change(); await settle()
assert(existing.destroyed, 'Route removal releases sleeping resources')
sleeping.stop()
assert.equal(sleeping.observers.size, 0)
console.log('PASS 25 close/reopen cycles reuse decoded controller; closed quality changes stay idle; detached sleeping host releases resources')
