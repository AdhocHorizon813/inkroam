import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { passageKey, selectedPassage, findPassageTarget, passageUrl } from '../app/utils/passage-link.ts'

const paragraph = (text, unsafe = false) => {
  const block = { textContent: text, closest: selector => selector === 'p, li, blockquote' ? block : null,
    querySelector: () => unsafe ? {} : null, contains: node => node === block || node === block.text,
    getBoundingClientRect: () => ({ top: 300 }) }
  block.text = { nodeType: 3, parentElement: block }
  return block
}
const first = paragraph('一段关于 PDE 的说明。'), second = paragraph('另一段。'), formula = paragraph('公式内容', true)
const heading = { id: '基本定义', contains: () => false, compareDocumentPosition: () => 4 }
let blocks = [first, second, formula]
const article = {
  contains: node => blocks.some(block => block.contains(node)),
  querySelectorAll: selector => selector === 'p, li, blockquote' ? blocks : [heading],
  getAttribute: () => '/notes/pde/test',
}
const selection = (start = first.text, end = start) => ({ isCollapsed: false, rangeCount: 1,
  toString: () => 'PDE', getRangeAt: () => ({ startContainer: start, endContainer: end }) })
const chosen = selectedPassage(article, selection())
assert.deepEqual(chosen, { heading: '基本定义', passage: passageKey(first.textContent) })
assert.equal(passageKey('  é\n x '), passageKey('e\u0301 x'), 'Normalize Unicode and whitespace')
assert.equal(findPassageTarget(article, chosen.passage), first)
assert.equal(selectedPassage(article, selection(first.text, second.text)).passage, undefined, 'Cross-block selection falls back')
assert.equal(selectedPassage(article, selection(formula.text)).passage, undefined, 'Math falls back')
assert.equal(selectedPassage(article, selection({})), null, 'Outside article is not captured')
assert.equal(selectedPassage(article, { ...selection(), isCollapsed: true }), null)
assert.equal(selectedPassage(article, { ...selection(), rangeCount: 2 }), null)
assert.equal(selectedPassage(article, null), null)
blocks.push(paragraph(first.textContent))
assert.equal(findPassageTarget(article, chosen.passage), null, 'Ambiguous repeated paragraph never guesses')
assert.equal(selectedPassage(article, selection()).passage, undefined)
blocks.pop()
const href = 'https://example.com/inkroam/notes/pde/test?private=1#old'
const shared = new URL(passageUrl(href, chosen))
assert.equal(shared.pathname, '/inkroam/notes/pde/test')
assert.equal(shared.searchParams.get('private'), null)
assert.equal(shared.searchParams.get('passage'), chosen.passage)
assert.equal(decodeURIComponent(shared.hash.slice(1)), heading.id)
assert.equal(passageUrl(href, null), 'https://example.com/inkroam/notes/pde/test')
assert.equal(new URL(passageUrl(href, { heading: 'a # ? /' })).hash, '#a%20%23%20%3F%20%2F')

// Execute actual scrolling against deterministic geometry and frame timing.
const code = ts.transpileModule(readFileSync('app/utils/passage-scroll.ts', 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText
let now = 0, available = true, touch = false
const frames = [], scrolls = [], fallbacks = []
const root = {}, scroller = { getBoundingClientRect: () => ({ top: 20 }) }
const location = { href }
const context = vm.createContext({ exports: {}, Date: { now: () => now }, window: { location },
  document: { documentElement: root, scrollingElement: root, querySelector: () => available ? article : null },
  getComputedStyle: () => ({ getPropertyValue: () => '88px' }),
  requestAnimationFrame: callback => { frames.push(callback) },
  require: path => path.endsWith('passage-link') ? { findPassageTarget } : {
    resolvePageScroller: () => touch ? root : scroller, pageScrollTop: () => 100,
    scrollPageTo: (top, behavior) => scrolls.push([top, behavior]),
    findHashTarget: hash => ({ scrollIntoView: ({ behavior }) => fallbacks.push([hash, behavior]) }),
  },
})
vm.runInContext(code, context)
const scroll = context.exports.scrollToPassageWhenReady
scroll(chosen.passage, '#基本定义', 'smooth', '/notes/pde/test')
assert.deepEqual(scrolls.pop(), [292, 'smooth'])
touch = true
scroll(chosen.passage, '#基本定义', 'auto', '/notes/pde/test/')
assert.deepEqual(scrolls.pop(), [312, 'auto'])
available = false
scroll(chosen.passage, '#基本定义', 'smooth', '/notes/pde/test')
// Article arrives, but its edited paragraph no longer matches the old link.
available = true; blocks = [second]
now = 1200; frames.shift()()
assert.deepEqual(fallbacks.pop(), ['#基本定义', 'smooth'])
scroll(chosen.passage, '#基本定义', 'smooth', '/notes/pde/test')
location.href = 'https://example.com/elsewhere'
now += 1200; frames.shift()()
assert.equal(fallbacks.length, 0, 'Pending navigation never scrolls a later page')
available = true
scroll(chosen.passage, '#基本定义', 'smooth', '/notes/pde/other', 0)
assert.equal(scrolls.length, 0, 'Old article still mounted is not a matching destination')
console.log('PASS: paragraph identity, selection bounds, math/duplicate fallback, clean URLs, scroller offsets and stale-navigation cancellation (DOM stand-ins).')
