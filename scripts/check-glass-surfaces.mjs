import assert from 'node:assert/strict'
import { afterGlassMotion } from '../app/utils/glass-motion.ts'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

// Exercise real lifetime code against controlled browser animation promises.
// No pixel or FPS claims: the browser QA report records those separately.
const frames = new Map(), timers = new Map()
let id = 0, notifications = 0
const win = new EventTarget()
globalThis.window = win
win.setTimeout = (callback, delay) => { timers.set(++id, {callback, delay}); return id }
globalThis.clearTimeout = token => timers.delete(token)
globalThis.requestAnimationFrame = callback => { frames.set(++id, callback); return id }
globalThis.cancelAnimationFrame = token => frames.delete(token)
const source = readFileSync('app/utils/glass-surfaces.ts', 'utf8').replace(/^import .*$/gm, '').replaceAll('export ', '')
const { glassSurfaces, GLASS_SURFACES_CHANGED, vExperimentalGlass, vGlassPresence } = new Function('afterGlassMotion',
  ts.transpile(source, {target: ts.ScriptTarget.ES2022}) + '\nreturn { glassSurfaces, GLASS_SURFACES_CHANGED, vExperimentalGlass, vGlassPresence }')(afterGlassMotion)
win.addEventListener(GLASS_SURFACES_CHANGED, () => notifications++)
const frame = async () => {
  const work = [...frames.values()]; frames.clear(); work.forEach(callback => callback())
  for (let n = 0; n < 6; n++) await Promise.resolve()
}
const settle = async () => { await frame(); await frame(); await frame() }
class Element extends EventTarget {
  dataset = {}; isConnected = true; parentElement = null; motion = []
  getAnimations() { return this.motion }
}
function animation(host, duration) {
  let resolve, reject
  const a = {playState:'running', currentTime:0, playbackRate:1,
    effect: {getComputedTiming: () => ({endTime:duration})},
    finished: new Promise((yes, no) => { resolve = yes; reject = no }),
    finish() { this.currentTime = duration; this.playState = 'finished'; resolve() },
    cancel() { this.playState = 'idle'; reject(new Error('cancelled')) },
  }
  host.motion.push(a)
  return a
}
const host = new Element(), owner = new Element()
host.parentElement = owner
vExperimentalGlass.mounted(host, {value:false})
assert.equal(glassSurfaces.size, 0)
vExperimentalGlass.updated(host, {value:true, oldValue:false})
const a = animation(owner, 1380) // deliberately exceeds every former fixed delay
vExperimentalGlass.updated(host, {value:false, oldValue:true})
await settle()
assert(glassSurfaces.has(host), 'Ancestor WAAPI motion retains registered optics')
assert([...timers.values()].some(t => t.delay > 1380), 'Watchdog comes from real timing')
vExperimentalGlass.updated(host, {value:true, oldValue:false})
a.finish(); await settle()
assert(glassSurfaces.has(host), 'Old close promise cannot destroy a reopened surface')
assert.equal(timers.size, 0)
const b = animation(owner, 380)
vExperimentalGlass.updated(host, {value:false, oldValue:true})
await settle(); b.cancel(); await settle()
assert(!glassSurfaces.has(host), 'Cancelled exit without replacement completes safely')

vGlassPresence.mounted(owner, {value:false})
assert.equal(owner.dataset.glassPresence, 'closed')
vGlassPresence.updated(owner, {value:true, oldValue:false})
assert.equal(owner.dataset.glassPresence, 'opening')
await settle()
assert.equal(owner.dataset.glassPresence, 'open')
const c = animation(owner, 520)
vGlassPresence.updated(owner, {value:false, oldValue:true})
await settle()
assert.equal(owner.dataset.glassPresence, 'closing')
vGlassPresence.updated(owner, {value:true, oldValue:false})
c.cancel(); await settle()
assert.equal(owner.dataset.glassPresence, 'open', 'Reversal invalidates stale closed state')
vGlassPresence.beforeUnmount(owner)

vExperimentalGlass.updated(host, {value:true, oldValue:false})
const d = animation(owner, 260)
vExperimentalGlass.beforeUnmount(host)
await settle(); vExperimentalGlass.unmounted(host)
assert(glassSurfaces.has(host), 'Vue leaving DOM still owns material even after unmounted hooks')
d.finish(); host.isConnected = false; vExperimentalGlass.unmounted(host); await settle()
assert.equal(glassSurfaces.size, 0)
assert.equal(frames.size, 0); assert.equal(timers.size, 0)
let called = 0
host.isConnected = true
const e = animation(host, 240)
const cancel = afterGlassMotion(host, () => called++)
await settle(); cancel(); e.finish(); await settle()
assert.equal(called, 0); assert.equal(frames.size, 0); assert.equal(timers.size, 0)
assert(notifications > 0)
console.log('PASS real glass lifecycle: finite ancestor motion, >1s exit, reversal, cancellation, reduced/no motion, Vue leave retention and RAF/timer cleanup')
