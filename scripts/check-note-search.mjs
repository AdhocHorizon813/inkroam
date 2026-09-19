// Requires npm run dev on localhost:3000 and the two published test notes.
import assert from 'node:assert/strict'

async function search(query) {
  const response = await fetch(`http://localhost:3000/search?q=${encodeURIComponent(query)}`)
  assert.equal(response.status, 200)
  const html = await response.text()
  return html.match(/<main[\s\S]*?<\/main>/)?.[0] || ''
}
const norm = '/notes/functional-analysis/test-norm-and-distance'
const markov = '/notes/stochastic-processes/test-two-state-markov-chain'
for (const [query, path] of [['范数与距离', norm], ['蓝色尺子', norm], ['雨滴计数器', markov], ['两状态马尔可夫链', markov], ['蓝色尺子 范数', norm]]) {
  assert((await search(query)).includes(path), `Missing search result: ${query}`)
}
const grouped = await search('范数')
assert.equal((grouped.match(/class="search-result search-result--grouped"/g) || []).length, 1, 'Grouped as one note')
assert(grouped.includes('展开其余'), 'Extra chapter matches available')
const formula = await search('蓝色尺子')
assert(formula.includes('search-formula') && formula.includes('<msqrt>'), 'Root rendered in excerpt')
assert(!formula.replace(/<annotation\b[\s\S]*?<\/annotation>/g, '').includes('\\sqrt'), 'No raw TeX leaked into visible excerpt')
const matrix = await search('每行概率')
assert(matrix.includes(markov) && matrix.includes('<mtable'), 'Matrix rendered in excerpt')
assert(!(await search('蓝色尺子 雨滴计数器')).includes('class="search-result search-result--grouped"'), 'AND terms do not merge different notes')
assert(!(await search('not-a-real-note-984521')).includes('class="search-result search-result--grouped"'), 'No false positive')
console.log('PASS: note titles, body, AND queries, grouping, extra matches, roots, matrix, empty results (SSR).')
