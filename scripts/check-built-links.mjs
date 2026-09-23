import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, relative, sep } from 'node:path'

// Read-only audit of emitted HTML links and resources, not a network crawler.
const root = resolve('.output/public')
const base = process.env.BASE_PATH || '/inkroam/'
assert(base.startsWith('/') && base.endsWith('/'), 'BASE_PATH must begin/end with /')
assert(existsSync(root), 'Run npm run generate first')
const pages = []
function walk(dir) {
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const path = resolve(dir, item.name)
    if (item.isDirectory()) walk(path)
    else if (item.name.endsWith('.html')) pages.push(path)
  }
}
walk(root)
assert(pages.length > 0)
const failures = new Set()
let count = 0
for (const page of pages) {
  const name = relative(root, page).split(sep).join('/')
  const route = name.endsWith('index.html') ? name.slice(0, -10) : name
  const from = new URL(`${base}${route}`, 'https://build.invalid')
  const html = readFileSync(page, 'utf8').replace(/<!--[\s\S]*?-->/g, '')
  for (const match of html.matchAll(/\b(?:href|src)="([^"]*)"/g)) {
    const raw = match[1].replaceAll('&amp;', '&')
    if (!raw || raw.startsWith('#')) continue
    let url
    try { url = new URL(raw, from) } catch { failures.add(`${name}: invalid URL ${raw}`); continue }
    if (url.origin !== from.origin) continue
    count++
    if (!url.pathname.startsWith(base)) { failures.add(`${name}: missing deployment prefix ${raw}`); continue }
    let path
    try { path = resolve(root, decodeURIComponent(url.pathname.slice(base.length))) }
    catch { failures.add(`${name}: malformed URL encoding ${raw}`); continue }
    if (path !== root && !path.startsWith(root + sep)) { failures.add(`${name}: path escapes build ${raw}`); continue }
    const isFile = candidate => existsSync(candidate) && statSync(candidate).isFile()
    if (!isFile(path) && !isFile(resolve(path, 'index.html'))) failures.add(`${name}: missing target ${raw}`)
  }
}
assert.equal(failures.size, 0, [...failures].join('\n'))
console.log(`PASS: ${pages.length} HTML files, ${count} local href/src targets resolve under ${base}.`)
console.log('Not checked: external URLs, fragment IDs, CSS URLs, srcset or links created only at runtime.')
