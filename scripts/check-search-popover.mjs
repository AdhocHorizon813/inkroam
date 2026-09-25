import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const source = readFileSync('app/composables/useSearchPopover.ts', 'utf8').replace(/^import .*$/m, '').replace('export function', 'function')
let watchOpen, cleanup
const listeners = {}
const properties = {}
const open = { value: true }
let rect = { left: 850, top: 100, bottom: 139, width: 300 }
let shown = 0, hidden = 0
const root = { value: { getBoundingClientRect: () => rect } }
const popup = { value: {
  style: { setProperty: (key, value) => { properties[key] = value } },
  firstElementChild: { scrollHeight: 320 },
  showPopover: () => shown++, hidePopover: () => hidden++,
} }
const viewport = { innerHeight: 800, addEventListener: (name, cb) => { listeners[name] = cb }, removeEventListener: name => { delete listeners[name] } }
const doc = { documentElement: { clientWidth: 1200 } }
const context = vm.createContext({ window: viewport, document: doc, setTimeout, clearTimeout,
  nextTick: async () => {}, watch: (_, cb) => { watchOpen = cb }, onMounted: cb => cb(), onBeforeUnmount: cb => { cleanup = cb },
})
vm.runInContext(ts.transpile(source, { target: ts.ScriptTarget.ES2022 }), context)
context.useSearchPopover(root, popup, open, 270)
await watchOpen(true)
assert.equal(shown, 1)
assert.equal(properties['--popup-width'], '300px')
assert.equal(properties['--popup-left'], '850px')
assert.equal(properties['--popup-top'], '145px')
rect = { left: 1000, top: 650, bottom: 689, width: 300 }
listeners.scroll()
assert.equal(properties['--popup-left'], '888px', 'Clamp right edge')
assert.equal(properties['--popup-bottom'], '156px', 'Flip above near bottom')
assert.equal(properties['--popup-top'], 'auto')
doc.documentElement.clientWidth = 320
rect = { left: 170, top: 100, bottom: 139, width: 130 }
listeners.resize()
assert.equal(properties['--popup-width'], '270px')
assert.equal(properties['--popup-left'], '38px', 'Keep mobile calendar within viewport')
open.value = false
await watchOpen(false)
await new Promise(resolve => setTimeout(resolve, 210))
assert.equal(hidden, 1, 'Finish closing animation before leaving top layer')
cleanup()
assert.equal(Object.keys(listeners).length, 0)
const css = readFileSync('app/assets/css/main.css', 'utf8')
assert.match(css, /html \{[^}]*overflow-y: scroll/)
assert.match(css, /scrollbar-color: var\(--scrollbar-thumb\) transparent/)
assert.doesNotMatch(css, /html::-webkit-scrollbar/, 'Viewport uses the shared TOC scrollbar style')
assert.match(css, /:root\[data-visual='modern'\] body \{[^}]*overflow-x: clip/s, 'Body must not capture sticky scrolling')
assert.doesNotMatch(css, /\.site-header \{ position: relative; top: 0/, 'Landscape header remains sticky')
assert.match(css, /\.search-popover\[popover\]/)
const advanced = readFileSync('app/components/SearchAdvanced.vue', 'utf8')
assert.match(advanced, /advanced-clear.is-empty \{ visibility: hidden/)
for (const name of ['SearchFilterSelect', 'SearchDatePicker']) {
  const component = readFileSync(`app/components/${name}.vue`, 'utf8')
  assert.match(component, /popover="manual"/)
  assert.match(component, /height: 39px/)
  assert.match(component, /border-radius: 10px/)
}
console.log('PASS: top-layer lifecycle, scroll/resize geometry, mobile/right-edge clamping, bottom flipping and layout contracts. No real browser pixel measurements.')
