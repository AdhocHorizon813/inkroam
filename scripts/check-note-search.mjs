// Requires npm run dev on localhost:3000. Respect the fixture's draft state.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

async function search(query) {
  const response = await fetch(`http://localhost:3000/search?q=${encodeURIComponent(query)}`)
  assert.equal(response.status, 200)
  const html = await response.text()
  return html.match(/<main[\s\S]*?<\/main>/)?.[0] || ''
}
const norm = '/notes/functional-analysis/test-norm-and-distance'
const markov = '/notes/stochastic-processes/test-two-state-markov-chain'
const markovSource = readFileSync(`content${markov}.md`, 'utf8')
const frontmatter = markovSource.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1]
assert(frontmatter, 'Markov fixture must have frontmatter')
const markovDraft = /^draft:\s*true\s*$/m.test(frontmatter)
for (const [query, path] of [['范数与距离', norm], ['蓝色尺子', norm], ['蓝色尺子 范数', norm]]) {
  assert((await search(query)).includes(path), `Missing search result: ${query}`)
}
for (const query of ['雨滴计数器', '两状态马尔可夫链']) {
  assert.equal((await search(query)).includes(markov), !markovDraft, `Respect draft visibility: ${query}`)
}
const grouped = await search('范数')
assert.equal((grouped.match(/class="search-result search-result--grouped"/g) || []).length, 1, 'Grouped as one note')
assert(grouped.includes('展开其余'), 'Extra chapter matches available')
const formula = await search('蓝色尺子')
assert(formula.includes('search-formula') && formula.includes('<msqrt>'), 'Root rendered in excerpt')
assert(!formula.replace(/<annotation\b[\s\S]*?<\/annotation>/g, '').includes('\\sqrt'), 'No raw TeX leaked into visible excerpt')
const matrix = await search('每行概率')
if (markovDraft) {
  assert(!matrix.includes(markov), 'Draft must not leak through formula search')
  console.log('SKIP: live matrix excerpt rendering while Markov fixture is draft; draft exclusion checked instead.')
} else {
  assert(matrix.includes(markov) && matrix.includes('<mtable'), 'Matrix rendered in excerpt')
}
assert(!(await search('蓝色尺子 雨滴计数器')).includes('class="search-result search-result--grouped"'), 'AND terms do not merge different notes')
assert(!(await search('not-a-real-note-984521')).includes('class="search-result search-result--grouped"'), 'No false positive')
console.log('PASS: note titles, body, draft visibility, AND queries, grouping, extra matches, roots and empty results (SSR).')
