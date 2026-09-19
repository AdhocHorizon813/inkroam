import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const route = 'notes/functional-analysis/test-norm-and-distance'
const filename = 'linear-functional-analysis-test.pdf'
const page = await fetch(`http://localhost:3000/${route}`)
assert.equal(page.status, 200)
const html = await page.text()
assert(html.includes('<object') && html.includes(`data="/pdfs/${filename}"`), 'MDC renders an embedded PDF object')
const response = await fetch(`http://localhost:3000/pdfs/${filename}`)
assert.equal(response.status, 200)
assert(response.headers.get('content-type').includes('application/pdf'))
const bytes = Buffer.from(await response.arrayBuffer())
assert.equal(bytes.subarray(0, 5).toString(), '%PDF-')
assert.deepEqual(bytes, readFileSync(`public/pdfs/${filename}`))
if (process.argv.includes('--built')) {
  const built = readFileSync(`.output/public/${route}/index.html`, 'utf8')
  assert(built.includes(`data="/inkroam/pdfs/${filename}"`), 'Static subpath is preserved')
  assert.deepEqual(readFileSync(`.output/public/pdfs/${filename}`), bytes)
}
console.log('PASS: PDF embed markup, HTTP status, MIME, attachment integrity and requested build checks.')
