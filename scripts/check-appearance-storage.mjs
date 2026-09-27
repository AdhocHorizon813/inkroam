import assert from 'node:assert/strict'
import { decodeAppearanceStorage } from '../app/utils/appearance-storage.ts'

// Original implementation retained as a behavioral oracle, not product code.
function original(saved, legacy) {
  if (saved) return JSON.parse(saved)
  if (!legacy) return null
  const { blur, ...previous } = JSON.parse(legacy)
  if (typeof blur !== 'number') return previous
  return { ...previous, navBlur: blur, contentBlur: blur, dropdownBlur: blur }
}
const samples = [null, '', '{}', 'null', '[]', 'false', '0', '"text"', '{broken',
  JSON.stringify({ blur: 24, navBlur: 9, contentBlur: 7, dropdownBlur: 3, backgroundBlur: 2, backgroundPicked: true, accent: '#c45b45', backgroundTint: false }),
  JSON.stringify({ blur: '24', colorMode: 'dark', defaultSettings: false }),
  JSON.stringify({ dropdownMaterial: 'invalid', dropdownBlur: -3, latestPostCount: 999 }),
]
const outcome = (fn, ...args) => {
  try { return { value: fn(...args) } }
  catch (error) { return { error: error.name } }
}
for (const saved of samples) for (const legacy of samples) {
  assert.deepEqual(outcome(decodeAppearanceStorage, saved, legacy), outcome(original, saved, legacy))
}
assert.deepEqual(decodeAppearanceStorage('{"navBlur":8}', '{broken'), { navBlur: 8 })
assert.deepEqual(decodeAppearanceStorage(null, '{"blur":23,"backgroundBlur":2}'), {
  navBlur: 23, contentBlur: 23, dropdownBlur: 23, backgroundBlur: 2,
})
assert.throws(() => decodeAppearanceStorage('{broken', '{}'), SyntaxError)
console.log(`PASS: ${samples.length ** 2} storage compatibility cases, v5 precedence and v4 blur migration. No new validation or defaults introduced.`)
