import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkMath from 'remark-math'
import katex from 'katex'
import { parse as parseYaml } from 'yaml'
import { transformPoint, matrixFacts, symmetricSpectrum, quadraticValue, quadraticContour, polynomialValue, polynomialDerivative, polynomialRootFacts } from '../app/utils/algebra-explorer.ts'
import { courses } from '../app/utils/courses.ts'
import { getTagSlug } from '../app/utils/tags.ts'

const near = (actual, expected, message) => assert(Math.abs(actual - expected) < 1e-9, `${message}: ${actual} != ${expected}`)
const course = 'mathematics-competition'
assert.equal(courses.find(entry => entry.slug === course)?.name, '数学竞赛（数学专业类）')
const folder = `content/notes/${course}`
const files = readdirSync(folder).filter(file => file.endsWith('.md')).sort()
assert.equal(files.length, 3, 'One Markdown note per chapter')
let formulas = 0
for (const [index, file] of files.entries()) {
  const text = readFileSync(`${folder}/${file}`, 'utf8')
  const [, header, body] = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  const meta = parseYaml(header)
  assert.equal(meta.order, index + 1)
  assert.equal(meta.draft, false)
  assert.equal(meta.aiGenerated, true)
  assert(meta.title && meta.description)
  assert.match(body, new RegExp(`## ${index + 1}\\.1 竞赛要点与难点`))
  for (const tag of meta.tags) assert.match(getTagSlug(tag), /^[a-z0-9-]+$/, `ASCII slug for ${tag}`)
  const mode = ['matrix', 'quadratic', 'polynomial'][index]
  assert(body.includes(`::algebra-explorer{mode="${mode}"}\n::`), `${mode} exploration is embedded`)
  for (const link of meta.readingLinks) assert(files.some(name => link.path.endsWith(name.slice(0, -3))), `Existing reading link: ${link.path}`)
  const tree = unified().use(remarkParse).use(remarkMath).parse(body)
  const visit = (node) => {
    if (node.type === 'math' || node.type === 'inlineMath') {
      katex.renderToString(node.value, { displayMode: node.type === 'math', throwOnError: true, trust: false })
      formulas++
    }
    for (const child of node.children || []) visit(child)
  }
  visit(tree)
  if (process.argv.includes('--built')) {
    const html = readFileSync(`.output/public/notes/${course}/${file.slice(0, -3)}/index.html`, 'utf8')
    assert(html.includes(meta.title))
    assert.match(html, /class="algebra-explorer"/)
    assert.match(html, /class="algebra-plot"/)
    assert.match(html, /class="katex/)
    assert(!html.includes('katex-error'), 'No KaTeX error output')
    assert(!html.includes('::algebra-explorer'), 'MDC component resolved')
    assert.match(html, /course-navigation/)
  }
}

// The determinant is the oriented area of the actual plotted polygon.
for (const [a, b, c, d] of [[1, 1, 0, 1], [0, 1, 1, 0], [1, 1, 1, 1], [0, 0, 0, 0], [2, -1, 3, 2]]) {
  const polygon = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }].map(p => transformPoint(a, b, c, d, p))
  const area = polygon.reduce((sum, p, i) => { const q = polygon[(i + 1) % polygon.length]; return sum + p.x * q.y - p.y * q.x }, 0) / 2
  near(area, matrixFacts(a, b, c, d).determinant, 'Orientation and area agree')
}
assert.equal(matrixFacts(1, 1, 1, 1).rank, 1)
assert.equal(matrixFacts(0, 0, 0, 0).rank, 0)
// Reconstruct QᵀAQ, testing negative, repeated, zero and off-diagonal cases.
for (const [a, b, d, classification] of [[2, 1, 2, '正定'], [1, 0, -1, '不定'], [1, 0, 0, '半正定（非正定）'], [-1, 0, 0, '半负定（非负定）'], [-2, 1, -2, '负定'], [0, 0, 0, '零二次型'], [2, 0, 2, '正定']]) {
  const result = symmetricSpectrum(a, b, d)
  assert.equal(result.classification, classification)
  const [u, v] = result.vectors
  near(u.x * v.x + u.y * v.y, 0, 'Orthogonal principal axes')
  for (const [index, vector] of result.vectors.entries()) {
    const lambda = result.values[index]
    near(a * vector.x + b * vector.y, lambda * vector.x, 'Eigenvector x equation')
    near(b * vector.x + d * vector.y, lambda * vector.y, 'Eigenvector y equation')
    near(quadraticValue(a, b, d, vector), lambda, 'Quadratic form on a unit eigenvector')
  }
}
assert.equal(quadraticContour(1, 0, 1, -1).length, 0, 'Positive definite forms have no negative level curve')
assert.equal(quadraticContour(0, 0, 0, 1).length, 0, 'The zero form has no unit level curve')
const circle = quadraticContour(1, 0, 1, 1)
assert(circle.length > 0)
for (const point of circle.flat()) assert(Math.abs(quadraticValue(1, 0, 1, point) - 1) < 0.02, 'Contour interpolation error stays below the grid bound')
for (const t of [-1, 0.5, 1, 2, 3]) {
  near(polynomialValue(t, 1), 0, 'Fixed repeated root')
  near(polynomialValue(t, t), 0, 'Moving root')
  near(polynomialDerivative(t, 1), 0, 'Repeated root has zero derivative')
  near(polynomialDerivative(t, t), (t - 1) ** 2, 'Moving root is simple unless it merges')
  for (const x of [-0.5, 0, 1, 2.5]) {
    const h = 1e-5
    const difference = (polynomialValue(t, x + h) - polynomialValue(t, x - h)) / (2 * h)
    assert(Math.abs(difference - polynomialDerivative(t, x)) < 1e-7, 'Plotted derivative agrees with the polynomial')
  }
}
assert.deepEqual(polynomialRootFacts(1), { repeatedRootMultiplicity: 3, gcdDegree: 2 })
assert.deepEqual(polynomialRootFacts(-1), { repeatedRootMultiplicity: 2, gcdDegree: 1 })
console.log(`PASS: three competition notes, ${formulas} parseable formulas, and algebra visualizations${process.argv.includes('--built') ? ' with generated reader pages' : ''}.`)
