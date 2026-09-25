import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const source = readFileSync('app/components/PdfCanvasReader.vue', 'utf8')
const script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1]
  .replace(/import type[^\n]+\n/, '')
  .replace(/async function openDocument\(\) \{[\s\S]*?\n\}/, 'async function openDocument() { return fakePdf }')
const code = ts.transpile(script, { target: ts.ScriptTarget.ES2022 })
async function mount(saved) {
  let mounted, unmount, stored
  const events = []
  const fakePdf = { numPages: 20, getPage: async () => ({ rotate: 0, getViewport: ({ scale }) => ({ width: 600 * scale, height: 800 * scale }), render: () => ({ promise: Promise.resolve(), cancel() {} }) }) }
  const context = vm.createContext({
    fakePdf, defineProps: () => ({ src: '/pdfs/test.pdf' }), defineEmits: () => event => events.push(event),
    ref: value => ({ value }), computed: fn => ({ get value() { return fn() } }), nextTick: async () => {},
    onMounted: fn => { mounted = fn }, onBeforeUnmount: fn => { unmount = fn },
    ResizeObserver: class { observe() {} disconnect() {} }, window: { devicePixelRatio: 1 },
    localStorage: { getItem: () => saved, setItem: (key, value) => { stored = { key, value: JSON.parse(value) } } },
  })
  vm.runInContext(`${code}\nglobalThis.state = { jumpToPage, go, changeZoom, resetZoom, rotatePage, onTouchStart, onTouchEnd, pageNumber, pageInput, zoom, rotation, notice, canvas, frame }`, context)
  const state = context.state
  state.canvas.value = { style: {} }
  state.frame.value = { clientWidth: 400, scrollTo() {} }
  await mounted()
  return { state, events, unmount, get stored() { return stored } }
}
const reader = await mount(JSON.stringify({ page: 8, zoom: 2, rotation: 90 }))
const s = reader.state
assert.equal(s.pageNumber.value, 8)
assert.equal(s.zoom.value, 2)
assert.equal(s.rotation.value, 90)
s.jumpToPage(0)
assert.equal(s.pageNumber.value, 8)
s.jumpToPage(21)
assert.equal(s.pageNumber.value, 8)
s.jumpToPage(4.5)
assert.equal(s.pageNumber.value, 8)
s.jumpToPage(20)
s.go(1)
assert.equal(s.pageNumber.value, 20)
assert.equal(reader.stored.value.page, 20)
s.rotatePage()
assert.equal(s.rotation.value, 180)
s.onTouchStart({ touches: [{ clientX: 100, clientY: 0 }] })
s.onTouchEnd({ changedTouches: [{ clientX: 200, clientY: 0 }] })
assert.equal(s.pageNumber.value, 20, 'Zoomed pan must not turn page')
s.resetZoom()
s.onTouchStart({ touches: [{ clientX: 100, clientY: 0 }] })
s.onTouchEnd({ changedTouches: [{ clientX: 200, clientY: 0 }] })
assert.equal(s.pageNumber.value, 19)
for (let i = 0; i < 20; i++) s.changeZoom(1)
assert.equal(s.zoom.value, 4)
for (let i = 0; i < 30; i++) s.changeZoom(-1)
assert.equal(s.zoom.value, .5)
reader.unmount()
const bad = await mount('{broken')
assert.equal(bad.state.pageNumber.value, 1)
bad.unmount()
const bounded = await mount(JSON.stringify({ page: 999, zoom: 99, rotation: 12 }))
assert.equal(bounded.state.pageNumber.value, 20)
assert.equal(bounded.state.zoom.value, 4)
assert.equal(bounded.state.rotation.value, 0)
bounded.unmount()
console.log('PASS: PDF jump bounds, progress restore, corrupt storage, rotation, zoom bounds and zoomed swipe suppression (mock renderer).')
