import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import postcss from 'postcss'

// Guard the audited top-level cascade. Media/supports/layer rules are deliberately
// excluded: their conditions are part of the design, not accidental duplication.
const root = postcss.parse(readFileSync('app/assets/css/main.css', 'utf8').replaceAll('\r\n', '\n'))
const groups = new Map()
for (const rule of root.nodes) {
  if (rule.type !== 'rule') continue
  for (const decl of rule.nodes) {
    if (decl.type !== 'decl') continue
    const key = `${rule.selector} | ${decl.prop}`
    const values = groups.get(key) || []
    values.push({ value: decl.value, important: !!decl.important })
    groups.set(key, values)
  }
}
const exceptions = JSON.parse(readFileSync(new URL('./css-cascade-exceptions.json', import.meta.url), 'utf8'))
assert(exceptions.every(entry => entry.reason), 'Each retained override needs an explanation')
const approved = new Map(exceptions.map(({ key, values }) => [key, values]))
const duplicates = new Map([...groups].filter(([, values]) => values.length > 1))
assert.deepEqual(duplicates, approved, 'Unreviewed CSS override: edit the owning rule instead of appending a patch, or document a justified exception')
console.log(`PASS: top-level CSS cascade has only ${approved.size} documented compatibility/priority exceptions. Not a visual test.`)
