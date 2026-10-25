import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { passageUrl, selectedPassage } from '../app/utils/passage-link.ts'

const source = readFileSync('app/components/CopyArticleLink.vue', 'utf8')
const script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1]
// The component's selection/status contract is independent of the platform
// clipboard adapter; its actual sync/API/timeout paths are tested separately.
const compiled = ts.transpile('function copyTextOnGesture(text) { return navigator.clipboard.writeText(text) }\n' + script.replace(/^import .*$/gm, ''), { target: ts.ScriptTarget.ES2022 })
const hooks = { onMounted() {}, onBeforeUnmount() {}, defineProps: () => ({ feedback: false }), clearTimeout, setTimeout, passageUrl, selectedPassage }
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

// Only the toolbar opts into the code button's timed inline feedback.
let resetId = 0, toolbarCleanup, copyFailure = false
const resets = new Map()
const toolbarContext = vm.createContext({
  ...hooks, URL, ref: value => ({ value }), nextTick: async () => {},
  defineProps: () => ({ feedback: true }),
  setTimeout: (callback, delay) => { assert.equal(delay, 2400); resets.set(++resetId, callback); return resetId },
  clearTimeout: id => resets.delete(id),
  onBeforeUnmount: callback => { toolbarCleanup = callback },
  document: { removeEventListener() {} },
  window: { location: { href: 'https://example.com/inkroam/posts/a' } },
  navigator: { clipboard: { writeText: async () => { if (copyFailure) throw new Error('Permission denied') } } },
})
vm.runInContext(`${compiled}\nglobalThis.state = { copyLink, copied, manualLink };`, toolbarContext)
const toolbar = toolbarContext.state
await toolbar.copyLink()
assert.equal(toolbar.copied.value, true)
assert.equal(resets.size, 1)
await toolbar.copyLink()
assert.equal(resets.size, 1, 'Repeated copy restarts one reset timer')
resets.get(resetId)(); resets.delete(resetId)
assert.equal(toolbar.copied.value, false, 'Toolbar label returns after the code button timeout')
copyFailure = true
await toolbar.copyLink()
assert.equal(toolbar.copied.value, false)
assert.equal(toolbar.manualLink.value, 'https://example.com/inkroam/posts/a')
assert.equal(resets.size, 0, 'Failure retains manual fallback instead of a success timer')
copyFailure = false
await toolbar.copyLink(); toolbarCleanup()
assert.equal(resets.size, 0, 'Unmount clears pending feedback')
assert.match(source, /<Transition name="code-label">/)
console.log('PASS: toolbar-only copied label, 2400ms reset, repeated copy, failure fallback and timer teardown.')

// Exercise the real platform adapter, including a native Promise that never
// settles (observed while browser automation was attached).
const adapter = ts.transpile(readFileSync('app/utils/clipboard.ts', 'utf8').replace(/export /g, ''), { target: ts.ScriptTarget.ES2022 })
async function adapterCase(write, syncResult, expire = false) {
  const timers = new Map(), actions = []
  let field, commandValue
  const savedRange = { cloneRange() { return this } }
  const selection = { rangeCount: 1, getRangeAt: () => savedRange, removeAllRanges: () => actions.push('clear'), addRange: range => { assert.equal(range, savedRange); actions.push('restore') } }
  const sandbox = vm.createContext({ navigator: { clipboard: write ? { writeText: write } : undefined },
    document: {
      activeElement: { focus: () => actions.push('focus restored') }, getSelection: () => selection,
      createElement: () => (field = { style: {}, setAttribute() {}, focus() {}, select: () => actions.push('selected'), remove: () => actions.push('removed') }),
      body: { append() {} }, execCommand: command => { assert.equal(command, 'copy'); assert(actions.includes('selected')); commandValue = field.value; return syncResult },
    },
    setTimeout: (callback, delay) => { assert.equal(delay, 3500); timers.set(1, callback); return 1 }, clearTimeout: id => timers.delete(id),
  })
  vm.runInContext(`${adapter}\nglobalThis.copy = copyTextOnGesture`, sandbox)
  const operation = sandbox.copy('https://example.com/inkroam/posts/a#part')
  if (expire) timers.get(1)()
  let error
  try { await operation } catch (caught) { error = caught }
  assert.equal(timers.size, 0)
  if (commandValue) {
    assert.equal(commandValue, 'https://example.com/inkroam/posts/a#part')
    assert.deepEqual(actions.slice(-4), ['removed', 'focus restored', 'clear', 'restore'])
  }
  return { error, commandValue }
}
assert.equal((await adapterCase(async () => {}, false)).commandValue, undefined, 'Normal successful API never invokes legacy command')
assert.equal((await adapterCase(async () => { throw new Error('denied') }, true)).error, undefined)
assert.equal((await adapterCase(undefined, true)).error, undefined)
assert.equal((await adapterCase(() => new Promise(() => {}), true, true)).error, undefined, 'Pending API can recover via synchronous copy')
assert((await adapterCase(() => new Promise(() => {}), false, true)).error, 'Denied fallback reaches the component manual field instead of hanging')
console.log('PASS: real clipboard adapter success, rejection, absent API, pending timeout, synchronous fallback, selection restoration and timer cleanup.')
