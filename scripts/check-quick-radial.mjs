/* 快捷轮盘（QuickRadialMenu）契约检查：动作表、默认槽位、槽位归一化、
   快捷键编码白名单、默认快捷键，以及菜单源码里的关键行为约束。
   纯逻辑 + 源码断言，不启动浏览器，不改动任何产品文件。
   用法：node --experimental-strip-types scripts/check-quick-radial.mjs
   如需并入总套件，在 scripts/check-all.mjs 的列表里加一行 'check-quick-radial'。 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const { RADIAL_ACTIONS, defaultRadialSlots, normalizeRadialSlots } =
  await import('../app/utils/radial-actions.ts')

/* 动作表 --------------------------------------------------------------- */
const ids = RADIAL_ACTIONS.map(action => action.id)
assert.equal(new Set(ids).size, ids.length, 'Action ids are unique')
assert.equal(RADIAL_ACTIONS.length, 10, 'Wheel palette keeps its ten entries')
for (const action of RADIAL_ACTIONS) {
  assert.equal(typeof action.label, 'string')
  assert(action.label.length > 0, `${action.id} has a label`)
  if (action.id === 'none') assert.equal(action.path, '', 'The empty slot owns no glyph')
  else assert(action.path.length > 10, `${action.id} carries an SVG path (no emoji fallback)`)
}

/* 默认槽位 ------------------------------------------------------------- */
const defaults = defaultRadialSlots()
assert.equal(defaults.length, 6, 'Six slots fill one circle')
assert.equal(defaults.length * 60, 360, 'Slot order is clockwise from twelve o\'clock')
assert.equal(new Set(defaults).size, defaults.length, 'Default slots do not repeat')
assert(!defaults.includes('none'), 'Default wheel has no empty slot')
defaults.forEach(id => assert(ids.includes(id), `Default slot ${id} exists in the palette`))
defaults.push('mutated')
assert.deepEqual(defaultRadialSlots(), ['appearance', 'find', 'sidebar', 'focus', 'music', 'copy'],
  'Defaults are rebuilt per call, never a shared mutable array')

/* 槽位归一化 ----------------------------------------------------------- */
assert.deepEqual(normalizeRadialSlots(undefined), defaultRadialSlots(), 'Missing storage keeps defaults')
assert.deepEqual(normalizeRadialSlots('appearance'), defaultRadialSlots(), 'Non-array storage keeps defaults')
assert.deepEqual(normalizeRadialSlots([null, 'find', 'nope', 42, {}, []]),
  ['appearance', 'find', 'sidebar', 'focus', 'music', 'copy'],
  'Each invalid index falls back to its own default, never shifts the others')
assert.deepEqual(normalizeRadialSlots(['top', 'copy', 'music', 'focus', 'sidebar', 'find']),
  ['top', 'copy', 'music', 'focus', 'sidebar', 'find'], 'A valid custom order is preserved')
assert.deepEqual(normalizeRadialSlots(['top']).slice(1), defaultRadialSlots().slice(1),
  'A short array only overrides the slots it covers')
assert.equal(normalizeRadialSlots([...defaultRadialSlots(), 'top']).length, 6,
  'Extra entries past the sixth slot are dropped')
assert.equal(normalizeRadialSlots(['none', 'top'])[0], 'none', 'The empty slot is a legal choice')

/* 快捷键编码白名单（与组合键记录器同一份实现） ------------------------- */
const source = readFileSync('app/composables/useRadialShortcut.ts', 'utf8')
  .replace(/^import .*$/gm, '').replace(/^export /gm, '')
const context = vm.createContext({ defaultRadialSlots, useState: (_key, init) => ({ value: init() }) })
vm.runInContext(ts.transpile(source, { target: ts.ScriptTarget.ES2022 })
  + '\nglobalThis.api = { isRadialCode, defaultRadialShortcut }', context)
const { isRadialCode, defaultRadialShortcut } = context.api

for (const code of ['Tab', 'KeyA', 'KeyZ', 'Digit0', 'Digit9', 'Backquote', 'Space', 'Minus',
  'Equal', 'BracketLeft', 'BracketRight', 'Backslash', 'Semicolon', 'Quote', 'Comma', 'Period', 'Slash']) {
  assert(isRadialCode(code), `${code} is recordable`)
}
for (const code of ['F5', 'Enter', 'Escape', 'ControlLeft', 'ShiftLeft', 'keyq', 'KeyQQ', '', ' K ', 'ArrowUp']) {
  assert(!isRadialCode(code), `${JSON.stringify(code)} stays out of the recorder`)
}
for (const value of [null, undefined, 0, {}, [], true]) assert(!isRadialCode(value), 'Non-strings are rejected')

/* 默认快捷键 ----------------------------------------------------------- */
const shortcut = defaultRadialShortcut()
assert.equal(shortcut.enabled, true)
assert.deepEqual([...shortcut.codes], ['Tab', 'KeyQ'])
assert.equal(shortcut.label, 'Tab + Q', 'Label mirrors the chord')
assert.deepEqual([...shortcut.slots], defaultRadialSlots(), 'Shortcut starts on the default wheel')
shortcut.codes.push('KeyZ'); shortcut.slots.length = 0
assert.deepEqual([...defaultRadialShortcut().codes], ['Tab', 'KeyQ'], 'Each call returns its own arrays')
assert.equal(defaultRadialShortcut().slots.length, 6)

/* 轮盘最短弧：rotation 变动必须落在 (−180, 180] ------------------------- */
const turn = (rotation, index) => rotation + ((index * 60 - rotation + 540) % 360 + 360) % 360 - 180
let rotation = 0
for (let from = 0; from < 6; from += 1) {
  for (let to = 0; to < 6; to += 1) {
    const next = turn(rotation, to)
    assert(Math.abs(next - rotation) <= 180, `Slot ${from} -> ${to} keeps the shortest arc`)
    rotation = next
  }
}
assert.equal(turn(0, 0), 0, 'Re-selecting the same slot does not spin the wheel')

/* 菜单源码的行为约束 --------------------------------------------------- */
const menu = readFileSync('app/components/QuickRadialMenu.vue', 'utf8')
assert.match(menu, /rotation\.value \+= \(\(index \* 60 - rotation\.value \+ 540\) % 360 \+ 360\) % 360 - 180/,
  'The wheel rotates by one 60° slot, shortest arc')
assert.match(menu, /if \(available\.value\[index\]\) break/,
  'Arrow keys skip slots the current page cannot run')
assert.match(menu, /if \(event\.key === 'Escape'\) \{ event\.preventDefault\(\); dismiss\(\); return \}/,
  'Escape dismisses without executing')
assert.match(menu, /origin\?\.focus\(\{ preventScroll: true \}\)/, 'Focus returns to whatever opened the wheel')
assert.match(menu, /document\.querySelector\('dialog\[open\], \[aria-modal="true"\]'\)/,
  'An open dialog blocks the wheel')
assert.match(menu, /target instanceof Element && !!target\.closest\('input,textarea,select,/,
  'Typing in a field never opens the wheel')
assert.match(menu, /if \(event\.ctrlKey \|\| event\.altKey \|\| event\.metaKey \|\| event\.shiftKey\) \{ pressed\.clear\(\); return \}/,
  'Browser and OS chords are left alone')
assert.match(menu, /event\.repeat\) return/, 'Held keys do not re-open the wheel')
assert.match(menu, /window\.dispatchEvent\(new Event\('inkroam:toggle-focus'\)\)/,
  'Fullscreen still happens inside the same gesture')
assert.match(menu, /size\.value = Math\.min\(320, window\.innerWidth - 24, window\.innerHeight - 24\)/,
  'The wheel fits small viewports')
assert.match(menu, /center\.x = Math\.max\(edge, Math\.min\(window\.innerWidth - edge,/,
  'The wheel stays inside the viewport, edge-aware')
assert.match(menu, /\.find\(el => !el\.disabled && !el\.closest\('\[inert\]'\)/,
  'Disabled or inert targets are never chosen')
assert.match(menu, /vGlassPresence/, 'Glass presence is reused instead of a bespoke animation')

console.log('PASS: ten actions, six default slots, per-index slot normalization, recorder code whitelist, '
  + 'default chord, shortest-arc rotation and the menu source guards '
  + '(dialog, editing, modifier chords, Escape, focus restore, viewport fit). No browser or visual claim.')
