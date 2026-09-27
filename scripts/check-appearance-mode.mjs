import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { ref, reactive, computed, watch, nextTick, effectScope } from 'vue'
import { decodeAppearanceStorage } from '../app/utils/appearance-storage.ts'

const panel = readFileSync('app/components/AppearancePanel.vue', 'utf8')
const script = panel.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1]
const compiled = ts.transpile(script.replace("import { supportsEmbeddedPdf } from '~/utils/pdf-embed'", '').replace("import { decodeAppearanceStorage } from '~/utils/appearance-storage'", '').replaceAll('import.meta.client', 'true'), { target: ts.ScriptTarget.ES2022 })
async function mount(saved, dark = false) {
  const mounted = [], cleanup = [], shared = {}, media = { matches: dark, addEventListener() {}, removeEventListener() {} }
  const root = { dataset: {}, style: { setProperty() {}, removeProperty() {} } }
  let stored
  const context = vm.createContext({ ref, reactive, computed, watch, nextTick,
    decodeAppearanceStorage,
    supportsEmbeddedPdf: () => false, onMounted: fn => mounted.push(fn), onUnmounted: fn => cleanup.push(fn),
    useState: (key, init) => shared[key] ||= ref(init()),
    window: { matchMedia: () => media }, document: { documentElement: root },
    localStorage: { getItem: key => key === 'paper-trail-appearance-v5' && saved ? JSON.stringify(saved) : null,
      setItem: (_, value) => { stored = JSON.parse(value) }, removeItem() {} },
  })
  const scope = effectScope()
  scope.run(() => vm.runInContext(`${compiled}\nglobalThis.exposed = { state, onSystemThemeChange, requestDefaultSettings, confirmDefaultSettings };`, context))
  mounted.forEach(fn => fn())
  await nextTick()
  return { ...context.exposed, root, stored: () => stored,
    system: async value => { media.matches = value; context.exposed.onSystemThemeChange(); await nextTick() },
    stop: () => { cleanup.forEach(fn => fn()); scope.stop() },
  }
}
const controlled = ['navMaterial','contentMaterial','dropdownMaterial','backgroundMaterial','navBlur','contentBlur','dropdownBlur','backgroundBlur','backgroundOverlay']
const values = state => controlled.map(key => state[key])
const light = ['liquid','liquid','liquid','liquid',14,5,4,0,40]
const dark = ['mica','mica','mica','mica',12,10,12,4,40]
const app = await mount(null)
try {
  assert.deepEqual(values(app.state), light)
  for (const [mode, expected] of [['dark', dark], ['light', light], ['dark', dark], ['auto', light]]) {
    app.state.colorMode = mode
    await nextTick()
    assert.deepEqual(values(app.state), expected, `Manual ${mode} applies the complete preset`)
    assert.deepEqual(values(app.stored()), expected, 'Persisted controls match the UI')
    assert.equal(app.state.background, 'auto')
    assert.equal(app.root.dataset.colorMode, mode === 'auto' ? 'light' : mode)
  }
  await app.system(true)
  assert.deepEqual(values(app.state), dark)
  app.state.colorMode = 'light'
  await nextTick()
  app.state.colorMode = 'auto'
  await nextTick()
  assert.deepEqual(values(app.state), dark, 'Auto uses the current system appearance')
  app.state.colorMode = 'light'
  app.state.colorMode = 'dark'
  app.state.colorMode = 'light'
  await nextTick()
  assert.deepEqual(values(app.state), light, 'Rapid changes settle to the final mode')
} finally { app.stop() }
const manual = await mount({ colorMode: 'dark', defaultSettings: false, navBlur: 31, contentBlur: 23, dropdownBlur: 17, backgroundBlur: 2, backgroundOverlay: 63, navMaterial: 'acrylic', background: 'custom', backgroundPicked: true, accent: '#c45b45', backgroundTint: false })
try {
  const before = values(manual.state)
  for (const mode of ['light', 'dark', 'auto']) {
    manual.state.colorMode = mode
    await nextTick()
    assert.deepEqual(values(manual.state), before, 'Disabled defaults preserve all manual controls')
    assert.equal(manual.state.background, 'custom')
    assert.equal(manual.state.accent, '#c45b45')
    assert.equal(manual.state.backgroundTint, false)
  }
  await manual.system(true)
  assert.deepEqual(values(manual.state), before)
  manual.requestDefaultSettings(true)
  manual.confirmDefaultSettings()
  await nextTick()
  assert.deepEqual(values(manual.state), dark)
  manual.state.colorMode = 'light'
  await nextTick()
  assert.deepEqual(values(manual.state), light)
  assert.equal(manual.state.backgroundTint, false, 'Independent options remain untouched')
} finally { manual.stop() }
console.log('PASS: real Vue watchers apply manual/system light-dark-auto presets, persist final values and preserve unmanaged preferences. No browser visuals tested.')
