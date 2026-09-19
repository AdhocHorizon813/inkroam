import assert from 'node:assert/strict'
import { readFile, access } from 'node:fs/promises'
import { courses } from '../app/utils/courses.ts'
import { parse } from 'devalue'

const base = '.output/public'
const html = async path => (await readFile(`${base}/${path ? `${path}/` : ''}index.html`, 'utf8')).replace(/<!--[\s\S]*?-->/g, '')
const home = await html('')
const notes = await html('notes')
const archive = await html('archive')
assert(home.indexOf('id="latest"') < home.indexOf('id="latest-notes"'), 'Notes follow recent articles')
assert.match(home, />笔记<\/a>/)
assert(home.indexOf('>笔记</a>') < home.indexOf('>归档</a>'), 'Navigation order')
for (const course of courses) {
  assert(notes.includes(`/notes/${course.slug}`), `Course link: ${course.slug}`)
  const page = await html(`notes/${course.slug}`)
  assert(page.includes(`<h1>${course.name}</h1>`), `Chinese title: ${course.name}`)
}
assert(!home.includes('Notes regression draft fixture'), 'Home excludes draft')
assert(!notes.includes('Notes regression draft fixture'), 'Notes exclude draft')
assert(!archive.includes('Notes regression draft fixture'), 'Archive excludes draft')

if (process.argv.includes('--fixtures')) {
  const title = 'Notes regression public fixture'
  for (const page of [home, notes, archive, await html('notes/functional-analysis')]) assert(page.includes(title))
  assert(!(await html('notes/stochastic-processes')).includes(title), 'No cross-course results')
  const articles = home.slice(home.indexOf('id="latest"'), home.indexOf('id="latest-notes"'))
  assert(!articles.includes(title), 'Notes do not enter recent articles')
  const page = await html('notes/functional-analysis/notes-regression-fixture')
  assert(page.includes('article-content'), 'Shared reader')
  assert(page.includes('katex'), 'Note math rendering')
  assert(page.includes('范数与极限'), 'Note headings')
  const search = parse(await readFile(`${base}/search/_payload.json`, 'utf8'), {
    ShallowReactive: value => value, ShallowRef: value => value,
    Reactive: value => value, Ref: value => value,
  })
  assert(search.data['search-posts'].some(post => post.title === title), 'Search title index includes notes')
  assert(search.data['post-search-sections-readable-math'].some(section => section.content.includes('notesfixture')), 'Search body index includes notes')
  assert(!JSON.stringify(search).includes('Notes regression draft fixture'), 'Search excludes draft')
  await assert.rejects(access(`${base}/notes/stochastic-processes/notes-regression-draft/index.html`))
}
console.log('Notes regression checks passed.')
