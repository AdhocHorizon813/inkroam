import { setupForVm } from './lib/vm-source.mjs'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const source = readFileSync('app/components/PdfCanvasReader.vue', 'utf8')
const code = ts.transpile(setupForVm(source), { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS })
function createReader(saved, documentPromise) {
  let mounted, unmount, stored
  const events = []
  const fakePdf = { numPages: 20, getPage: async () => ({ rotate: 0, getViewport: ({ scale }) => ({ width: 600 * scale, height: 800 * scale }), render: () => ({ promise: Promise.resolve(), cancel() {} }) }) }
  const workerOptions = {}
  const workerUrl = '/inkroam/assets/test-pdf-worker.mjs'
  let loads = 0, destroys = 0
  const pdfjs = {
    GlobalWorkerOptions: workerOptions,
    getDocument({ url }) {
      assert.equal(url, '/pdfs/test.pdf')
      assert.equal(workerOptions.workerSrc, workerUrl)
      loads++
      return { promise: documentPromise ?? Promise.resolve(fakePdf), destroy() { destroys++ } }
    },
  }
  const context = vm.createContext({
    require(id) {
      if (id === 'pdfjs-dist') return pdfjs
      if (id === 'pdfjs-dist/build/pdf.worker.min.mjs?url') return { default: workerUrl }
      throw new Error('Unexpected PDF dependency: ' + id)
    },
    defineProps: () => ({ src: '/pdfs/test.pdf' }), defineEmits: () => event => events.push(event),
    ref: value => ({ value }), computed: fn => ({ get value() { return fn() } }), nextTick: async () => {},
    onMounted: fn => { mounted = fn }, onBeforeUnmount: fn => { unmount = fn },
    ResizeObserver: class { observe() {} disconnect() {} }, window: { devicePixelRatio: 1 },
    localStorage: { getItem: () => saved, setItem: (key, value) => { stored = { key, value: JSON.parse(value) } } },
  })
  vm.runInContext(`${code}\nglobalThis.state = { jumpToPage, go, changeZoom, resetZoom, rotatePage, onTouchStart, onTouchEnd, onReaderKeydown, status, pageNumber, pageInput, zoom, rotation, notice, canvas, frame }`, context)
  const state = context.state
  state.canvas.value = { style: {} }
  state.frame.value = { clientWidth: 400, scrollTo() {} }
  return { state, events, mounted, unmount, get loads() { return loads }, get destroys() { return destroys }, get stored() { return stored } }
}
async function mount(saved) {
  const reader = createReader(saved)
  assert.equal(reader.loads, 0)
  await reader.mounted()
  assert.equal(reader.loads, 1)
  assert.equal(reader.state.status.value, 'ready')
  return reader
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
const focused = {}
function key(key, options = {}) {
  let prevented = false
  s.onReaderKeydown({ key, target: focused, currentTarget: focused, preventDefault() { prevented = true }, ...options })
  return prevented
}
s.jumpToPage(8)
for (const modifier of ['altKey', 'ctrlKey', 'metaKey', 'shiftKey', 'isComposing', 'defaultPrevented']) {
  for (const command of ['ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown']) {
    assert.equal(key(command, { [modifier]: true }), false, `${modifier} shortcut must pass through`)
    assert.equal(s.pageNumber.value, 8)
  }
}
assert.equal(key('ArrowRight', { target: {} }), false, 'Nested editable/control targets are not intercepted')
assert.equal(key('PageDown'), true); assert.equal(s.pageNumber.value, 9)
assert.equal(key('PageUp'), true); assert.equal(s.pageNumber.value, 8)
assert.equal(key('Home'), true); assert.equal(s.pageNumber.value, 1)
assert.equal(key('End'), true); assert.equal(s.pageNumber.value, 20)
assert.equal(key('ArrowRight'), true); assert.equal(s.pageNumber.value, 20)
assert.equal(key('Escape'), false)
s.status.value = 'loading'
assert.equal(key('Home'), false); assert.equal(s.pageNumber.value, 20)
s.status.value = 'ready'
assert.match(source, /@keydown="onReaderKeydown"/)
assert.doesNotMatch(source, /@keydown\.(?:left|right|home|end)\.prevent/)
reader.unmount()
assert.equal(reader.destroys, 1)
const early = createReader(null)
const opening = early.mounted()
early.unmount()
await opening
assert.equal(early.loads, 0, 'Leaving before the worker import resolves skips the document request')
const deferred = Promise.withResolvers()
const interrupted = createReader(null, deferred.promise)
const loading = interrupted.mounted()
await new Promise(resolve => setImmediate(resolve))
assert.equal(interrupted.loads, 1)
interrupted.unmount()
deferred.reject(new Error('Loading task destroyed'))
await loading
assert.equal(interrupted.destroys, 1)
assert.deepEqual(interrupted.events, [], 'A disposed reader must not emit a fallback error')
const failure = createReader(null, Promise.reject(new Error('Document unavailable')))
await failure.mounted()
assert.equal(failure.state.status.value, 'error')
assert.deepEqual(failure.events, ['failed'])
failure.unmount()
const bad = await mount('{broken')
assert.equal(bad.state.pageNumber.value, 1)
bad.unmount()
const bounded = await mount(JSON.stringify({ page: 999, zoom: 99, rotation: 12 }))
assert.equal(bounded.state.pageNumber.value, 20)
assert.equal(bounded.state.zoom.value, 4)
assert.equal(bounded.state.rotation.value, 0)
bounded.unmount()
console.log('PASS: PDF worker setup, load errors, disposal before and during loading, jump bounds, progress restore, corrupt storage, rotation, zoom/swipe, keyboard paging and browser-shortcut pass-through (mock renderer).')
