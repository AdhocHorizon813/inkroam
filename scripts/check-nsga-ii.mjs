import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkMath from 'remark-math'
import katex from 'katex'
import { parse as parseYaml } from 'yaml'
import { examplePopulation as P, dominates, fastNonDominatedSort, crowdingDistanceAssignment, environmentalSelection } from '../app/utils/nsga-ii.ts'

const ids = list => list.map(p => p.id).sort()
const near = (a, b) => assert(Math.abs(a - b) < 1e-10, `${a} != ${b}`)
const sorted = fastNonDominatedSort(P)
assert.deepEqual(sorted.fronts.map(ids), [['A', 'B', 'C'], ['D', 'E', 'F', 'G', 'H'], ['I', 'J', 'K', 'L']])
assert.deepEqual(sorted.snapshots.map(s => s.J), [6, 3, 0, 0])
assert.equal(sorted.n_p.D, 1)
assert.equal(sorted.n_p.E, 2)
assert(dominates(P[0], P[5]), 'Equal coordinate still permits strict dominance on another objective')
assert(!dominates(P[0], { id: 'copy', f: [...P[0].f] }), 'Identical objectives do not dominate')
const distances = crowdingDistanceAssignment(sorted.fronts[1]).distance
assert.equal(distances.D, Infinity)
assert.equal(distances.H, Infinity)
near(distances.E, 5 / 6); near(distances.F, 5 / 6); near(distances.G, 7 / 6)
for (const p of sorted.fronts[1]) {
  const scaled = crowdingDistanceAssignment(sorted.fronts[1].map(p => ({ ...p, f: [p.f[0], p.f[1] * 1000 + 7] }))).distance
  assert.equal(scaled[p.id], distances[p.id], 'Positive affine unit change preserves crowding distance')
}
assert.deepEqual(ids(environmentalSelection(P, 6).selected), ['A', 'B', 'C', 'D', 'G', 'H'])
assert.deepEqual(ids(environmentalSelection(P, 3).selected), ['A', 'B', 'C'])
assert.deepEqual(ids(environmentalSelection(P, 2).selected), ['A', 'C'])
assert.equal(environmentalSelection(P, 0).selected.length, 0)
assert.equal(environmentalSelection(P, 12).selected.length, 12)
assert.deepEqual(fastNonDominatedSort([]).fronts, [])
assert.deepEqual(crowdingDistanceAssignment([]).distance, {})
for (const count of [1, 2, 3]) {
  const equal = Array.from({ length: count }, (_, i) => ({ id: `${i}`, f: [2, 2] }))
  const d = crowdingDistanceAssignment(equal).distance
  for (const value of Object.values(d)) assert.equal(value, count <= 2 ? Infinity : 0)
  assert.equal(fastNonDominatedSort(equal).fronts.length, 1)
}
const partialConstant = [{ id: 'a', f: [0, 2] }, { id: 'b', f: [0, 3] }, { id: 'c', f: [0, 4] }]
near(crowdingDistanceAssignment(partialConstant).distance.b, 1)
// Independent peeling oracle over every non-empty subset of the 3×3 integer grid.
const grid = Array.from({ length: 9 }, (_, i) => ({ id: String(i), f: [i % 3, Math.floor(i / 3)] }))
for (let mask = 1; mask < 512; mask++) {
  const sample = grid.filter((_, i) => mask & (1 << i))
  let remaining = [...sample]
  const expected = []
  while (remaining.length) {
    const front = remaining.filter(p => !remaining.some(q => q.f[0] <= p.f[0] && q.f[1] <= p.f[1] && (q.f[0] < p.f[0] || q.f[1] < p.f[1])))
    expected.push(ids(front))
    remaining = remaining.filter(p => !front.includes(p))
  }
  assert.deepEqual(fastNonDominatedSort(sample).fronts.map(ids), expected)
  for (let N = 0; N <= sample.length; N++) {
    const result = environmentalSelection(sample, N)
    assert.equal(new Set(result.selected.map(p => p.id)).size, N)
    const rejected = sample.filter(p => !result.selected.includes(p))
    for (const p of result.selected) for (const q of rejected) assert(result.rank[p.id] <= result.rank[q.id], 'No worse rank displaces a better rank')
  }
}
// The crowding slider must retain the same front and finite interior calculations throughout its range.
for (let x = 3.25; x <= 5.75; x += .25) {
  const front = sorted.fronts[1].map(p => ({ ...p, f: [p.id === 'F' ? x : p.f[0], p.f[1]] }))
  assert.equal(fastNonDominatedSort(front).fronts.length, 1)
  near(crowdingDistanceAssignment(front).distance.F, 5 / 6)
}
const notePath = 'content/notes/fundamentals-of-intelligent-computing/nsga-ii.md'
const note = readFileSync(notePath, 'utf8')
const [, header, body] = note.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
const meta = parseYaml(header)
assert.equal(meta.title, 'NSGA-II'); assert.equal(meta.draft, false); assert.equal(meta.order, 2)
for (const mode of ['dominance', 'sorting', 'crowding', 'selection']) assert(body.includes(`::nsga-explorer{mode="${mode}"}\n::`))
let formulas = 0
function visit(node) {
  if (node.type === 'math' || node.type === 'inlineMath') {
    katex.renderToString(node.value, { throwOnError: true, trust: false, displayMode: node.type === 'math' }); formulas++
  }
  for (const child of node.children || []) visit(child)
}
visit(unified().use(remarkParse).use(remarkMath).parse(body))
for (const file of ['29778', '29783', '29784', '29785']) assert(readFileSync(`public/images/notes/fundamentals-of-intelligent-computing/nsga-ii/${file}.jpg`).length > 0)
if (process.argv.includes('--built')) {
  const html = readFileSync('.output/public/notes/fundamentals-of-intelligent-computing/nsga-ii/index.html', 'utf8')
  assert.equal((html.match(/class="nsga-explorer"/g) || []).length, 4)
  assert.equal((html.match(/class="nsga-plot"/g) || []).length, 4)
  assert(!html.includes('::nsga-explorer')); assert(!html.includes('katex-error'))
  assert(html.includes('course-navigation'))
  for (const file of ['29778', '29783', '29784', '29785']) assert(html.includes(`/inkroam/images/notes/fundamentals-of-intelligent-computing/nsga-ii/${file}.jpg`))
}
console.log(`PASS: 511 grid subsets, selection invariants, worked example, crowding edge cases, ${formulas} formulas, and note${process.argv.includes('--built') ? ' with static output' : ''}.`)
