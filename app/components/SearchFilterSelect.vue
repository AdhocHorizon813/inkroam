<script setup lang="ts">
const props = defineProps<{ label: string; modelValue: string; options: { value: string; label: string }[]; enabled: boolean; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const input = ref<HTMLInputElement | null>(null)
const open = ref(false)
const popup = ref<HTMLElement | null>(null)
useSearchPopover(root, popup, open)
const query = ref('')
const active = ref(0)
const id = useId()
const selected = computed(() => props.options.find(option => option.value === props.modelValue)?.label || props.modelValue || props.options[0]?.label)
const filtered = computed(() => {
  const terms = query.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  return props.options.filter(option => terms.every(term => option.label.toLocaleLowerCase().includes(term)))
})
watch(query, () => { active.value = 0 })
watch(() => props.enabled, value => { if (!value) close() })
/* 这一项在当前条件下没有意义时（例如「课程」在内容类型不是笔记时）直接禁用，
   不再用「选了它再偷偷改别的条件」来维持一致。 */
watch(() => props.disabled, value => { if (value) close() })

async function toggle() {
  if (props.disabled || !props.enabled) return
  if (open.value) { close(); return }
  query.value = ''
  open.value = true
  await nextTick()
  active.value = Math.max(0, filtered.value.findIndex(option => option.value === props.modelValue))
  input.value?.focus({ preventScroll: true })
  revealActive()
}
function close(restore = false) {
  open.value = false
  if (restore) trigger.value?.focus({ preventScroll: true })
}
function choose(value: string) {
  emit('update:modelValue', value)
  close(true)
}
async function revealActive() {
  await nextTick()
  const option = root.value?.querySelector<HTMLElement>(`[data-option-index="${active.value}"]`)
  const list = option?.parentElement
  if (!option || !list) return
  const top = option.offsetTop - list.offsetTop
  if (top < list.scrollTop) list.scrollTop = top
  else if (top + option.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = top + option.offsetHeight - list.clientHeight
}
function keydown(event: KeyboardEvent) {
  if (event.isComposing) return
  if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true) }
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    active.value = Math.max(0, Math.min(filtered.value.length - 1, active.value + (event.key === 'ArrowDown' ? 1 : -1)))
    revealActive()
  }
  if (event.key === 'Enter') {
    event.preventDefault()
    const option = filtered.value[active.value]
    if (option) choose(option.value)
  }
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
  <div ref="root" class="filter-select" :class="{ 'is-open': open, 'is-disabled': disabled }" @focusout="focusout">
    <span :id="`${id}-label`" class="filter-label">{{ label }}</span>
    <button ref="trigger" type="button" class="filter-trigger" :disabled="disabled" :title="disabled ? '把内容类型选为「笔记」后才能按课程筛选' : undefined" :aria-labelledby="`${id}-label ${id}-value`" aria-haspopup="listbox" :aria-expanded="open" :aria-controls="`${id}-list`" @click="toggle" @keydown.down.prevent="toggle">
      <span :id="`${id}-value`">{{ selected }}</span>
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m7 10 5 5 5-5" /></svg>
    </button>
    <div ref="popup" popover="manual" class="filter-popup search-popover" :class="{ 'is-open': open }" :inert="!open" :aria-hidden="!open">
      <div class="filter-clip">
        <div class="filter-surface dropdown-surface">
          <input ref="input" v-model="query" type="search" role="combobox" :aria-label="`搜索${label}选项`" :aria-controls="`${id}-list`" :aria-expanded="open" aria-autocomplete="list" :aria-activedescendant="filtered.length ? `${id}-option-${active}` : undefined" :placeholder="`搜索${label}…`" autocomplete="off" @keydown="keydown">
          <ul :id="`${id}-list`" class="filter-options" role="listbox" :aria-labelledby="`${id}-label`">
            <li v-for="(option, index) in filtered" :id="`${id}-option-${index}`" :key="option.value" role="option" :aria-selected="option.value === modelValue" :data-option-index="index" :class="{ 'is-active': index === active, 'is-selected': option.value === modelValue }" @pointermove="active = index" @pointerdown.prevent @click="choose(option.value)">
              <span class="filter-option-label">{{ option.label }}</span><svg v-if="option.value === modelValue" class="filter-option-check" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m5 12 4 4L19 6" /></svg>
            </li>
          </ul>
          <div v-if="!filtered.length" class="filter-empty" role="status">没有匹配的选项</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.filter-select { position: relative; min-width: 0; align-self: start; }
/* 禁用态与外观面板的禁用收敛成同一档淡化（.42），并整块失去交互。 */
.filter-select.is-disabled { opacity: .42; }
/* 浮层自己的层级必须留在浮层上：收起时 .is-open 已经拿掉，如果层级只挂在
   .filter-select.is-open 上，收缩中的浮层会被后面那行字段盖住。 */
.filter-select.is-open { z-index: 20; }
.filter-label { display: block; margin-bottom: 8px; color: var(--muted); font: 12px var(--sans); }
.filter-trigger { display: flex; align-items: center; justify-content: space-between; gap: 10px; width: 100%; height: 39px; padding: 9px 10px; border: 1px solid var(--line); border-radius: 10px; background: transparent; color: var(--ink); text-align: left; font: 14px var(--sans); cursor: pointer; }
.filter-trigger > span:first-child { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
/* 触发框右侧的三角自己画：⌄ 是文字符号，笔画粗细与上下位置跟着字体回退走，
   在有的系统上细得几乎看不见，也不随控件尺寸缩放。 */
.filter-trigger svg { flex: none; width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; transition: transform 260ms var(--ease-settle); }
.filter-trigger[aria-expanded='true'] svg { transform: rotate(180deg); }
.filter-select :is(button,input):focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.filter-popup { position: absolute; z-index: 20; inset: calc(100% + 6px) 0 auto; display: grid; grid-template-rows: 0fr; visibility: hidden; transition: grid-template-rows 180ms var(--ease-exit), visibility 0s 180ms; }
.filter-popup.is-open { grid-template-rows: 1fr; visibility: visible; transition: grid-template-rows 360ms var(--ease-settle), visibility 0s; }
.filter-clip { min-height: 0; overflow: hidden; border-radius: 10px; }
.filter-surface { padding: 8px; border: 1px solid var(--line); border-radius: 10px; background: var(--paper); }
.filter-surface input { display: block; width: 100%; min-width: 0; box-sizing: border-box; padding: 9px 8px; border: 1px solid var(--line); border-radius: 10px; background: transparent; color: var(--ink); font: 16px var(--sans); }
.filter-options { list-style: none; margin: 6px 0 0; padding: 0; max-height: min(240px, 35vh); overflow-y: auto; overscroll-behavior: contain; }
.filter-options li { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin: 0; padding: 10px 8px; min-height: 40px; border-radius: 10px; color: var(--ink); font: 14px/1.5 var(--sans); cursor: pointer; overflow-wrap: anywhere; }
.filter-options li.is-active { color: var(--accent); }
.filter-options li.is-active .filter-option-label { text-decoration: underline; text-underline-offset: 4px; }
.filter-option-check { flex: none; width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.filter-options li.is-selected { font-weight: 600; }
.filter-empty { padding: 14px 8px; color: var(--muted); font: 13px var(--sans); }
@media (prefers-reduced-motion: reduce) { .filter-popup, .filter-trigger svg { transition-duration: .01ms; transition-delay: 0s; } }
</style>
