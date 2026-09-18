// Run after npm run generate. Exercise Content's real extractor on a built article.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse } from 'devalue'
import { generateSearchSections } from '../node_modules/@nuxt/content/dist/runtime/internal/search.js'

const payload = parse(readFileSync('.output/public/posts/004world-inside-a-black-hole/_payload.json', 'utf8'), {
  ShallowReactive: value => value, ShallowRef: value => value,
  Reactive: value => value, Ref: value => value,
})
const post = Object.values(payload.data).find(value => value?.body)
assert.ok(post, 'Built black-hole article must be present')
const query = { where() { return this }, select() { return this }, async all() { return [post] } }
const pageSource = readFileSync('app/pages/search.vue', 'utf8')
const ignoredTags = [...pageSource.match(/ignoredTags:\s*\[([^\]]+)\]/)[1].matchAll(/'([^']+)'/g)].map(match => match[1])
const before = await generateSearchSections(query)
const after = await generateSearchSections(query, { ignoredTags })
assert.deepEqual(after.map(section => section.id), before.map(section => section.id), 'Chapter destinations remain unchanged')
const oldSection = before.find(section => section.title.startsWith('七、'))
const newSection = after.find(section => section.id === oldSection?.id)
assert.ok(oldSection.content.includes('\\quad'), 'Fixture reproduces leaked TeX')
assert.ok(!newSection.content.includes('\\quad'), 'TeX annotations must not leak')
assert.equal((newSection.content.match(/f\(r\)/g) || []).length, 4, 'The four source formulas each appear once')
assert.ok(newSection.content.includes('这个模型最让我感兴趣'), 'Surrounding prose remains searchable')
assert.ok(newSection.content.includes('r>r+'), 'Visible formula text remains searchable')
console.log('PASS: real KaTeX search text, no duplicate formula or TeX annotation; chapter links preserved.')
console.log(newSection.content.slice(0, 240))
