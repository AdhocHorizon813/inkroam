import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { PAGE_SCROLLBAR_OFFSET_PROPERTY, PAGE_SCROLLBAR_SIZE_PROPERTY, PAGE_SCROLLABLE_ATTRIBUTE, PAGE_SCROLLABLE_SETTLED_ATTRIBUTE, PAGE_SCROLL_QUERY, pageNeedsScroll } from '../app/utils/page-scroll.ts'

// Execute the actual functions with instrumented CSSOM/dataset stand-ins.
// These count API calls, not browser mutation records, layouts, or frames.
function functions(source, names) {
  const file = ts.createSourceFile('probe.ts', source, ts.ScriptTarget.Latest, true)
  const found = []
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && names.includes(node.name?.text)) found.push(node.getText(file))
    ts.forEachChild(node, visit)
  }
  visit(file)
  assert.equal(found.length, names.length)
  return ts.transpile(found.join('\n'), { target: ts.ScriptTarget.ES2022 })
}
const offsetKey = PAGE_SCROLLBAR_OFFSET_PROPERTY, sizeKey = PAGE_SCROLLBAR_SIZE_PROPERTY
const context = vm.createContext({ MIN_THUMB_SIZE: 40, PAGE_SCROLLBAR_OFFSET_PROPERTY, PAGE_SCROLLBAR_SIZE_PROPERTY })
const sync = vm.runInContext(functions(readFileSync('app/composables/usePageScrollable.ts', 'utf8'), ['syncThumb', 'writeThumbProperty']) + '\nsyncThumb', context)
function element() {
  const values = new Map(), priorities = new Map(), calls = []
  return { clientHeight: 800, scrollHeight: 4800, scrollTop: 0, values, priorities, calls,
    style: {
      getPropertyValue: key => values.get(key) || '',
      getPropertyPriority: key => priorities.get(key) || '',
      setProperty: (key, value) => { calls.push([key, value]); values.set(key, value); priorities.delete(key) },
    },
  }
}
// Frozen pre-optimization formula; includes rounding, overscroll and 1px tolerance.
function original(el) {
  const track = el.clientHeight, range = el.scrollHeight - track
  let size = track
  if (track > 0 && range > 1) {
    size = Math.min(track, Math.max(40, Math.round((track * track) / el.scrollHeight)))
    el.style.setProperty(offsetKey, `${Math.round((el.scrollTop / range) * (track - size))}px`)
  } else el.style.setProperty(offsetKey, '0px')
  el.style.setProperty(sizeKey, `${size}px`)
}
const before = element(), after = element()
for (let i = 0; i < 600; i++) {
  before.scrollTop = after.scrollTop = i / 4
  original(before); sync(after)
  assert.deepEqual(after.values, before.values)
}
console.log(`600 deterministic updates: CSS writes ${before.calls.length} -> ${after.calls.length}; size writes 600 -> ${after.calls.filter(([key]) => key === sizeKey).length}`)
for (const [height, content, top] of [[800,800,0],[800,801,1],[800,802,2],[400,10000,9600],[0,0,0],[800,4800,-12],[800,4800,4200]]) {
  Object.assign(before, { clientHeight: height, scrollHeight: content, scrollTop: top })
  Object.assign(after, { clientHeight: height, scrollHeight: content, scrollTop: top })
  original(before); sync(after); assert.deepEqual(after.values, before.values)
}
after.values.clear(); sync(after); assert.deepEqual(after.values, before.values, 'Cleared inline styles recover')
after.priorities.set(sizeKey, 'important'); sync(after); assert.equal(after.priorities.has(sizeKey), false)
const replacement = element(); sync(replacement); assert.equal(replacement.values.size, 2, 'New element always initializes')

let top = 0, writes = 0
const dataset = new Proxy({ scrolled: 'true' }, {
  set: (target, key, value) => { writes++; target[key] = value; return true },
  deleteProperty: (target, key) => { writes++; delete target[key]; return true },
})
const app = readFileSync('app/app.vue', 'utf8').match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1]
const update = vm.runInNewContext(functions(app, ['syncScrollState']) + '\nsyncScrollState', {
  document: { documentElement: { dataset } }, pageScrollTop: () => top,
})
for (const position of [0, ...Array(600).fill(100), 8, 8, 0]) {
  top = position; update()
  assert.equal(dataset.scrolled, top > 8 ? 'true' : undefined)
}
assert.equal(writes, 3, 'Only initial stale cleanup and two threshold crossings write')
dataset.scrolled = 'false'; top = 100; update(); assert.equal(dataset.scrolled, 'true', 'External reset recovers')
console.log('PASS: exact thumb values, threshold state, resize/short pages, rounding, resets and element replacement. No browser performance claim.')

// Measure keeps calling geometry/fade helpers even when the attribute is unchanged.
let desktop = true, fades = 0, thumbs = 0, attributeWrites = 0
function measuredElement() {
  const attributes = new Map([[PAGE_SCROLLABLE_SETTLED_ATTRIBUTE, 'false']])
  return {
    clientHeight: 800, scrollHeight: 4800, attributes,
    hasAttribute: key => attributes.has(key),
    getAttribute: key => attributes.get(key) ?? null,
    setAttribute: (key, value) => { attributeWrites++; attributes.set(key, value) },
    removeAttribute: key => { attributeWrites++; attributes.delete(key) },
  }
}
const scroller = { value: measuredElement() }
const measure = vm.runInNewContext(functions(readFileSync('app/composables/usePageScrollable.ts', 'utf8'), ['measure']) + '\nmeasure', {
  scroller, PAGE_SCROLLABLE_ATTRIBUTE, PAGE_SCROLLABLE_SETTLED_ATTRIBUTE, PAGE_SCROLL_QUERY, pageNeedsScroll,
  window: { matchMedia: query => { assert.equal(query, PAGE_SCROLL_QUERY); return { matches: desktop } } },
  allowFadeDelay: () => { fades++ }, syncThumb: () => { thumbs++ },
})
for (let i = 0; i < 600; i++) measure()
assert.equal(attributeWrites, 1, '600 unchanged desktop measurements write the state once')
assert.equal(fades, 600, 'Fade scheduling is not skipped by the write guard')
assert.equal(thumbs, 600, 'Thumb geometry is still synchronized each time')
for (const height of [800, 801, 802, 4800, 800]) {
  scroller.value.scrollHeight = height; measure()
  assert.equal(scroller.value.getAttribute(PAGE_SCROLLABLE_ATTRIBUTE), height - 800 > 1 ? 'true' : 'false')
}
scroller.value.attributes.set(PAGE_SCROLLABLE_ATTRIBUTE, 'stale'); measure()
assert.equal(scroller.value.getAttribute(PAGE_SCROLLABLE_ATTRIBUTE), 'false')
const desktopCalls = thumbs, beforeTouch = attributeWrites
desktop = false
for (let i = 0; i < 600; i++) measure()
assert.equal(attributeWrites - beforeTouch, 2, 'Touch removes both markers only once')
assert.equal(scroller.value.attributes.size, 0)
assert.equal(thumbs, desktopCalls, 'Touch keeps the original early return')
desktop = true; measure()
assert.equal(scroller.value.getAttribute(PAGE_SCROLLABLE_ATTRIBUTE), 'false')
assert.equal(scroller.value.hasAttribute(PAGE_SCROLLABLE_SETTLED_ATTRIBUTE), false, 'Measure does not invent a settled state')
scroller.value = measuredElement(); measure()
assert.equal(scroller.value.getAttribute(PAGE_SCROLLABLE_ATTRIBUTE), 'true')
scroller.value = null; measure()
console.log('PASS: measure write guards, content resize, 1px boundary, external reset, pointer-mode switch, replacement and null ref.')
