import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'

const route = 'notes/functional-analysis/test-norm-and-distance'
const filename = 'linear-functional-analysis-test.pdf'

// 预渲染 / SSR 的 HTML 里必须是「打开 PDF」卡片：只有浏览器报告能内嵌 PDF
// （navigator.pdfViewerEnabled）时，组件才会在挂载后替换成 <object>，
// 因此产物里既不应该有 <object>，也不应该残留未解析的 ::pdf-viewer 指令文字。
const page = await fetch(`http://localhost:3000/${route}`)
assert.equal(page.status, 200)
const html = await page.text()
assert(html.includes('class="pdf-viewer__fallback"'), 'MDC renders the PDF viewer component')
assert(html.includes('pdf-viewer__open--primary'), 'The in-page reader entry is present')
assert(html.includes(`href="/pdfs/${filename}"`), 'Attachment link keeps the local path')
assert(!html.includes('::pdf-viewer'), 'The directive is not left as plain text')
assert(!html.includes('<object'), 'No <object> in the prerendered HTML')

const response = await fetch(`http://localhost:3000/pdfs/${filename}`)
assert.equal(response.status, 200)
assert(response.headers.get('content-type').includes('application/pdf'))
const bytes = Buffer.from(await response.arrayBuffer())
assert.equal(bytes.subarray(0, 5).toString(), '%PDF-')
assert.deepEqual(bytes, readFileSync(`public/pdfs/${filename}`))

if (process.argv.includes('--built')) {
  const built = readFileSync(`.output/public/${route}/index.html`, 'utf8')
  assert(built.includes('class="pdf-viewer__fallback"'), 'Built page ships the viewer card')
  assert(!built.includes('<object'), 'Built page has no prerendered <object>')
  assert(built.includes(`href="/inkroam/pdfs/${filename}"`), 'Static subpath is preserved')
  assert.deepEqual(readFileSync(`.output/public/pdfs/${filename}`), bytes)

  // PDF.js 只在点击「在页面内阅读」后才加载：worker 必须独立产出为资源，
  // 且引用要相对于所在分块，这样 /inkroam/ 子路径部署不会丢路径。
  const assets = readdirSync('.output/public/_nuxt')
  const worker = assets.find(name => /^pdf\.worker.*\.mjs$/.test(name))
  assert(worker, 'PDF.js worker asset is emitted')
  assert(readFileSync(`.output/public/_nuxt/${worker}`).length > 100_000, 'Worker asset is complete')
  const referencesWorker = assets
    .filter(name => name !== worker && /\.(js|mjs)$/.test(name))
    .some(name => readFileSync(`.output/public/_nuxt/${name}`, 'utf8').includes('pdf.worker.min'))
  assert(referencesWorker, 'A client chunk references the worker')
}
console.log('PASS: PDF viewer card, attachment integrity, worker asset and requested build checks.')
