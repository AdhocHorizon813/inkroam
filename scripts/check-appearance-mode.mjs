import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { ref, reactive, computed, watch, nextTick, effectScope } from 'vue'
import { decodeAppearanceStorage } from '../app/utils/appearance-storage.ts'

const panel = readFileSync('app/components/AppearancePanel.vue', 'utf8')
const script = panel.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1]
const compiled = ts.transpile(script.replace("import { supportsEmbeddedPdf } from '~/utils/pdf-embed'", '').replace("import { decodeAppearanceStorage } from '~/utils/appearance-storage'", '').replace("import { usePageScrollable } from '~/composables/usePageScrollable'", '').replaceAll('import.meta.client', 'true'), { target: ts.ScriptTarget.ES2022 })
async function mount(saved, dark = false, options = {}) {
  const mounted = [], cleanup = [], shared = {}, media = { matches: dark, addEventListener() {}, removeEventListener() {} }
  const root = { dataset: {}, style: { setProperty() {}, removeProperty() {} } }
  let stored
  const reads = []
  const context = vm.createContext({ ref, reactive, computed, watch, nextTick,
    decodeAppearanceStorage,
    /* 面板自绘滑条的组合式函数要真 DOM 与滚动事件，本套件不测滚动，桩成空实现。 */
    usePageScrollable: () => ({}),
    supportsEmbeddedPdf: () => false, onMounted: fn => mounted.push(fn), onUnmounted: fn => cleanup.push(fn),
    useState: (key, init) => shared[key] ||= ref(init()),
    window: { matchMedia: () => media }, document: { documentElement: root },
    localStorage: { getItem: key => {
      reads.push(key)
      if (options.blockStorage) throw new Error('Storage unavailable')
      if (key === 'paper-trail-appearance-v5') return options.raw ?? (saved ? JSON.stringify(saved) : null)
      if (key === 'paper-trail-appearance-v4') return options.legacy ?? null
      return null
    },
      setItem: (_, value) => { stored = JSON.parse(value) }, removeItem() {} },
  })
  const scope = effectScope()
  scope.run(() => vm.runInContext(`${compiled}\nglobalThis.exposed = { state, status, isOpen, panelScroll, initialState: { ...state }, normalizeStoredAppearance, onSystemThemeChange, requestDefaultSettings, confirmDefaultSettings };`, context))
  mounted.forEach(fn => fn())
  await nextTick()
  return { ...context.exposed, root, shared, reads, stored: () => stored,
    system: async value => { media.matches = value; context.exposed.onSystemThemeChange(); await nextTick() },
    stop: () => { cleanup.forEach(fn => fn()); scope.stop() },
  }
}
const controlled = ['navMaterial','contentMaterial','dropdownMaterial','backgroundMaterial','navBlur','contentBlur','dropdownBlur','backgroundBlur','backgroundOverlay','codeMaterial','codeBlur','diagramScale']
const values = state => controlled.map(key => state[key])
const light = ['liquid','liquid','liquid','liquid',14,5,4,0,40,'liquid',5,75]
const dark = ['mica','mica','mica','mica',12,10,12,4,40,'mica',10,75]
const app = await mount(null)
try {
  app.panelScroll.value = { scrollTop: 640 }
  for (const open of [true, false, true, false, true]) {
    app.isOpen.value = open
    await nextTick()
    await nextTick()
    assert.equal(app.panelScroll.value.scrollTop, 640, 'Reopening preserves the settings scroll position')
  }
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

// Freeze initialization semantics before moving normalization out of reactive state.
// Assertions cover the mounted component and real watcher flush, not only the decoder.
const cases = [
  { saved: { codeMaterial: 'invalid', codeBlur: -10 }, expected: { codeMaterial: 'mica', codeBlur: 0 } },
  { saved: { codeBlur: 99 }, expected: { codeBlur: 48 } },
  { saved: { codeBlur: '24' }, expected: { codeBlur: 10 } },
  { saved: {}, expected: { defaultSettings: false, navMaterial: 'mica', navBlur: 12, background: 'auto' } },
  { saved: { defaultSettings: 'true', backgroundTint: 'false' }, expected: { defaultSettings: false, backgroundTint: true } },
  { saved: { dropdownMaterial: 'invalid', dropdownBlur: -10 }, expected: { dropdownMaterial: 'mica', dropdownBlur: 0 } },
  { saved: { dropdownBlur: 99 }, expected: { dropdownBlur: 48 } },
  { saved: { dropdownBlur: '24' }, expected: { dropdownBlur: 12 } },
  { saved: { latestPostCount: 999, latestNoteCount: '5', pdfFallback: 'invalid' }, expected: { latestPostCount: 10, latestNoteCount: 10, pdfFallback: 'card' } },
  { saved: { latestPostCount: 5, latestNoteCount: 'all', pdfFallback: 'reader' }, expected: { latestPostCount: 5, latestNoteCount: 'all', pdfFallback: 'reader' } },
  { saved: { background: 'art' }, expected: { background: 'auto' } },
  { saved: { background: 'art', backgroundPicked: true }, expected: { background: 'art' } },
  { saved: { background: 'invalid' }, expected: { background: 'auto' } },
  { saved: { defaultSettings: true, colorMode: 'light', navBlur: 31, background: 'custom', backgroundTint: false }, dark: true,
    expected: { navBlur: 14, contentBlur: 5, background: 'auto', backgroundPicked: false, backgroundTint: false } },
  { saved: null, options: { legacy: '{"blur":23,"background":"art","latestPostCount":5}' },
    expected: { defaultSettings: false, navBlur: 23, contentBlur: 23, dropdownBlur: 23, latestPostCount: 5, background: 'auto' } },
  { saved: { navBlur: 19 }, options: { legacy: '{broken' }, expected: { navBlur: 19 }, noLegacyRead: true },
]
for (const fixture of cases) {
  const instance = await mount(fixture.saved, fixture.dark, fixture.options)
  try {
    for (const [key, value] of Object.entries(fixture.expected)) assert.equal(instance.state[key], value, `Initialization: ${key}`)
    assert.equal(instance.shared['latest-post-count'].value, instance.state.latestPostCount)
    assert.equal(instance.shared['latest-note-count'].value, instance.state.latestNoteCount)
    assert.equal(instance.shared['pdf-fallback'].value, instance.state.pdfFallback)
    assert.equal(instance.status.value, '')
    if (fixture.noLegacyRead) assert.ok(!instance.reads.includes('paper-trail-appearance-v4'))
  } finally { instance.stop() }
}
for (const options of [{ raw: '{broken' }, { blockStorage: true }]) {
  const instance = await mount(null, false, options)
  try {
    assert.equal(instance.status.value, '外观偏好未能读取，已使用默认设置。')
    // Existing catch retains legacy initial controls; do not silently "fix" during extraction.
    assert.equal(instance.state.navBlur, 12)
    assert.equal(instance.state.navMaterial, 'mica')
    assert.equal(instance.root.dataset.colorMode, 'light')
  } finally { instance.stop() }
}
console.log('PASS: mounted storage normalization, legacy defaults, managed overrides, shared preferences, lazy v4 access and failed-storage fallback.')

// Frozen pre-extraction rules. Keep this separate from the production helper.
function originalNormalize(state, stored, systemDark) {
  if (stored) { Object.assign(state, stored); state.defaultSettings = stored.defaultSettings === true }
  else state.defaultSettings = true
  if (state.defaultSettings) {
    const mode = state.colorMode === 'auto' ? (systemDark ? 'dark' : 'light') : state.colorMode
    Object.assign(state, Object.fromEntries(controlled.map((key, i) => [key, (mode === 'dark' ? dark : light)[i]])))
    state.background = 'auto'; state.backgroundPicked = false
  }
  if (typeof state.backgroundTint !== 'boolean') state.backgroundTint = true
  if (!['liquid', 'acrylic', 'mica'].includes(state.dropdownMaterial)) state.dropdownMaterial = 'mica'
  if (!Number.isFinite(state.dropdownBlur)) state.dropdownBlur = 12
  state.dropdownBlur = Math.max(0, Math.min(48, state.dropdownBlur))
  if (state.latestPostCount !== 5 && state.latestPostCount !== 10 && state.latestPostCount !== 'all') state.latestPostCount = 10
  if (state.latestNoteCount !== 5 && state.latestNoteCount !== 10 && state.latestNoteCount !== 'all') state.latestNoteCount = 10
  if (state.pdfFallback !== 'card' && state.pdfFallback !== 'reader') state.pdfFallback = 'card'
  if (!state.backgroundPicked && state.background === 'art') state.background = 'auto'
  if (!['auto', 'flat', 'theme', 'aurora', 'art', 'dusk', 'custom'].includes(state.background)) state.background = 'auto'
  if (!Number.isFinite(state.diagramScale)) state.diagramScale = 75
  state.diagramScale = Math.round(Math.max(0, Math.min(100, state.diagramScale)))
  return state
}
const probe = await mount(null)
const plain = value => JSON.parse(JSON.stringify(value))
let comparisons = 0
try {
  const initial = Object.freeze(plain(probe.initialState))
  for (const systemDark of [false, true]) {
    for (const enabled of [undefined, false, true, 'true']) {
      for (const mode of ['auto', 'light', 'dark']) {
        // New code controls are covered above; the frozen oracle predates them.
        for (const variant of cases.map(fixture => fixture.saved).filter(Boolean).filter(value => !('codeMaterial' in value || 'codeBlur' in value))) {
          const saved = Object.freeze({ ...variant, colorMode: mode, defaultSettings: enabled })
          const result = probe.normalizeStoredAppearance(initial, saved, systemDark)
          assert.deepEqual(plain(result), plain(originalNormalize({ ...initial }, saved, systemDark)))
          assert.notEqual(result, initial, 'Normalization returns a detached snapshot')
          comparisons++
        }
      }
    }
    for (const saved of [null, false, 0, '', 'text', [], { extraFutureKey: 7 }]) {
      assert.deepEqual(plain(probe.normalizeStoredAppearance(initial, saved, systemDark)), plain(originalNormalize({ ...initial }, saved, systemDark)))
      comparisons++
    }
  }
  // Count synchronous reactive invalidations, not renders: normal watchers batch.
  const fixture = { colorMode: 'light', defaultSettings: true, navBlur: 31, contentBlur: 25, dropdownBlur: 40, background: 'custom', backgroundPicked: true }
  const oldState = reactive({ ...initial }), newState = reactive({ ...initial })
  let before = 0, after = 0
  const stopOld = watch(oldState, () => { before++ }, { flush: 'sync' })
  const stopNew = watch(newState, () => { after++ }, { flush: 'sync' })
  try {
    originalNormalize(oldState, fixture, false)
    Object.assign(newState, probe.normalizeStoredAppearance(newState, fixture, false))
    assert.deepEqual(plain(newState), plain(oldState))
    assert.ok(after < before, 'Temporary stored values no longer invalidate reactive state')
    console.log(`Initialization fixture: synchronous reactive invalidations ${before} -> ${after}; not render counts or load-time measurements.`)
  } finally { stopOld(); stopNew() }
} finally { probe.stop() }
console.log(`PASS: ${comparisons} old/new normalization comparisons, frozen inputs and detached results.`)
