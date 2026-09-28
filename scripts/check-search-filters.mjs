import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { excerptParts } from '../app/utils/search-excerpt.ts'
import { readSearchFilters, emptySearchFilters, matchesSearchFilters } from '../app/utils/search-filters.ts'
const post = { path: '/posts/example', tags: ['数学'], date: '2026-09-24' }
const note = { path: '/notes/functional-analysis/example', tags: ['数学', '笔记'], date: '2026-09-20' }
assert.deepEqual(readSearchFilters({}), emptySearchFilters())
assert.equal(readSearchFilters({ caseSensitive: '1' }).caseSensitive, '1')
for (const value of ['0', 'true', ['1'], true]) assert.equal(readSearchFilters({ caseSensitive: value }).caseSensitive, '')
const page = readFileSync('app/pages/search.vue', 'utf8')
const activeSource = page.match(/^const hasFilters = .*$/m)[0] + '\n' + page.match(/^const searchActive = .*$/m)[0]
for (const [q, overrides, expected] of [
  ['', { caseSensitive: '1' }, false], ['', {}, false],
  ['Vue', { caseSensitive: '1' }, true], ['Vue', {}, true],
  ['', { type: 'notes', caseSensitive: '1' }, true],
]) {
  const active = vm.runInNewContext(`${activeSource}\nsearchActive.value`, {
    filters: { value: { ...emptySearchFilters(), ...overrides } }, query: { value: q },
    computed: fn => ({ get value() { return fn() } }),
  })
  assert.equal(active, expected, 'Case option alone must not activate search')
}
for (const file of ['app/components/SearchAdvanced.vue', 'app/components/content/PdfViewer.vue']) {
  const source = readFileSync(file, 'utf8')
  assert(source.includes('@import "~/assets/css/reading-checkbox.css"'))
  assert(source.includes('reading-checkbox__box'))
}
const normalizeSource = page.match(/^const normalize = .*$/m)[0]
for (const sensitive of [false, true]) {
  const context = vm.createContext({ filters: { value: { caseSensitive: sensitive ? '1' : '' } } })
  const normalize = vm.runInContext(ts.transpile(`${normalizeSource}\nnormalize`, { target: ts.ScriptTarget.ES2022 }), context)
  assert.equal(normalize('  Vue   中文  '), sensitive ? 'Vue 中文' : 'vue 中文')
  assert.equal(normalize('Vue').includes(normalize('vue')), !sensitive)
  const component = readFileSync('app/components/SearchHighlight.vue', 'utf8').match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1]
  const highlighted = vm.runInNewContext(ts.transpile(`${component}\nparts.value`, { target: ts.ScriptTarget.ES2022 }), {
    defineProps: () => ({ text: 'Vue vue VUE', terms: ['Vue'], caseSensitive: sensitive }),
    computed: fn => ({ value: fn() }),
  })
  assert.equal(highlighted.filter(p => p.match).length, sensitive ? 1 : 3)
}
const excerptSource = [{ kind: 'text', text: `vue ${'填'.repeat(180)} Vue tail` }]
assert(excerptParts(excerptSource, 'Vue', 150, true).map(p => p.text).join('').includes('Vue tail'))
assert(!excerptParts(excerptSource, 'Vue').map(p => p.text).join('').includes('Vue tail'))
for (const line of page.split('\n').filter(line => line.includes(':terms="searchTerms"'))) assert(line.includes(':case-sensitive="filters.caseSensitive'))
for (const value of ['2026-99-99', '2026-02-30', 'bad', ['2026-01-01']]) assert.equal(readSearchFilters({ from: value }).from, '')
assert.equal(readSearchFilters({ from: '2024-02-29' }).from, '2024-02-29')
assert.equal(readSearchFilters({ type: 'bad', sort: 'bad' }).type, '')
assert.equal(readSearchFilters({ course: 'functional-analysis' }).type, 'notes', 'A course filter implies the notes type')
assert.equal(readSearchFilters({ course: 'functional-analysis', type: 'posts' }).type, 'notes', 'A course filter wins over a contradicting type')
const filter = overrides => ({ ...emptySearchFilters(), ...overrides })
assert(matchesSearchFilters(post, filter({})))
assert(!matchesSearchFilters(post, filter({ type: 'notes' })))
assert(matchesSearchFilters(note, filter({ course: 'functional-analysis', tag: '笔记', from: '2026-09-20', to: '2026-09-20' })))
assert(!matchesSearchFilters(note, filter({ course: 'functional' })))
assert(!matchesSearchFilters(note, filter({ tag: '不存在' })))
assert(!matchesSearchFilters(note, filter({ from: '2026-09-24', to: '2026-09-01' })))
console.log('PASS: search filter combinations, exact course/tag matching, inclusive dates and invalid query normalization.')

if (process.argv.includes('--live')) {
  const search = async query => {
    const response = await fetch(`http://localhost:3000/search?${new URLSearchParams(query)}`, { signal: AbortSignal.timeout(15_000) })
    assert.equal(response.status, 200)
    const html = await response.text()
    return [...html.matchAll(/<article\b[^>]*class="search-result search-result--grouped"[\s\S]*?<\/article>/g)].map(m => m[0])
  }
  assert((await search({ q: '蓝色尺子', type: 'notes' })).length > 0)
  assert.equal((await search({ q: '蓝色尺子', type: 'posts' })).length, 0)
  const notes = await search({ course: 'functional-analysis' })
  assert(notes.length > 0)
  assert(notes.every(html => html.includes('/notes/functional-analysis/')))
  assert.equal((await search({ course: 'stochastic-processes' })).length, 0, 'Draft fixture is not public')
  assert.equal((await search({ type: 'notes', from: '2999-01-01' })).length, 0)
  assert.equal((await search({ tag: 'nonexistent-tag-regression' })).length, 0)
  console.log('PASS: live SSR advanced filtering, filter-only browsing and draft isolation.')
}
