import assert from 'node:assert/strict'
import { resolveActiveHeading } from '../app/utils/toc-active.ts'

const bottom = [
  { id: '范数收敛', top: -80, margin: 100 },
  { id: '范数练习', top: 155, margin: 100 },
  { id: 'pdf-内嵌测试', top: 320, margin: 100 },
]
assert.equal(resolveActiveHeading(bottom, '#pdf-%E5%86%85%E5%B5%8C%E6%B5%8B%E8%AF%95', 700, 700, 100), 'pdf-内嵌测试')
assert.equal(resolveActiveHeading(bottom, '#范数练习', 700, 700, 100), '范数练习', 'Two clamped destinations remain distinguishable by hash')
assert.equal(resolveActiveHeading(bottom, '', 700, 700, 100), 'pdf-内嵌测试', 'Manual scrolling to the bottom')
assert.equal(resolveActiveHeading(bottom, '#pdf-内嵌测试', 500, 900, 100), '范数收敛', 'An old hash does not lock manual scroll')
assert.equal(resolveActiveHeading([{ id: 'a', top: 100, margin: 100 }], '#a', 200, 900, 100), 'a')
assert.equal(resolveActiveHeading(bottom, '', 0, 0, 100), '范数收敛', 'Short unscrollable page starts with first heading')
assert.equal(resolveActiveHeading(bottom, '#%xx', 500, 900, 100), '范数收敛')
assert.equal(resolveActiveHeading([], '#a', 0, 0, 100), '')
console.log('PASS: clamped anchors, encoded IDs, bottom detection, manual scroll and empty/short pages.')
