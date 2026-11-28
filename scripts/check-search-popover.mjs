import { readSiteStyles } from './lib/site-styles.mjs'
import { Window } from 'happy-dom'
import { vmSource } from './lib/vm-source.mjs'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const source = vmSource(readFileSync('app/composables/useSearchPopover.ts', 'utf8'))
let watchOpen, cleanup
let finishClose, cancelledClose = 0
const listeners = {}
const { document } = new Window()
const open = { value: true }
let rect = { left: 850, top: 100, bottom: 139, width: 300 }
let shown = 0, hidden = 0
const root = { value: { getBoundingClientRect: () => rect } }
const popup = { value: document.createElement('div') }
const surface = document.createElement('div')
surface.className = 'dropdown-surface'
popup.value.appendChild(surface)
Object.defineProperty(surface, 'offsetHeight', { writable: true, value: 320 })
popup.value.showPopover = () => shown++
popup.value.hidePopover = () => hidden++
const viewport = { innerHeight: 800, addEventListener: (name, cb) => { listeners[name] = cb }, removeEventListener: name => { delete listeners[name] } }
const doc = { documentElement: { clientWidth: 1200 } }
const context = vm.createContext({ afterGlassMotion: (_, callback) => {
  finishClose = callback
  return () => { cancelledClose++; finishClose = undefined }
}, window: viewport, document: doc, setTimeout, clearTimeout,
  nextTick: async () => {}, watch: (_, cb) => { watchOpen = cb }, onMounted: cb => cb(), onBeforeUnmount: cb => { cleanup = cb },
})
vm.runInContext(ts.transpile(source, { target: ts.ScriptTarget.ES2022 }), context)
context.useSearchPopover(root, popup, open, 270)
await watchOpen(true)
assert.equal(shown, 1)
assert.equal(popup.value.style.getPropertyValue('--popup-width'), '300px')
assert.equal(popup.value.style.getPropertyValue('--popup-left'), '850px')
assert.equal(popup.value.style.getPropertyValue('--popup-top'), '145px')
assert.equal(popup.value.dataset.flip, 'down', 'Roomy below the field opens downward')
rect = { left: 1000, top: 650, bottom: 689, width: 300 }
listeners.scroll()
assert.equal(popup.value.style.getPropertyValue('--popup-left'), '888px', 'Clamp right edge')
assert.equal(popup.value.style.getPropertyValue('--popup-bottom'), '156px', 'Flip above near bottom')
assert.equal(popup.value.style.getPropertyValue('--popup-top'), 'auto')
assert.equal(popup.value.dataset.flip, 'up', 'Flipped popovers pin the field side')
surface.offsetHeight = 40
listeners.resize()
assert.equal(popup.value.dataset.flip, 'down', 'A short menu fits below the same field')
doc.documentElement.clientWidth = 320
rect = { left: 170, top: 100, bottom: 139, width: 130 }
listeners.resize()
assert.equal(popup.value.style.getPropertyValue('--popup-width'), '270px')
assert.equal(popup.value.style.getPropertyValue('--popup-left'), '38px', 'Keep mobile calendar within viewport')
open.value = false
await watchOpen(false)
assert.equal(hidden, 0, 'Keep top-layer ownership through exit')
finishClose()
assert.equal(hidden, 1, 'Finish closing animation before leaving top layer')
cleanup()
assert.equal(Object.keys(listeners).length, 0)
const css = readSiteStyles()
assert.match(css, /html \{[^}]*overflow-y: scroll/)
assert.match(css, /scrollbar-color: var\(--scrollbar-thumb\) transparent/)
assert.doesNotMatch(css, /html::-webkit-scrollbar/, 'Viewport uses the shared TOC scrollbar style')
assert.match(css, /:root\[data-visual='modern'\] body \{[^}]*overflow-x: clip/s, 'Body must not capture sticky scrolling')
assert.match(css, /\.page-scroll \{[\s\S]*?overflow-y: scroll/, 'Classic scrollbar gutter stays inside the painted area via .page-scroll')
assert.doesNotMatch(css, /\.site-header \{ position: relative; top: 0/, 'Landscape header remains sticky')
assert.match(css, /\.search-popover\[popover\]/)
assert.match(css, /:root \.search-popover\[popover\] \{[\s\S]*?height: auto;/, 'Pin a content-driven height instead of the UA fit-content')
assert.match(css, /\.search-popover\[popover\]\[data-flip='up'\] \{ align-content: end; \}/, 'Flip-up popovers keep the clipping row on the field edge')
assert.match(css, /\.search-popover\[popover\]\[data-flip='up'\] > :first-child \{[\s\S]*?justify-content: flex-end;/, 'Flip-up popovers anchor their content to the field edge')
const advanced = readFileSync('app/components/SearchAdvanced.vue', 'utf8')
assert.match(advanced, /advanced-clear.is-empty \{ visibility: hidden/)
for (const name of ['SearchFilterSelect', 'SearchDatePicker']) {
  const component = readFileSync(`app/components/${name}.vue`, 'utf8')
  assert.match(component, /popover="manual"/)
  assert.match(component, /height: 39px/)
  assert.match(component, /border-radius: 10px/)
}
console.log('PASS: top-layer lifecycle, scroll/resize geometry, mobile/right-edge clamping, bottom flipping and layout contracts. No real browser pixel measurements.')
