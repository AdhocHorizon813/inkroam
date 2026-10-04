import assert from 'node:assert/strict'
import { treeWalkFrames } from '../app/utils/tree-walk.mjs'
for (const [mode, expected] of Object.entries({ pre: 'ABDECF', in: 'DBEACF', post: 'DEBFCA', level: 'ABCDEF' })) {
  const frames = treeWalkFrames(mode)
  assert.equal(frames.at(-1).visited.join(''), expected)
  assert.equal(frames.at(-1).pending.length, 0)
  assert.equal(frames[0].visited.length, 0)
  for (let i = 1; i < frames.length; i++) {
    assert.equal(new Set(frames[i].visited).size, frames[i].visited.length)
    assert.ok(frames[i].visited.length - frames[i-1].visited.length <= 1)
    assert.deepEqual(frames[i].visited.slice(0, frames[i-1].visited.length), frames[i-1].visited)
  }
}
assert.throws(() => treeWalkFrames('invalid'))
console.log('PASS: four traversal orders, independent snapshots and monotone visits')
