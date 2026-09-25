<script setup lang="ts">
import { calendarDays, maskDateInput, shiftCalendarDate, shiftCalendarMonth, validCalendarDate, withinDateRange } from '~/utils/calendar-date'

const props = defineProps<{ label: string; modelValue: string; enabled: boolean; min?: string; max?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const id = useId()
const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const open = ref(false)
const popup = ref<HTMLElement | null>(null)
useSearchPopover(root, popup, open, 270)
const draft = ref(props.modelValue)
const error = ref('')
const cursor = ref('2000-01-01')
const today = ref('')
const days = computed(() => calendarDays(cursor.value))
const weeks = computed(() => Array.from({ length: 6 }, (_, i) => days.value.slice(i * 7, i * 7 + 7)))
const monthLabel = computed(() => `${Number(cursor.value.slice(0, 4))} 年 ${Number(cursor.value.slice(5, 7))} 月`)
const allowed = (value: string) => withinDateRange(value, props.min, props.max)
watch(() => props.modelValue, value => { draft.value = value; error.value = '' })
watch(() => props.enabled, value => { if (!value) close() })

function close(restore = false) {
  open.value = false
  if (restore) trigger.value?.focus({ preventScroll: true })
}
function select(value: string) {
  if (value && !allowed(value)) return
  draft.value = value
  error.value = ''
  emit('update:modelValue', value)
  close(true)
}
/* 边打边成型：输入框里永远是 maskDateInput 的结果，位数写不全也不报错。 */
function onInput(event: Event) {
  const input = event.target as HTMLInputElement
  const masked = maskDateInput(input.value)
  draft.value = masked
  if (input.value !== masked) input.value = masked
  error.value = ''
}
function commit() {
  const value = draft.value.trim()
  /* 位数不够或不是真实日期（2026-02-30）：静默退回上一个有效值，不再提示格式。 */
  if (value && !validCalendarDate(value)) {
    draft.value = props.modelValue
    error.value = ''
    return
  }
  if (value && !allowed(value)) { error.value = '日期超出所选范围，请调整开始或结束日期。'; return }
  error.value = ''
  if (value !== props.modelValue) emit('update:modelValue', value)
}
function clamp(value: string) {
  if (props.min && value < props.min) return props.min
  if (props.max && value > props.max) return props.max
  return value
}
async function focusDay() {
  await nextTick()
  root.value?.querySelector<HTMLButtonElement>(`[data-day="${cursor.value}"]`)?.focus({ preventScroll: true })
}
async function toggle() {
  if (!props.enabled) return
  if (open.value) { close(); return }
  const now = new Date()
  today.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  cursor.value = clamp(validCalendarDate(props.modelValue) ? props.modelValue : today.value)
  open.value = true
  await focusDay()
}
function changeMonth(offset: number) { cursor.value = clamp(shiftCalendarMonth(cursor.value, offset)) }
function dayKey(event: KeyboardEvent) {
  const offsets: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
  let next = cursor.value
  if (event.key in offsets) next = shiftCalendarDate(cursor.value, offsets[event.key]!)
  else if (event.key === 'PageUp' || event.key === 'PageDown') next = shiftCalendarMonth(cursor.value, (event.key === 'PageUp' ? -1 : 1) * (event.shiftKey ? 12 : 1))
  else if (event.key === 'Home' || event.key === 'End') {
    const day = (new Date(`${cursor.value}T00:00:00Z`).getUTCDay() + 6) % 7
    next = shiftCalendarDate(cursor.value, event.key === 'Home' ? -day : 6 - day)
  } else return
  event.preventDefault()
  cursor.value = clamp(next)
  focusDay()
}
function outside(event: PointerEvent) {
  if (event.target instanceof Node && !root.value?.contains(event.target)) close()
}
function focusout(event: FocusEvent) {
  if (!(event.relatedTarget instanceof Node) || !root.value?.contains(event.relatedTarget)) close()
}
onMounted(() => document.addEventListener('pointerdown', outside))
onBeforeUnmount(() => document.removeEventListener('pointerdown', outside))
</script>

<template>
  <div ref="root" class="date-picker" :class="{ 'is-open': open }" @focusout="focusout" @keydown.esc.stop.prevent="close(true)">
    <label :for="`${id}-input`" class="date-label">{{ label }}</label>
    <div class="date-field">
      <input :id="`${id}-input`" v-model="draft" type="text" placeholder="YYYY-MM-DD" maxlength="10" autocomplete="off" :aria-invalid="!!error" :aria-describedby="error ? `${id}-error` : undefined" @input="onInput" @blur="commit" @keydown.enter.prevent="commit">
      <button ref="trigger" type="button" :aria-label="`选择${label}`" aria-haspopup="dialog" :aria-expanded="open" :aria-controls="`${id}-calendar`" @click="toggle">
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.25" y="4.75" width="17.5" height="16" rx="2.5" /><path d="M3.25 9.75h17.5M8 2.75v3.5M16 2.75v3.5" /></svg>
      </button>
    </div>
    <div v-if="error" :id="`${id}-error`" class="date-error" role="status">{{ error }}</div>
    <div ref="popup" popover="manual" class="date-popup search-popover" :class="{ 'is-open': open }" :inert="!open" :aria-hidden="!open">
      <div class="date-clip">
        <section :id="`${id}-calendar`" class="calendar-surface dropdown-surface" role="dialog" :aria-label="`${label}日历`">
          <header class="calendar-header">
            <button type="button" aria-label="上个月" :disabled="clamp(shiftCalendarMonth(cursor, -1)) === cursor" @click="changeMonth(-1)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 7-5 5 5 5" /></svg></button>
            <span :id="`${id}-month`" aria-live="polite">{{ monthLabel }}</span>
            <button type="button" aria-label="下个月" :disabled="clamp(shiftCalendarMonth(cursor, 1)) === cursor" @click="changeMonth(1)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m10 7 5 5-5 5" /></svg></button>
          </header>
          <table class="calendar-grid" role="grid" :aria-labelledby="`${id}-month`">
            <thead><tr><th v-for="day in ['一','二','三','四','五','六','日']" :key="day" scope="col">{{ day }}</th></tr></thead>
            <tbody><tr v-for="(week, index) in weeks" :key="index">
              <td v-for="(day, column) in week" :key="day || column" :aria-selected="day === modelValue">
                <button v-if="day" type="button" :data-day="day" :aria-label="day" :aria-current="day === today ? 'date' : undefined" :tabindex="day === cursor ? 0 : -1" :disabled="!allowed(day)" :class="{ selected: day === modelValue, outside: day.slice(0,7) !== cursor.slice(0,7) }" @click="select(day)" @keydown="dayKey">{{ Number(day.slice(-2)) }}</button>
              </td>
            </tr></tbody>
          </table>
          <footer class="calendar-footer"><button type="button" :disabled="!allowed(today)" @click="select(today)">今天</button><button type="button" @click="select('')">清除</button><button type="button" @click="close(true)">关闭</button></footer>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.date-picker { position: relative; min-width: 0; align-self: start; }
.date-picker.is-open { z-index: 20; }
.date-label { display: block; margin-bottom: 8px; color: var(--muted); font: 12px var(--sans); }
.date-field { display: flex; height: 39px; border: 1px solid var(--line); border-radius: 10px; }
.date-field input { width: 100%; min-width: 0; padding: 9px 0 9px 10px; border: 0; background: transparent; color: var(--ink); font: 14px var(--sans); }
.date-field button { flex: none; width: 38px; border: 0; background: transparent; color: var(--ink); cursor: pointer; }
.date-picker svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; vertical-align: middle; }
.date-picker :is(input,button):focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.date-field:focus-within { outline: 2px solid var(--accent); outline-offset: 2px; }
/* Override both component and higher-specificity modern global focus rules.
   The shared field already provides the visible keyboard focus indicator. */
:root .date-picker .date-field :is(input,button):focus,
:root .date-picker .date-field :is(input,button):focus-visible { outline: none !important; box-shadow: none; }
.date-popup { position: absolute; z-index: 20; top: calc(100% + 6px); left: 0; width: max(100%, 270px); max-width: calc(100vw - 56px); display: grid; grid-template-rows: 0fr; visibility: hidden; transition: grid-template-rows 180ms var(--ease-exit), visibility 0s 180ms; }
/* 日历走原生 popover 进 top layer，位置与宽度一律由 useSearchPopover 写进去的
   --popup-left/top/width/bottom 决定。组件样式与那条规则同级（0,3,0），谁在这里
   写 left/right 谁就把它顶掉——曾经就是这么把「结束日期」的日历钉在窗口右缘的。
   这里不许再出现任何位置声明。 */
.date-popup.is-open { grid-template-rows: 1fr; visibility: visible; transition: grid-template-rows 360ms var(--ease-settle), visibility 0s; }
.date-clip { min-height: 0; overflow: hidden; border-radius: 10px; }
.calendar-surface { padding: 10px; border: 1px solid var(--line); border-radius: 10px; background: var(--paper); color: var(--ink); }
.calendar-header { display: flex; align-items: center; justify-content: space-between; font: 14px var(--sans); }
.calendar-surface button { border: 0; border-radius: 10px; background: transparent; color: var(--ink); font: 13px var(--sans); cursor: pointer; min-height: 34px; }
.calendar-header button { width: 34px; }
.calendar-grid { width: 100%; table-layout: fixed; border-collapse: separate; border-spacing: 2px; margin: 8px 0; }
.calendar-grid th { color: var(--muted); font: 12px var(--sans); height: 28px; }
.calendar-grid td { padding: 0; text-align: center; }
.calendar-grid button { width: 100%; }
.calendar-surface button:hover:not(:disabled) { color: var(--accent); }
.calendar-grid button.selected { color: var(--accent); font-weight: 700; }
.calendar-grid button[aria-current='date'] { text-decoration: underline; text-underline-offset: 4px; }
.calendar-grid button.outside { color: var(--muted); }
.calendar-surface button:disabled { opacity: .35; cursor: default; }
.calendar-footer { display: flex; gap: 10px; border-top: 1px solid var(--line); padding-top: 6px; }
.calendar-footer button:last-child { margin-left: auto; }
.date-error { margin-top: 6px; color: var(--muted); font: 12px/1.6 var(--sans); }
@media (prefers-reduced-motion: reduce) { .date-popup { transition-duration: .01ms; transition-delay: 0s; } }
</style>
