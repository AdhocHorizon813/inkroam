import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'
import { glassSurfaces, GLASS_SURFACES_CHANGED, vExperimentalGlass } from '../app/utils/glass-surfaces.ts'

// Registration lifecycle only; deliberately no browser or optical claims.
globalThis.window = new EventTarget()
let notifications = 0
window.addEventListener(GLASS_SURFACES_CHANGED, () => notifications++)
const host = {}
vExperimentalGlass.mounted(host, { value: false })
assert.equal(glassSurfaces.size, 0, 'closed panels do not register')
vExperimentalGlass.updated(host, { value: true, oldValue: false })
assert.equal(glassSurfaces.size, 1)
vExperimentalGlass.updated(host, { value: true, oldValue: true })
assert.equal(notifications, 1, 'unrelated component updates do not resync')
vExperimentalGlass.updated(host, { value: false, oldValue: true })
assert.equal(glassSurfaces.size, 1, 'retain material through closing animation')
vExperimentalGlass.updated(host, { value: true, oldValue: false })
await delay(350)
assert.equal(glassSurfaces.size, 1, 'reopen cancels pending teardown')
vExperimentalGlass.updated(host, { value: false, oldValue: true })
await delay(350)
assert.equal(glassSurfaces.size, 0, 'closed panel releases registration')
vExperimentalGlass.updated(host, { value: true, oldValue: false })
vExperimentalGlass.updated(host, { value: false, oldValue: true })
vExperimentalGlass.beforeUnmount(host)
const afterUnmount = notifications
await delay(350)
assert.equal(glassSurfaces.size, 0)
assert.equal(notifications, afterUnmount + 1, 'unmount releases after the leave animation')
delete globalThis.window
console.log('PASS experimental glass surface registration/close/reopen/unmount')
