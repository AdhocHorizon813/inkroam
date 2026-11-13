<script setup lang="ts">
import { defaultRadialShortcut, isRadialCode, useRadialShortcut } from '~/composables/useRadialShortcut'
import { vExperimentalGlass } from '~/utils/glass-surfaces'
import SearchFilterSelect from './SearchFilterSelect.vue'
import AppearanceMenuRow from './AppearanceMenuRow.vue'
import { RADIAL_ACTIONS, defaultRadialSlots, normalizeRadialSlots } from '~/utils/radial-actions'
const props = withDefaults(defineProps<{ active?: boolean }>(), { active: true })
const { shortcut, recording } = useRadialShortcut()
const editingSlots = ref(false)
const directions = ['上方', '右上', '右下', '下方', '左下', '左上']
const slotOptions = RADIAL_ACTIONS.map(action => ({ value: action.id, label: action.label }))
const slots = computed(() => normalizeRadialSlots(shortcut.value.slots))
function setSlot(index: number, value: string) {
  if (!RADIAL_ACTIONS.some(action => action.id === value)) return
  const next = [...slots.value]
  const previous = next[index]!
  const other = value === 'none' ? -1 : next.indexOf(value)
  if (other >= 0 && other !== index) next[other] = previous
  next[index] = value
  shortcut.value = { ...shortcut.value, slots: next }
}
function resetKeys() {
  const defaults = defaultRadialShortcut()
  shortcut.value = { ...shortcut.value, codes: defaults.codes, label: defaults.label }
  cancel()
}
defineEmits<{ preview: [] }>()
const message = ref('')
let captured: string[] = []
let labels: string[] = []
const modifiers = /^(Control|Alt|Shift|Meta)(Left|Right)$/
function start() { captured = []; labels = []; message.value = '按下一个按键或组合键，松开保存；Esc 取消。'; recording.value = true }
function down(event: KeyboardEvent) {
  if (!recording.value) return
  event.preventDefault(); event.stopImmediatePropagation()
  if (event.key === 'Escape') { recording.value = false; message.value = ''; return }
  if (event.repeat || event.isComposing) return
  if (!captured.includes(event.code)) {
    captured.push(event.code)
    labels.push(event.key === ' ' ? 'Space' : event.key.length === 1 ? event.key.toUpperCase() : event.key)
  }
  message.value = labels.join(' + ')
}
function up(event: KeyboardEvent) {
  if (!recording.value || !captured.length) return
  event.preventDefault(); event.stopImmediatePropagation()
  const onlyModifiers = captured.every(code => modifiers.test(code))
  const reservedTab = captured.includes('Tab') && captured.some(code => modifiers.test(code))
  const reserved = captured.some(code => code.startsWith('Meta')) || captured.includes('Escape') || captured.some(code => /^F\d+$/.test(code)) || (captured.some(code => /^(Control|Alt)/.test(code)) && captured.length > 1 && !captured.includes('Tab'))
  if (onlyModifiers || reservedTab || reserved || captured.length > 3 || !captured.every(isRadialCode)) message.value = '请选择普通按键或 Tab 加字母，避免浏览器及系统快捷键。'
  else { shortcut.value = { ...shortcut.value, codes: [...captured], label: labels.join(' + ') }; message.value = '快捷键已保存。' }
  recording.value = false
}
function cancel() { recording.value = false }
onMounted(() => { window.addEventListener('keydown', down, true); window.addEventListener('keyup', up, true); window.addEventListener('blur', cancel) })
onBeforeUnmount(() => { cancel(); window.removeEventListener('keydown', down, true); window.removeEventListener('keyup', up, true); window.removeEventListener('blur', cancel) })
</script>
<template>
  <fieldset class="setting-group">
    <legend class="setting-label">快捷轮盘</legend>
    <div class="segmented-control segmented-control--two" :style="{ '--segment-transform': shortcut.enabled ? 'translate3d(calc(100% + 5px),0,0)' : 'translate3d(0,0,0)' }">
      <span v-experimental-glass="true" data-glass-module="indicator" class="glass-segment-indicator" aria-hidden="true" />
      <button type="button" :class="{ active: !shortcut.enabled }" :aria-pressed="!shortcut.enabled" @click="shortcut.enabled = false">关闭</button>
      <button type="button" :class="{ active: shortcut.enabled }" :aria-pressed="shortcut.enabled" @click="shortcut.enabled = true">开启</button>
    </div>
  </fieldset>
  <div class="setting-group">
    <div class="shortcut-key-row"><span class="setting-label">轮盘快捷键</span>
      <button class="shortcut-key" type="button" :aria-pressed="recording" aria-label="更改轮盘快捷键" @click="recording ? cancel() : start()"><span>{{ recording ? '等待按键…' : shortcut.label }}</span><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m10 3 3 3-7 7-4 1 1-4Zm-1 1 3 3" /></svg></button>
    </div>
    <p class="setting-hint">按住唤出，移向功能后松键执行；中心或 Esc 取消。</p>
    <p v-if="message" class="setting-hint" role="status">{{ message }}</p>
  </div>
  <AppearanceMenuRow :expanded="editingSlots" :aria-expanded="editingSlots" aria-controls="radial-slots" @click="editingSlots = !editingSlots">轮盘内容</AppearanceMenuRow>
  <div id="radial-slots" class="shortcut-slot-region" :class="{ 'is-expanded': editingSlots }" :inert="!editingSlots || !props.active" :aria-hidden="!editingSlots">
    <div class="shortcut-slot-clip"><div class="shortcut-slots">
      <SearchFilterSelect v-for="(direction, index) in directions" :key="direction" :label="direction" :model-value="slots[index]!" :options="slotOptions" :enabled="editingSlots && props.active" @update:model-value="setSlot(index, $event)" />
      <button class="shortcut-reset-layout" type="button" @click="shortcut.slots = defaultRadialSlots()">恢复默认布局</button>
    </div></div>
  </div>
  <div class="shortcut-actions"><button type="button" @click="resetKeys">恢复默认键位</button><button type="button" @click="cancel(); $emit('preview')">打开轮盘<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 12 12 4M5 4h7v7" /></svg></button></div>
</template>
<style scoped>
.shortcut-key-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.shortcut-key-row .setting-label { margin: 0; }
.shortcut-key { display: inline-flex; align-items: center; gap: 10px; padding: 9px 12px; border: 0; border-radius: 10px; background: color-mix(in srgb, var(--ink) 5%, transparent); color: var(--ink); font: 12px var(--sans); cursor: pointer; transition: background 220ms ease; }
.shortcut-key svg, .shortcut-actions svg { width: 13px; height: 13px; fill: none; stroke: currentColor; stroke-width: 1.3; }
.shortcut-actions { display: flex; justify-content: space-between; gap: 16px; padding-block: 16px 4px; }
.shortcut-actions button, .shortcut-reset-layout { appearance: none; display: inline-flex; align-items: center; gap: 8px; min-height: 36px; padding: 6px 0; border: 0; border-radius: 6px; background: none; color: var(--muted); font: 12px var(--sans); cursor: pointer; transition: color 200ms ease; }
.shortcut-actions button:hover, .shortcut-reset-layout:hover { color: var(--ink); }
.shortcut-key:focus-visible, .shortcut-actions button:focus-visible, .shortcut-reset-layout:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
.shortcut-slot-region { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 320ms cubic-bezier(.16,1,.3,1); }
.shortcut-slot-region.is-expanded { grid-template-rows: 1fr; }
.shortcut-slot-clip { min-height: 0; overflow: hidden; }
.shortcut-slots { display: grid; grid-template-columns: 1fr 1fr; gap: 16px 12px; padding: 12px 0 20px; }
.shortcut-reset-layout { grid-column: 1 / -1; justify-self: start; }
@media (prefers-reduced-motion: reduce) { .shortcut-slot-region, .shortcut-key, .shortcut-actions button { transition: none; } }
</style>
