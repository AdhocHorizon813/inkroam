import assert from 'node:assert/strict'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { resolveReadingLinks } from '../app/utils/reading-links.ts'

const prefix = '/notes/data-structures/'
const current = prefix + '02-binary-trees-and-traversal'
const target = { path: prefix + '01-pointers-and-ownership', title: '指针' }
const relation = { path: target.path, kind: 'review', reason: ' 回顾可写链接。 ' }
assert.deepEqual(resolveReadingLinks(current, undefined, [target]), [])
assert.deepEqual(resolveReadingLinks(current, [relation], [target]), [{ ...relation, title: '指针', reason: '回顾可写链接。' }])
for (const path of [current, '/notes/other/test', 'https://example.com', `${target.path}#x`, `${target.path}?x=1`, '/notes/data-structures/../escape']) {
  assert.equal(resolveReadingLinks(current, [{ ...relation, path }], [{ path, title: 'bad' }]).length, 0)
}
assert.equal(resolveReadingLinks(current, [relation], [{ ...target, draft: true }]).length, 0)
assert.equal(resolveReadingLinks(current, [relation], []).length, 0)
assert.equal(resolveReadingLinks(current, [relation, relation], [target]).length, 1)
assert.equal(resolveReadingLinks(current, [{ ...relation, reason: ' ' }], [target]).length, 0)
assert.equal(resolveReadingLinks(current, [{ ...relation, kind: 'unknown' }], [target]).length, 0)
assert.equal(resolveReadingLinks('/posts/test', [relation], [target]).length, 0)
const many = Array.from({ length: 5 }, (_, i) => ({ path: `${prefix}test-${i}`, title: 'test' }))
assert.equal(resolveReadingLinks(current, many.map(t => ({ ...relation, path: t.path })), many).length, 3)

// Pilot uses JSON flow arrays: valid YAML with a dependency-free audit parser.
// Review reason text and the target's publication status, not just URL shape.
const folder = 'content/notes/data-structures'
let count = 0
for (const file of readdirSync(folder).filter(file => file.endsWith('.md'))) {
  const source = readFileSync(`${folder}/${file}`, 'utf8')
  const frontmatter = source.split(/^---\s*$/m)[1]
  const configured = frontmatter?.match(/^readingLinks: (\[[\s\S]*?^\])/m)
  if (!configured) continue
  count++
  const links = JSON.parse(configured[1])
  assert(links.length <= 3)
  const path = prefix + file.slice(0, -3)
  const entries = links.map(link => {
    assert.match(link.path, /^\/notes\/data-structures\/[a-z0-9-]+$/)
    assert(link.reason.trim().length > 0 && link.reason.length <= 160)
    const filePath = `content${link.path}.md`
    assert(existsSync(filePath), `Missing reading target: ${link.path}`)
    const targetSource = readFileSync(filePath, 'utf8').split(/^---\s*$/m)[1]
    assert.match(targetSource, /^draft: false$/m)
    return { path: link.path, title: targetSource.match(/^title: (.+)$/m)[1] }
  })
  assert.equal(resolveReadingLinks(path, links, entries).length, links.length, `Invalid or duplicate relationship in ${file}`)
  if (process.argv.includes('--built')) {
    const html = readFileSync(`.output/public${path}/index.html`, 'utf8')
    const nav = html.match(/<nav[^>]*aria-label="课程阅读导航"[\s\S]*?<\/nav>/)?.[0]
    assert(nav, 'Relationships live in the existing course navigation')
    const hrefs = [...nav.matchAll(/href="([^"]+)"/g)].map(m => m[1].replace(/^\/inkroam(?=\/)/, ''))
    for (const link of links) {
      assert(nav.includes(link.reason.replaceAll('&', '&amp;')), `SSR reason missing: ${file}`)
      assert.equal(hrefs.filter(href => href === link.path).length, 1, 'Merge adjacent relationships instead of duplicating links')
    }
  }
}
assert.equal(count, 3, 'Three authored pilot notes; expand deliberately')
const summary = readFileSync('app/utils/entry-summary.ts', 'utf8')
assert(!summary.includes('readingLinks'), 'Do not enlarge every listing/search payload')
console.log('PASS: authored same-course relations, published targets, deduplication, graceful fallback and three pilot notes' + (process.argv.includes('--built') ? ' including generated HTML.' : '.'))
