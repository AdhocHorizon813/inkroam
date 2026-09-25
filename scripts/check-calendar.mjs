import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import * as dates from '../app/utils/calendar-date.ts'

assert(dates.validCalendarDate('2024-02-29'))
for (const value of ['2023-02-29', '2026-04-31', '0000-01-01', '2026-1-01', 'no']) assert(!dates.validCalendarDate(value))
assert.equal(dates.shiftCalendarMonth('2024-01-31', 1), '2024-02-29')
assert.equal(dates.shiftCalendarMonth('2024-02-29', 12), '2025-02-28')
assert.equal(dates.shiftCalendarMonth('0001-01-01', -1), '0001-01-01')
assert.equal(dates.shiftCalendarDate('2026-12-31', 1), '2027-01-01')
assert.equal(dates.shiftCalendarDate('9999-12-31', 1), '9999-12-31')
const grid = dates.calendarDays('2026-09-25')
assert.equal(grid.length, 42)
assert.equal(new Date(`${grid[0]}T00:00:00Z`).getUTCDay(), 1)
assert.equal(new Set(grid).size, 42)
assert(grid.includes('2026-09-01') && grid.includes('2026-09-30'))
assert(dates.withinDateRange('2026-09-25', '2026-09-25', '2026-09-25'))
assert(!dates.withinDateRange('2026-09-24', '2026-09-25'))

/* 输入掩码：只留数字，按 4-2-2 补横线，第 9 个数字直接被切掉。
   月份/日期只按两位读，所以「2026-9-5」这种一位数写法不在支持范围内（会变成 2026-95，
   失焦时按无效日期退回上一个有效值）。 */
assert.equal(dates.maskDateInput(''), '')
assert.equal(dates.maskDateInput('2026'), '2026')
assert.equal(dates.maskDateInput('20260'), '2026-0')
assert.equal(dates.maskDateInput('2026-09'), '2026-09')
assert.equal(dates.maskDateInput('2026-09-25'), '2026-09-25', 'Masking is idempotent')
assert.equal(dates.maskDateInput('2026/09/25'), '2026-09-25', 'Other separators are dropped, digits keep their order')
assert.equal(dates.maskDateInput('202609251234'), '2026-09-25', 'The 9th digit never fits')
assert.equal(dates.maskDateInput('２０２６'), '', 'Full-width digits are not dates')

const source = readFileSync('app/components/SearchDatePicker.vue', 'utf8')
const script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1].replace(/^import .*$/m, '')
const props = { label: 'Date', modelValue: '2026-09-25', enabled: true, min: '2026-09-01', max: '2026-10-31' }
const events = [], watches = []
const context = vm.createContext({ ...dates,
  useSearchPopover() {},
  defineProps: () => props, defineEmits: () => (...args) => events.push(args),
  ref: value => ({ value }), computed: fn => ({ get value() { return fn() } }),
  watch: (_, fn) => watches.push(fn), useId: () => 'test', nextTick: async () => {},
  onMounted() {}, onBeforeUnmount() {},
})
vm.runInContext(`${ts.transpile(script, { target: ts.ScriptTarget.ES2022 })}\nglobalThis.state = { toggle, close, select, commit, onInput, dayKey, changeMonth, open, draft, error, cursor }`, context)
const s = context.state
await s.toggle()
assert(s.open.value)
assert.equal(s.cursor.value, props.modelValue)
const key = (key, shiftKey = false) => ({ key, shiftKey, preventDefault() {} })
s.dayKey(key('ArrowDown'))
assert.equal(s.cursor.value, '2026-10-02')
s.dayKey(key('Home'))
assert.equal(s.cursor.value, '2026-09-28')
s.dayKey(key('PageDown'))
assert.equal(s.cursor.value, '2026-10-28')
s.dayKey(key('PageDown'))
assert.equal(s.cursor.value, props.max)
/* 写作中输入：能补齐就补横线，补不满也不报错（那是掩码，不是校验器）。 */
const field = { value: '2026092' }
s.onInput({ target: field })
assert.equal(s.draft.value, '2026-09-2')
assert.equal(field.value, '2026-09-2', 'The input element is rewritten in place')
s.onInput({ target: field })
assert.equal(field.value, '2026-09-2', 'Masking is idempotent')
assert(!s.error.value)
/* 已是满掩码时再打一个数字：maxlength="10" 会挡住按键，掩码这里也不能多读。 */
field.value = '2026-09-25-9'
s.onInput({ target: field })
assert.equal(field.value, '2026-09-25')
s.draft.value = '2026-02-30'
s.commit()
/* 不是真实日期：不报错，静默退回上一个有效值。 */
assert.equal(s.draft.value, props.modelValue, 'Impossible dates fall back to the last valid one')
assert(!s.error.value, 'The format warning is gone: the field masks itself')
assert.equal(events.length, 0)
/* 超出所选范围照样提示：掩码管形状，上下限仍归 min/max 管。 */
s.draft.value = '2026-08-01'
s.commit()
assert(s.error.value)
assert.equal(events.length, 0)
s.draft.value = '2026-09-30'
s.commit()
assert(!s.error.value)
assert.deepEqual(events.pop(), ['update:modelValue', '2026-09-30'])
s.select('2026-08-01')
assert.equal(events.length, 0)
s.select('2026-10-01')
assert.deepEqual(events.pop(), ['update:modelValue', '2026-10-01'])
assert(!s.open.value)
s.select('')
assert.deepEqual(events.pop(), ['update:modelValue', ''])
await s.toggle()
watches[1](false)
assert(!s.open.value)
props.enabled = false
await s.toggle()
assert(!s.open.value)
assert.doesNotMatch(source, /@focus="cursor = day"/, 'Adjacent-month pointer focus must not rebuild the grid before click')
assert.doesNotMatch(source, /请输入有效日期/, 'The format warning is gone: typing is masked instead')
assert.doesNotMatch(source, /align-end/, 'Top-layer popovers are positioned by useSearchPopover, never by the component')
assert.match(source, /prefers-reduced-motion/)
assert.match(source, /\.date-field:focus-within \{ outline: 2px solid var\(--accent\)/)
assert.match(source, /\.date-field :is\(input,button\):focus-visible \{ outline: none !important/)
console.log('PASS: calendar date bounds, leap years, month grid, keyboard navigation, input masking, manual validation, selection and collapse cleanup. Browser visuals not tested.')
