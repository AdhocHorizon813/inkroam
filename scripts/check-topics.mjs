import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse } from 'devalue'
import { collectTopics, filterTopics, relatedEntries, isSubjectTag } from '../app/utils/topics.ts'
import { getTagName, getTagSlug } from '../app/utils/tags.ts'

const items = [
  { path: '/posts/a', tags: ['思考', '思考', 'AI', ''] },
  { path: '/posts/a', tags: ['思考'] },
  { path: '/notes/course/b', tags: ['思考', 'GPT-6  Astra'] },
  { path: '/posts/draft', tags: ['秘密'], draft: true },
]
const topics = collectTopics(items)
assert.equal(topics[0].name, '思考')
assert.equal(topics[0].count, 2)
assert(!topics.some(topic => !topic.name || topic.name === '秘密'))
assert.deepEqual(collectTopics([...items].reverse()), topics, 'Stable order')
assert.equal(filterTopics(topics, 'gpt-6 astra')[0].name, 'GPT-6  Astra')
assert.equal(filterTopics(topics, 'not-present').length, 0)
assert.deepEqual(filterTopics(topics, '  '), topics)
assert.equal(getTagName(getTagSlug('GPT-6  Astra')), 'GPT-6  Astra')
assert.equal(getTagName('%bad%'), '%bad%')
assert(!isSubjectTag('GPT-6  Astra') && !isSubjectTag('AI'))
const current = { path: '/posts/self', tags: ['思考', '哲学', 'GPT-6  Astra'], date: '2026-01-01' }
const related = relatedEntries(current, [
  current,
  { path: '/posts/model-only', tags: ['GPT-6  Astra'], date: '2026-09-21' },
  { path: '/notes/a', tags: ['思考', '哲学'], date: '2026-01-01' },
  { path: '/posts/b', tags: ['思考'], date: '2026-09-21' },
  { path: '/posts/hidden', tags: ['思考', '哲学'], date: '2026-09-21', draft: true },
])
assert.deepEqual(related.map(entry => entry.path), ['/notes/a', '/posts/b'])
assert.equal(relatedEntries(current, [current]).length, 0)

if (process.argv.includes('--built')) {
  const base = '.output/public'
  const directory = readFileSync(`${base}/tags/index.html`, 'utf8')
  const payload = parse(readFileSync(`${base}/tags/_payload.json`, 'utf8'), {
    ShallowReactive: value => value, ShallowRef: value => value,
    Reactive: value => value, Ref: value => value,
  })
  const actualTopics = collectTopics(payload.data['topic-directory'])
  assert(actualTopics.length > 0)
  for (const topic of actualTopics) {
    const slug = getTagSlug(topic.name)
    assert(directory.includes(`/inkroam/tags/${slug}`), `Directory links ${topic.name}`)
    const detail = readFileSync(`${base}/tags/${slug}/index.html`, 'utf8')
    assert(detail.includes(`共 ${topic.count} 篇内容`), `Count matches ${topic.name}`)
    assert(detail.includes('全部话题'))
  }
  assert(readFileSync(`${base}/archive/index.html`, 'utf8').includes('按话题浏览'))
  assert(readFileSync(`${base}/index.html`, 'utf8').includes('按话题探索'))
  assert(readFileSync(`${base}/tags/thinking/index.html`, 'utf8').includes('aria-label="内容类型"'))
}
console.log('PASS: topic counts, duplicate/draft filtering, stable sort, name filter, slugs and requested static checks.')
