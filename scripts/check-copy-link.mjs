import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const source = readFileSync('app/components/CopyArticleLink.vue', 'utf8')
const script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1]
const compiled = ts.transpile(script, { target: ts.ScriptTarget.ES2022 })
async function test(href, clipboard, expected, failed = false) {
  let focused = false
  let selected = false
  const context = vm.createContext({ URL, ref: value => ({ value }), nextTick: async () => {}, window: { location: { href } }, navigator: { clipboard } })
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
