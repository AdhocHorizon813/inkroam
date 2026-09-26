import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

// Source contracts, not a browser layout/contrast test.
const source = readFileSync(new URL('../app/pages/about.vue', import.meta.url), 'utf8')
const globalStyles = readFileSync(new URL('../app/assets/css/main.css', import.meta.url), 'utf8')
assert.match(globalStyles, /:root\[data-visual='modern'\] \.about-grid aside p \{ color: var\(--muted\)/, 'About signature follows the active light/dark text token')
const expected = [
  '林澈是我创造的一个原创角色。',
  '她有点清冷，也有点慵懒。喜欢数学、计算机，还有那些暂时没有答案的问题。大多数时候很安静，偶尔会冒出一些奇怪的想法。',
  '创造她最开始没有什么特别复杂的理由。',
  '只是一些零散的画面和想法反复出现。关于她应该长什么样，会喜欢什么，会怎样看待这个世界。它们逐渐变得具体，于是觉得，与其让这些东西散掉，不如让它们属于一个人。',
  '所以有了林澈。',
  '她不是这个博客的作者，也没有被赋予什么必须完成的使命。',
  '只是在「纸上漫游」里，我想给她留一个位置。',
]
const copy = source.match(/<div class="resident-copy about-copy">([\s\S]*?)<\/div>/)?.[1]
assert(copy, 'Resident copy must exist')
assert.deepEqual([...copy.matchAll(/<p(?:\s[^>]*)?>(.*?)<\/p>/gs)].map(m => m[1]), expected)
assert.match(source, /aria-labelledby="resident-title"/)
assert.match(source, /<h2 id="resident-title">林澈 <span>\/ Lin Che<\/span><\/h2>/)
assert.match(source, /ANOTHER RESIDENT/)
assert(source.indexOf('class="resident"') > source.indexOf('阅读最近文章'), 'Append after existing About content')
assert(source.indexOf('resident-copy about-copy') < source.indexOf('class="resident-figure"'), 'Text before image in reading order')

const png = readFileSync(new URL('../public/images/lin-che.png', import.meta.url))
assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a')
const img = source.match(/<img\s[\s\S]*?>/)?.[0]
assert(img)
assert.equal(Number(img.match(/width="(\d+)"/)[1]), png.readUInt32BE(16))
assert.equal(Number(img.match(/height="(\d+)"/)[1]), png.readUInt32BE(20))
assert.match(img, /alt="[^"]+"/)
assert.match(img, /loading="lazy"/)
assert.match(img, /decoding="async"/)

const script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1]
for (const baseURL of ['/', '/inkroam/']) {
  const context = vm.createContext({ useRuntimeConfig: () => ({ app: { baseURL } }), useSeoMeta: () => {} })
  assert.equal(vm.runInContext(`${script}\nresidentImage`, context), `${baseURL}images/lin-che.png`)
}

const css = source.match(/<style scoped>([\s\S]*?)<\/style>/)[1]
const mobile = css.slice(css.indexOf('@media'))
assert.match(mobile, /max-width:\s*767\.98px/)
assert.match(mobile, /\.resident\s*\{[^}]*display:\s*block/)
assert.match(mobile, /\.resident-figure\s*\{[^}]*margin:\s*38px auto 0/)
assert.match(mobile, /aspect-ratio:\s*1\s*\/\s*2/)
assert.match(mobile, /object-fit:\s*cover/)
assert.match(mobile, /object-position:\s*right center/)
// At 1:2 the 2:3 original fills height, cropping only horizontally.
assert(png.readUInt32BE(16) / png.readUInt32BE(20) > 1 / 2)
assert.match(css, /color:\s*var\(--ink\)/)
assert.match(css, /var\(--muted\)/)
assert.match(css, /var\(--serif\)/)
assert.doesNotMatch(css, /(?:^|[;{])\s*(?:color|background(?:-color)?)\s*:\s*#/m)
assert.doesNotMatch(css, /animation\s*:|transition\s*:/)
console.log('PASS: copy, reading order, image metadata, both base paths, mobile and theme-token source contracts.')

if (process.argv.includes('--built')) {
  const base = process.env.BASE_PATH || '/inkroam/'
  const html = readFileSync(new URL('../.output/public/about/index.html', import.meta.url), 'utf8')
  for (const paragraph of expected) assert(html.includes(paragraph), 'Generated page has current copy')
  assert(!html.includes('20 岁。长直黑发'), 'Generated page must not have old copy')
  assert(html.includes(`src="${base}images/lin-che.png"`), 'Generated asset URL must use expected BASE_PATH')
  assert(png.equals(readFileSync(new URL('../.output/public/images/lin-che.png', import.meta.url))))
  console.log('PASS: generated About copy, deployment asset URL and image bytes.')
}
console.log('NOT TESTED: actual viewport layout, computed styles, contrast, masks and theme switching. See docs/visual-system.md.')
