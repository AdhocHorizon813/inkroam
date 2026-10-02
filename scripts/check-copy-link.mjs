import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { passageUrl, selectedPassage } from '../app/utils/passage-link.ts'

const source = readFileSync('app/components/CopyArticleLink.vue', 'utf8')
const script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1]
const compiled = ts.transpile(script.replace(/import[^\n]+\n/, ''), { target: ts.ScriptTarget.ES2022 })
const hooks = { onMounted() {}, onBeforeUnmount() {}, passageUrl, selectedPassage }
async function test(href, clipboard, expected, failed = false) {
  let focused = false
  let selected = false
  const context = vm.createContext({ ...hooks, URL, ref: value => ({ value }), nextTick: async () => {}, window: { location: { href } }, navigator: { clipboard } })
  vm.runInContext(`${compiled}\nglobalThis.state = { copyLink, status, manualLink, busy, linkField }`, context)
  const state = context.state
  state.linkField.value = { focus: () => { focused = true }, select: () => { selected = true } }
  await state.copyLink()
  assert.equal(state.busy.value, false)
  assert.equal(state.manualLink.value, failed ? expected : '')
  assert.equal(state.status.value, failed ? '未能自动复制，请选择下方链接手动复制。' : '链接已复制。')
  if (failed) assert(focused && selected)
}
for (const path of ['/posts/example', '/inkroam/notes/functional-analysis/example/']) {
  const expected = `https://example.com${path}`
  let copied
  await test(`${expected}?q=private#section`, { writeText: async value => { copied = value } }, expected)
  assert.equal(copied, expected)
  await test(expected, { writeText: async () => { throw new Error('Permission denied') } }, expected, true)
  await test(expected, undefined, expected, true)
}
assert.match(source, /role="status"/)

// Keep one mounted instance: a failed attempt must not poison later attempts.
let release
let calls = 0
let mode = 'pending'
const context = vm.createContext({
  ...hooks,
  URL, ref: value => ({ value }), nextTick: async () => {},
  window: { location: { href: 'https://example.com/inkroam/posts/retry?q=hidden#part' } },
  navigator: { clipboard: { writeText: () => {
    calls++
    if (mode === 'pending') return new Promise(resolve => { release = resolve })
    if (mode === 'fail') return Promise.reject(new Error('Permission denied'))
    return Promise.resolve()
  } } },
})
vm.runInContext(`${compiled}\nglobalThis.state = { copyLink, status, manualLink, busy }`, context)
const state = context.state
const first = state.copyLink()
assert.equal(state.busy.value, true)
await state.copyLink()
assert.equal(calls, 1, 'Double click must not enqueue another clipboard request')
release()
await first
assert.equal(state.busy.value, false)
mode = 'fail'
await state.copyLink()
assert.equal(state.manualLink.value, 'https://example.com/inkroam/posts/retry')
mode = 'success'
await state.copyLink()
assert.equal(state.manualLink.value, '', 'Successful retry clears manual fallback')
assert.equal(state.status.value, '链接已复制。')
assert.equal(state.busy.value, false)

assert.match(source, /readonly/)
assert(readFileSync('app/components/ArticleReader.vue', 'utf8').includes('<CopyArticleLink />'))
console.log('PASS: root/subpath links, query/hash removal, success, rejection, missing API, double-click guard and retry recovery.')

let active = { heading: '基本定义', passage: 'v1-12345678-c' }, copied, mounted, cleanup
const listeners = new Map()
const selectionContext = vm.createContext({
  ...hooks, URL, ref: value => ({ value }), nextTick: async () => {},
  selectedPassage: () => active,
  onMounted: callback => { mounted = callback }, onBeforeUnmount: callback => { cleanup = callback },
  document: { querySelector: () => ({}), addEventListener: (name, callback) => listeners.set(name, callback), removeEventListener: name => listeners.delete(name) },
  window: { location: { href: 'https://example.com/inkroam/posts/a?private=1#old' }, getSelection: () => ({}) },
  navigator: { clipboard: { writeText: async value => { copied = value } } },
})
vm.runInContext(`${compiled}\nglobalThis.state = { copyLink, captureSelection, selection, status };`, selectionContext)
mounted()
const selected = selectionContext.state
assert.equal(selected.selection.value.passage, active.passage)
selected.captureSelection()
active = null; listeners.get('selectionchange')()
await selected.copyLink()
assert.equal(new URL(copied).searchParams.get('passage'), 'v1-12345678-c', 'Pointer snapshot survives native selection collapse')
assert.equal(selected.status.value, '选段链接已复制。')
await selected.copyLink()
assert.equal(copied, 'https://example.com/inkroam/posts/a', 'Consumed snapshot never leaks into a later whole-article copy')
active = { heading: '基本定义' }; listeners.get('selectionchange')()
await selected.copyLink()
assert.equal(new URL(copied).search, '')
assert.equal(decodeURIComponent(new URL(copied).hash.slice(1)), '基本定义')
assert.equal(selected.status.value, '已复制所在章节链接。')
cleanup(); assert.equal(listeners.size, 0)
assert.match(source, /@pointerdown="captureSelection"/)
console.log('PASS: contextual copy, pointer selection capture, one-shot snapshot, section fallback and listener cleanup.')
