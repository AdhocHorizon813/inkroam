import assert from 'node:assert/strict'
import { findPdfMatches } from '../app/utils/pdf-search.ts'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const matches = findPdfMatches([{ str: 'Func' }, { str: 'tional analysis', hasEOL: true }, { str: 'in Hilbert space' }], 'FUNCTIONAL   ANALYSIS in', 3)
assert.equal(matches.length, 1)
assert.equal(matches[0].page, 3)
assert.deepEqual(matches[0].parts, [{ item: 0, start: 0, end: 4 }, { item: 1, start: 0, end: 15 }, { item: 2, start: 0, end: 2 }])
assert.equal(findPdfMatches([{ str: '范数与范数' }], '范数', 1).length, 2)
assert.deepEqual(findPdfMatches([{ str: 'ﬁnite' }], 'fi', 1)[0].parts, [{ item: 0, start: 0, end: 1 }])
assert.equal(findPdfMatches([{ str: 'ﬀ' }], 'f', 1).length, 1)
assert.deepEqual(findPdfMatches([{ str: '𝔸' }], 'a', 1)[0].parts, [{ item: 0, start: 0, end: 2 }])
assert.equal(findPdfMatches([], 'scan', 1).length, 0)
assert.equal(findPdfMatches([{ str: 'abc' }], '  ', 1).length, 0)
assert.equal(findPdfMatches([{ str: '<script>' }], '<script>', 1).length, 1)
console.log('PASS: PDF matching across items/lines, case, whitespace, ligatures, Unicode offsets and empty text.')

const source = readFileSync('app/components/PdfCanvasReader.vue', 'utf8')
const script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1]
  .replace(/^import [^\n]+\n/gm, '')
const context = vm.createContext({
  findPdfMatches, setTimeout,
  defineProps: () => ({ src: '/pdfs/test.pdf' }), defineEmits: () => () => {},
  ref: value => ({ value }), computed: fn => ({ get value() { return fn() } }),
  nextTick: async () => {}, onMounted() {}, onBeforeUnmount() {},
  localStorage: { setItem() {} },
  document: {
    createTextNode: text => ({ textContent: text }),
    createElement: () => ({ textContent: '', className: '', getBoundingClientRect: () => ({ top: 100, left: 30 }) }),
  },
})
vm.runInContext(ts.transpile(script, { target: ts.ScriptTarget.ES2022 }) + `
globalThis.s = { query, matches, selectedMatch, searching, searchedPages, searchNotice, searchOpen,
 searchDocument, invalidateSearch, toggleSearch, selectMatch, pageNumber, textCache, paintMatches, frame,
 setLayer(value, page) { textLayer = value; layerPage = page },
 setPdf(value) { pdf = value; pageCount.value = value.numPages }, dispose() { disposed = true; searchToken++ } };`, context)
const s = context.s
let reads = 0
s.setPdf({ numPages: 3, getPage: async page => ({ getTextContent: async () => {
  reads++
  if (page === 3) throw new Error('bad page')
  return { items: [{ str: page === 1 ? 'alpha alpha' : 'beta' }] }
} }) })
s.query.value = 'alpha'
await s.searchDocument()
assert.equal(s.matches.value.length, 2)
assert.equal(s.searching.value, false)
assert.match(s.searchNotice.value, /1 页/)
s.selectMatch(-1)
assert.equal(s.selectedMatch.value, 1)
s.query.value = 'beta'
await s.searchDocument()
assert.equal(s.pageNumber.value, 2)
assert.equal(reads, 4, 'successful page extraction is cached between queries')
let release
s.textCache.clear()
s.setPdf({ numPages: 1, getPage: async () => ({ getTextContent: () => new Promise(resolve => { release = resolve }) }) })
const pending = s.searchDocument()
await new Promise(setImmediate)
s.invalidateSearch()
release({ items: [{ str: 'beta' }] })
await pending
assert.equal(s.matches.value.length, 0, 'stale extraction cannot publish results')
assert.equal(s.textCache.size, 0)
s.searchOpen.value = true
s.query.value = 'beta'
await s.toggleSearch()
assert.equal(s.query.value, '')
assert.equal(s.searching.value, false)
const div = { textContent: '', children: [], replaceChildren() { this.children = [] }, append(value) { this.children.push(value) } }
let scroll
s.frame.value = { scrollTop: 0, scrollLeft: 0, getBoundingClientRect: () => ({ top: 0, left: 0, height: 80, width: 60 }), scrollTo: value => { scroll = value } }
s.pageNumber.value = 1
s.matches.value = findPdfMatches([{ str: 'one <two> three' }], '<two>', 1)
s.setLayer({ textDivs: [div], textContentItemsStr: ['one <two> three'], cancel() {} }, 1)
s.selectMatch(0)
assert.equal(div.children.map(child => child.textContent).join(''), 'one <two> three')
assert.equal(div.children[1].className, 'is-current')
assert.equal(scroll.top, 60, 'only reader-local scroll coordinates are used')
s.invalidateSearch()
assert.equal(div.textContent, 'one <two> three', 'clearing query restores original text')
assert.match(source, /data-main-rotation='90'/)
assert.match(source, /prefers-reduced-motion/)
console.log('PASS: reader search progress/cache, partial failure, match cycling/jump, cancellation and close cleanup (mock PDF).')
