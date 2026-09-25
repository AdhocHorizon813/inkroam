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
vm.runInContext(`${ts.transpile(script, { target: ts.ScriptTarget.ES2022 })}\nglobalThis.state = { toggle, close, select, commit, dayKey, changeMonth, open, draft, error, cursor }`, context)
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
s.draft.value = '2026-02-30'
s.commit()
assert(s.error.value)
assert.equal(events.length, 0)
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
assert.match(source, /prefers-reduced-motion/)
assert.match(source, /\.date-field:focus-within \{ outline: 2px solid var\(--accent\)/)
assert.match(source, /\.date-field :is\(input,button\):focus-visible \{ outline: none !important/)
console.log('PASS: calendar date bounds, leap years, month grid, keyboard navigation, manual validation, selection and collapse cleanup. Browser visuals not tested.')
