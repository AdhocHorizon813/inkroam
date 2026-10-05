import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse } from 'devalue'
import { courseNeighbours } from '../app/utils/course-sequence.ts'

const make = (slug, date, order, course = 'a', draft = false) => ({ path: `/notes/${course}/${slug}`, date, order, draft })
const notes = [make('late', '2026-02-01'), make('second', '2026-03-01', 2), make('first', '2026-05-01', 1), make('early', '2026-01-01'), make('hidden', '2026-01-01', 0, 'a', true), make('other', '2026-01-01', 0, 'b')]
assert.equal(courseNeighbours('/notes/a/second', notes).previous.path, '/notes/a/first')
assert.equal(courseNeighbours('/notes/a/second', notes).next.path, '/notes/a/early')
assert.equal(courseNeighbours('/notes/a/first', notes).previous, undefined)
assert.equal(courseNeighbours('/notes/a/late', notes).next, undefined)
assert.equal(courseNeighbours('/posts/a', notes).next, undefined)
assert.equal(courseNeighbours('/notes/a/missing', notes).next, undefined)
assert.equal(courseNeighbours('/notes/a/one', [make('one', '2026-01-01')]).previous, undefined)
assert.equal(courseNeighbours('/notes/a/early', notes).next.path, '/notes/a/late')

const sequence = [0, 1, 2, 9, 10, 17].map(n => make(`lesson-${n}`, '2026-01-01', String(n)))
const shuffled = [...sequence].reverse()
for (let i = 0; i < sequence.length; i++) {
  const neighbours = courseNeighbours(sequence[i].path, shuffled)
  assert.equal(neighbours.previous?.path, sequence[i - 1]?.path)
  assert.equal(neighbours.next?.path, sequence[i + 1]?.path)
}
assert.deepEqual(shuffled, [...sequence].reverse(), 'Sorting must not mutate query data')
for (const order of [undefined, null, '', ' ', 'invalid', -1, 1.5]) {
  assert.equal(courseNeighbours(sequence.at(-1).path, [...sequence, make('unordered', '2025-01-01', order)]).next?.path, '/notes/a/unordered')
}

if (process.argv.includes('--built')) {
  const load = path => parse(readFileSync(`.output/public/${path}_payload.json`, 'utf8'), {
    ShallowReactive: value => value, ShallowRef: value => value,
    Reactive: value => value, Ref: value => value,
  }).data
  for (const path of ['', 'archive/', 'notes/', 'tags/thinking/', 'posts/004world-inside-a-black-hole/']) {
    const data = load(path)
    for (const [key, value] of Object.entries(data)) {
      if (!Array.isArray(value)) continue
      for (const item of value) {
        if (item && typeof item === 'object') {
          assert(!('body' in item), `${path}:${key} must not ship body for list items`)
          assert(!('rawbody' in item), 'No raw body')
        }
      }
    }
  }
  const article = Object.values(load('posts/004world-inside-a-black-hole/')).find(value => value?.body)
  assert(article, 'The article reader still receives its own complete body')
  const lessons = load('notes/data-structures/00-study-guide/')['course-sequence-data-structures']
    .toSorted((a, b) => Number(a.order) - Number(b.order))
  assert(lessons.length >= 18, 'Validate the real course, including two-digit lesson orders')
  for (let i = 0; i < lessons.length; i++) {
    const html = readFileSync(`.output/public${lessons[i].path}/index.html`, 'utf8')
    const nav = html.match(/<nav[^>]*aria-label="课程阅读导航"[\s\S]*?<\/nav>/)?.[0]
    assert(nav, `${lessons[i].path}: navigation exists`)
    // Curated reading clues are separate from the original sequence controls.
    const sequenceNav = nav.split(/<ul[^>]*class="course-navigation__reading"/)[0]
    const links = [...sequenceNav.matchAll(/href="([^"]+)"/g)].map(match => match[1].replace(/^\/inkroam(?=\/)/, ''))
    assert.deepEqual(links, ['/notes/data-structures', lessons[i - 1]?.path, lessons[i + 1]?.path].filter(Boolean), `${lessons[i].path}: rendered previous/next links`)
  }
}
console.log('PASS: course order, boundaries, drafts, course isolation and requested payload checks.')

if (process.argv.includes('--live')) {
  const page = async path => {
    const response = await fetch(`http://127.0.0.1:3000${path}`)
    assert.equal(response.status, 200)
    const html = await response.text()
    return html.match(/<main[\s\S]*?<\/main>/)?.[0] || ''
  }
  const filtered = await page('/tags/thinking?type=notes&q=thinking')
  assert(!filtered.includes('href="/posts/'), 'Type query excludes articles')
  assert(/<button[^>]*aria-pressed="true"[^>]*>\s*笔记/.test(filtered), 'Type query selects note button')
  assert(filtered.includes('/tags?q=thinking'), 'Directory backlink preserves query')
  const directory = await page('/tags?q=GPT-6%20Astra')
  assert(directory.includes('gpt-6-astra') && !/class="topic-name"[^>]*>思考/.test(directory), 'Directory query restored from URL')
  assert(!(await page('/tags?q=unknown-topic-9876')).includes('class="topic-link"'), 'Empty filter from URL')
  console.log('PASS: direct URL type/name filters and directory backlink (SSR).')
}
