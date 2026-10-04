import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { ref, computed } from 'vue'

const source = readFileSync('app/components/DisplayModeSettings.vue', 'utf8')
const code = ts.transpile(source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1], { target: ts.ScriptTarget.ES2022 })
let mounted, cleanup, reject = false, requests = 0
const listeners = new Map()
const root = { dataset: {}, async requestFullscreen() {
  requests++
  if (reject) throw Error('Denied')
  document.fullscreenElement = root
  listeners.get('fullscreenchange')?.()
} }
const document = {
  documentElement: root, fullscreenEnabled: true, fullscreenElement: null,
  async exitFullscreen() { document.fullscreenElement = null; listeners.get('fullscreenchange')?.() },
  addEventListener: (type, fn) => listeners.set(type, fn),
  removeEventListener: type => listeners.delete(type),
}
const context = vm.createContext({ ref, computed, document, onMounted: fn => { mounted = fn }, onUnmounted: fn => { cleanup = fn } })
vm.runInContext(`${code}\nglobalThis.api = { mode, pending, message, supported, selectMode };`, context)
const api = context.api
mounted()
assert.equal(api.mode.value, 'off')
assert.equal(requests, 0, 'No automatic fullscreen request on mount')
await api.selectMode('fullscreen')
assert.equal(api.mode.value, 'fullscreen')
await api.selectMode('focus')
assert.equal(root.dataset.displayMode, 'focus')
assert.equal(requests, 1, 'Switching full/focus does not exit/reenter fullscreen')
await document.exitFullscreen() // browser Escape, not our button
assert.equal(api.mode.value, 'off')
assert.equal(root.dataset.displayMode, 'off')
reject = true
await api.selectMode('focus')
assert.equal(api.mode.value, 'off')
assert(api.message.value)
assert.equal(api.pending.value, false)
reject = false
await api.selectMode('focus')
await api.selectMode('off')
assert.equal(document.fullscreenElement, null)
assert.equal(root.dataset.displayMode, 'off')
document.fullscreenElement = {} // another element's fullscreen is not ours
listeners.get('fullscreenchange')()
assert.equal(api.mode.value, 'off')
cleanup()
assert.equal(listeners.size, 0)
assert.equal(root.dataset.displayMode, undefined)
assert(!source.includes('managedDisabled') && !source.includes('localStorage'), 'Independent of appearance presets; never restore fullscreen automatically')
console.log('PASS: display modes, Escape sync, request rejection, ownership, cleanup and default off. Browser fullscreen UI not tested.')
