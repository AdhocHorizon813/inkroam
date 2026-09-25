import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const source = readFileSync('app/components/SearchFilterSelect.vue', 'utf8')
const script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1]
const events = []
const watches = []
const props = { label: '标签', modelValue: 'math', enabled: true, options: [
  { value: '', label: '全部标签' }, { value: 'math', label: '数学' }, { value: 'gpt', label: 'GPT-6 Astra' },
] }
const context = vm.createContext({
  useSearchPopover() {},
  defineProps: () => props, defineEmits: () => (...args) => events.push(args),
  ref: value => ({ value }), computed: fn => ({ get value() { return fn() } }),
  watch: (source, fn) => watches.push(fn), useId: () => 'test', nextTick: async () => {},
  onMounted() {}, onBeforeUnmount() {},
})
vm.runInContext(`${ts.transpile(script, { target: ts.ScriptTarget.ES2022 })}\nglobalThis.state = { toggle, close, choose, keydown, open, query, active, filtered, selected }`, context)
const s = context.state
assert.equal(s.selected.value, '数学')
await s.toggle()
assert(s.open.value)
assert.equal(s.active.value, 1)
s.query.value = 'gpt astra'
watches[0]()
assert.equal(s.filtered.value.length, 1)
assert.equal(s.filtered.value[0].value, 'gpt')
const key = value => ({ key: value, preventDefault() {}, stopPropagation() {} })
s.keydown(key('Enter'))
assert.deepEqual(events.pop(), ['update:modelValue', 'gpt'])
assert(!s.open.value)
await s.toggle()
s.query.value = '不存在'
watches[0]()
s.keydown(key('Enter'))
assert.equal(events.length, 0, 'Empty results must not select a value')
s.keydown(key('Escape'))
assert(!s.open.value)
await s.toggle()
watches[1](false)
assert(!s.open.value, 'Collapsing advanced search closes dropdown')
await s.toggle()
assert(s.open.value, 'Dropdown opens again once the advanced panel is expanded')
watches[2](true)
assert(!s.open.value, 'Disabling a filter (course while the type is not notes) closes its dropdown')
props.disabled = true
await s.toggle()
assert(!s.open.value, 'A disabled filter does not open')
props.disabled = false
assert.match(source, /role="combobox"/)
assert.doesNotMatch(source, /✓/)
assert.match(source, /class="filter-option-check"/)
assert.match(source, /li.is-active \.filter-option-label \{ text-decoration: underline/)
assert.match(source, /prefers-reduced-motion/)
assert.match(source, /grid-template-rows:\s*0fr/)
assert.match(source, /grid-template-rows:\s*1fr/)
assert.match(source, /:disabled="disabled"/)
assert.match(source, /is-disabled/)
const advanced = readFileSync('app/components/SearchAdvanced.vue', 'utf8')
assert.doesNotMatch(advanced, /<select\b/)
assert.match(advanced, /:disabled="modelValue\.type !== 'notes'"/, 'Course filter must be gated on the notes type')
assert.doesNotMatch(advanced, /next\.type = 'notes'/, 'Course must not silently switch the content type to notes')
assert.match(advanced, /if \(key === 'type' && value !== 'notes'\) next\.course = ''/, 'Leaving the notes type must clear the course filter')
/* 下拉浮层与日期框的观感契约（源码层，浏览器渲染不在本脚本范围内）。 */
const materials = readFileSync('app/assets/css/main.css', 'utf8')
assert.match(source, /filter-surface dropdown-surface/)
assert.match(materials, /blur\(var\(--dropdown-blur\)\)/, 'Shared material uses its own blur channel')
assert.doesNotMatch(source, /blur\(var\(--(?:nav|content)-blur\)\)/, 'Dropdown blur must not borrow the nav or content blur')
assert.equal((advanced.match(/<SearchDatePicker\b/g) || []).length, 2)
const calendar = readFileSync('app/components/SearchDatePicker.vue', 'utf8')
assert.doesNotMatch(calendar, /type="date"/)
assert.match(calendar, /stroke: currentColor/)
assert.match(calendar, /height: 39px/)
assert.match(calendar, /calendar-surface dropdown-surface/)
assert.match(calendar, /role="dialog"/)
assert.match(calendar, /role="grid"/)
props.enabled = false
await s.toggle()
assert(!s.open.value, 'Collapsed parent must not open a dropdown')
props.enabled = true
await s.toggle()
s.keydown({ ...key('Enter'), isComposing: true })
assert.equal(events.length, 0, 'IME confirmation must not select a filter')
const panel = readFileSync('app/components/AppearancePanel.vue', 'utf8')
assert.match(panel, /root.dataset.dropdownMaterial = state.dropdownMaterial/)
assert.match(panel, /下拉框材质/)
assert.doesNotMatch(panel, /只作用于搜索页的筛选浮层/)
assert.doesNotMatch(source + calendar, /--dropdown-veil/)
for (const material of ['liquid', 'acrylic']) assert(materials.includes(`[data-dropdown-material='${material}'] .dropdown-surface`))
assert.match(panel, /dropdownBlur: number/, 'Appearance state carries an independent dropdown blur')
assert.match(panel, /setProperty\('--dropdown-blur', `\$\{state\.dropdownBlur\}px`\)/, 'The dropdown blur must be written to the custom property')
assert.match(panel, /v-model\.number="state\.dropdownBlur"/, 'The appearance panel exposes a dropdown blur control')
assert.match(readFileSync('app/assets/css/main.css', 'utf8'), /--dropdown-blur: 12px/, 'The dropdown blur needs a default before the panel hydrates')
console.log('PASS: searchable filter selection, empty states, keyboard confirmation/Escape, collapse cleanup, the course-only-for-notes gate, and the dropdown-blur / date-field contracts. Visual animation is not tested.')
