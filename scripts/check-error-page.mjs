import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const config = readFileSync('nuxt.config.ts', 'utf8').replace('export default defineNuxtConfig', 'globalThis.testConfig = defineNuxtConfig')
const compiled = ts.transpile(config, { target: ts.ScriptTarget.ES2022 })
for (const base of ['/', '/inkroam/', '/a&b"<>/']) {
  const context = vm.createContext({ defineNuxtConfig: value => value, process: { env: { BASE_PATH: base } } })
  vm.runInContext(compiled, context)
  const hook = context.testConfig.nitro.hooks['prerender:generate']
  const contents = '<html><body><div id="__nuxt"></div></body></html>'
  const route = { route: '/404.html', contents }
  hook(route)
  assert(route.contents.includes('<noscript>'))
  const escape = value => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  for (const suffix of ['', 'archive/', 'search/']) assert(route.contents.includes(`href="${escape(base)}${suffix}"`))
  assert.equal(route.contents.split('<noscript>')[0], contents.replace('</body></html>', ''))
  for (const path of ['/about', '/200.html', '/posts/example']) {
    const other = { route: path, contents }
    hook(other)
    assert.equal(other.contents, contents, 'Normal pages must remain untouched')
  }
  assert.doesNotThrow(() => hook({ route: '/404.html' }))
}
const page = readFileSync('app/error.vue', 'utf8')
assert.match(page, /statusCode === 404/)
assert.match(page, /noindex, nofollow/)
const template = page.match(/<template>([\s\S]*?)<\/template>/)[1]
assert.doesNotMatch(template, /error\.(?:message|stack|data)/)
assert.equal([...template.matchAll(/class="text-link"/g)].length, 3)
console.log('PASS: root/subpath recovery links, attribute escaping, non-404 isolation and error disclosure contracts.')

if (process.argv.includes('--live')) {
  // Nitro negotiates JSON without a browser's Accept header.
  const response = await fetch('http://localhost:3000/does-not-exist-regression', {
    headers: { accept: 'text/html' }, signal: AbortSignal.timeout(15_000),
  })
  assert.equal(response.status, 404)
  const html = await response.text()
  assert(html.includes('这一页不在这里。'))
  for (const label of ['返回首页', '浏览归档', '搜索文章与笔记']) assert(html.includes(label))
  console.log('PASS: live HTML request returns HTTP 404 and custom recovery content.')
}

if (process.argv.includes('--built')) {
  const html = readFileSync('.output/public/404.html', 'utf8')
  const fallback = html.match(/<noscript>([\s\S]*?)<\/noscript>/)?.[1]
  assert(fallback, 'Rebuild before running --built')
  const base = process.env.BASE_PATH || '/inkroam/'
  for (const suffix of ['', 'archive/', 'search/']) assert(fallback.includes(`href="${base}${suffix}"`))
  assert(html.includes(`${base}_nuxt/`))
  console.log('PASS: generated 404 fallback and prefixed resources. Browser routing is not tested.')
}
