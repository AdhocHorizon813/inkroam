import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const panel = readFileSync('app/components/AppearancePanel.vue', 'utf8')
const source = panel.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1]
const compiled = ts.transpile(source.replaceAll('import.meta.client', 'false'), { target: ts.ScriptTarget.ES2022 })

function mount(saved) {
  const shared = {}
  const mounted = []
  const watchers = []
  let stored
  const context = vm.createContext({
    ref: value => ({ value }), reactive: value => value,
    useState: (key, init) => shared[key] ||= { value: init() },
    onMounted: callback => mounted.push(callback), onUnmounted: () => {},
    watch: (target, callback) => watchers.push([target, callback]),
    localStorage: {
      getItem: key => key === 'paper-trail-appearance-v5' ? JSON.stringify(saved) : null,
      setItem: (_key, value) => { stored = JSON.parse(value) },
    },
  })
  vm.runInContext(`${compiled}\nglobalThis.testState = state`, context)
  mounted.forEach(callback => callback())
  return { shared, state: context.testState, save: () => {
    watchers.find(([target]) => target === context.testState)[1](context.testState, context.testState)
    return stored
  } }
}

const old = mount({ latestPostCount: 5, accent: '#123456' })
assert.equal(old.shared['latest-post-count'].value, 5)
assert.equal(old.shared['latest-note-count'].value, 10)
old.state.latestNoteCount = 'all'
const saved = old.save()
assert.equal(saved.latestPostCount, 5)
assert.equal(saved.latestNoteCount, 'all')
assert.equal(saved.accent, '#123456')
const restored = mount(saved)
assert.equal(restored.shared['latest-note-count'].value, 'all')
restored.state.latestPostCount = 10
restored.save()
assert.equal(restored.shared['latest-note-count'].value, 'all')
const invalid = mount({ latestPostCount: -1, latestNoteCount: 'bad' })
assert.equal(invalid.shared['latest-post-count'].value, 10)
assert.equal(invalid.shared['latest-note-count'].value, 10)
const home = readFileSync('app/pages/index.vue', 'utf8')
const notes = home.slice(home.indexOf('const visibleNotes'), home.indexOf('const formatDate'))
assert(notes.includes('latestNoteCount.value') && !notes.includes('latestPostCount.value'))
console.log('PASS: independent counts, persistence, old preferences and invalid-value fallback.')
