import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkMath from 'remark-math'
import katex from 'katex'
import { parse } from 'yaml'
import { courses } from '../app/utils/courses.ts'
import { getTagSlug } from '../app/utils/tags.ts'

const text = readFileSync('content/notes/c2-matlab/pascal-triangle.md', 'utf8').replace(/\r\n/g, '\n')
const [, header, body] = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
const meta = parse(header)
assert.equal(meta.draft, false)
assert.equal(meta.aiGenerated, true)
for (const tag of meta.tags) assert.match(getTagSlug(tag), /^[a-z0-9-]+$/)
assert(courses.some(course => course.slug === 'c2-matlab'))
let formulas = 0, images = 0, matlab = 0
const tree = unified().use(remarkParse).use(remarkMath).parse(body)
function visit(node) {
  if (node.type === 'math' || node.type === 'inlineMath') {
    katex.renderToString(node.value, { throwOnError: true, displayMode: node.type === 'math' })
    formulas++
  }
  if (node.type === 'image') {
    assert(existsSync(`public${node.url}`), node.url)
    assert(node.alt)
    images++
  }
  if (node.type === 'code' && node.lang === 'matlab') matlab++
  for (const child of node.children || []) visit(child)
}
visit(tree)
assert.equal(images, 3)
assert(matlab >= 10)
console.log(`PASS: C2 course, metadata, ${formulas} formulas, ${images} image assets, ${matlab} MATLAB blocks. MATLAB execution is verified separately.`)
