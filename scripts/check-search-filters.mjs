import assert from 'node:assert/strict'
import { readSearchFilters, emptySearchFilters, matchesSearchFilters } from '../app/utils/search-filters.ts'
const post = { path: '/posts/example', tags: ['数学'], date: '2026-09-24' }
const note = { path: '/notes/functional-analysis/example', tags: ['数学', '笔记'], date: '2026-09-20' }
assert.deepEqual(readSearchFilters({}), emptySearchFilters())
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
