import assert from 'node:assert/strict'
import { groupSearchMatches } from '../app/utils/search-results.ts'

const matches = [
  { id: '/posts/a#first', score: 6 },
  { id: '/notes/course/b#范数', score: 5 },
  { id: '/posts/a', score: 4 },
  { id: '/posts/ab#first', score: 3 },
  { id: '/posts/a#second', score: 2 },
  { id: '/notes/course/b#%E8%8C%83%E6%95%B0', score: 1 },
]
const snapshot = structuredClone(matches)
const grouped = groupSearchMatches(matches)
for (const path of ['/posts/a', '/posts/ab', '/notes/course/b', '/missing']) {
  assert.deepEqual(grouped.get(path) || [], matches.filter(match => match.id.split('#')[0] === path))
}
assert.deepEqual(matches, snapshot, 'Do not mutate match data')
assert.equal(grouped.get('/posts/a')[0], matches[0], 'Keep match objects and formula excerpts intact')
assert.equal(groupSearchMatches([]).size, 0)
// Large deterministic fixture: same results and order as the previous filter.
const many = Array.from({ length: 10_000 }, (_, i) => ({ id: `/posts/${i % 100}#section-${i}`, score: i }))
const indexed = groupSearchMatches(many)
assert.equal(indexed.size, 100)
for (let i = 0; i < 100; i++) {
  const path = `/posts/${i}`
  assert.deepEqual(indexed.get(path), many.filter(match => match.id.split('#')[0] === path))
}
console.log('PASS: search grouping matches prior behavior, preserves ordering/objects, handles empty and 10,000-match fixtures.')
