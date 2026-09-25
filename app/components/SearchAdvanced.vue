<script setup lang="ts">
import { courses } from '~/utils/courses'
import { emptySearchFilters, type SearchFilters } from '~/utils/search-filters'
const props = defineProps<{ modelValue: SearchFilters; tags: string[] }>()
const emit = defineEmits<{ 'update:modelValue': [value: SearchFilters] }>()
const expanded = ref(Object.values(props.modelValue).some(Boolean))
const settled = ref(expanded.value)
let settleTimer: ReturnType<typeof setTimeout> | undefined
watch(expanded, () => {
  settled.value = false
  clearTimeout(settleTimer)
  // A cancelled transition (or disabled animation) must not leave menus clipped.
  if (expanded.value) settleTimer = setTimeout(() => { settled.value = expanded.value }, 480)
})
onBeforeUnmount(() => clearTimeout(settleTimer))
function finishExpansion(event: TransitionEvent) {
  if (event.target === event.currentTarget && event.propertyName === 'grid-template-rows') settled.value = expanded.value
}
const panelId = useId()
const activeCount = computed(() => Object.values(props.modelValue).filter(Boolean).length)
const typeOptions = [{ value: '', label: '全部内容' }, { value: 'posts', label: '文章' }, { value: 'notes', label: '笔记' }]
const courseOptions = [{ value: '', label: '全部课程' }, ...courses.map(course => ({ value: course.slug, label: course.name }))]
const tagOptions = computed(() => [{ value: '', label: '全部标签' }, ...props.tags.map(tag => ({ value: tag, label: tag }))])
const sortOptions = [{ value: '', label: '相关度优先' }, { value: 'newest', label: '最新优先' }, { value: 'oldest', label: '最早优先' }]
function update(key: keyof SearchFilters, input: Event | string) {
  const value = typeof input === 'string' ? input : (input.target as HTMLInputElement).value
  const next = { ...props.modelValue, [key]: value }
  // 课程只属于笔记（content/notes/<课程>/）：切走笔记就把课程清掉，课程框同时禁用。
  // 不再用「选了课程就偷偷把内容类型改成笔记」这种隐式联动来维持一致。
  if (key === 'type' && value !== 'notes') next.course = ''
  emit('update:modelValue', next)
}
</script>

<template>
  <div class="advanced-search">
    <button type="button" class="advanced-toggle" :aria-expanded="expanded" :aria-controls="panelId" @click="expanded = !expanded">
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m10 7 5 5-5 5" /></svg>
      高级搜索<span v-if="activeCount"> · {{ activeCount }} 项</span>
    </button>
    <div :id="panelId" class="advanced-panel" :class="{ expanded, settled }" :inert="!expanded" :aria-hidden="!expanded" @transitionend="finishExpansion">
      <div class="advanced-clip">
        <div class="advanced-fields">
          <SearchFilterSelect label="内容类型" :model-value="modelValue.type" :options="typeOptions" :enabled="expanded" @update:model-value="update('type', $event)" />
          <SearchFilterSelect label="课程" :model-value="modelValue.course" :options="courseOptions" :enabled="expanded" :disabled="modelValue.type !== 'notes'" @update:model-value="update('course', $event)" />
          <SearchFilterSelect label="标签" :model-value="modelValue.tag" :options="tagOptions" :enabled="expanded" @update:model-value="update('tag', $event)" />
          <SearchFilterSelect label="排序" :model-value="modelValue.sort" :options="sortOptions" :enabled="expanded" @update:model-value="update('sort', $event)" />
          <SearchDatePicker label="开始日期" :model-value="modelValue.from" :max="modelValue.to || undefined" :enabled="expanded" @update:model-value="update('from', $event)" />
          <SearchDatePicker label="结束日期" :model-value="modelValue.to" :min="modelValue.from || undefined" :enabled="expanded" align-end @update:model-value="update('to', $event)" />
        </div>
        <p v-if="modelValue.from && modelValue.to && modelValue.from > modelValue.to" role="status" class="advanced-note">开始日期不能晚于结束日期。</p>
        <button class="advanced-toggle advanced-clear" :class="{ 'is-empty': !activeCount }" :disabled="!activeCount" :aria-hidden="!activeCount" type="button" @click="emit('update:modelValue', emptySearchFilters())">清除筛选</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.advanced-toggle { display: inline-flex; align-items: center; gap: 6px; padding: 10px 0; border: 0; background: none; color: var(--muted); font: 13px var(--sans); cursor: pointer; }
.advanced-toggle:hover { color: var(--ink); }
.advanced-clear.is-empty { visibility: hidden; }
/* 展开标记用画出来的 chevron，而不是 › / ⌄ 这类文字符号：文字符号的笔画粗细、
   上下位置都跟着字体与系统回退走，同一个字符在两台机器上不是一个形状。 */
.advanced-toggle svg { flex: none; width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; transition: transform 260ms var(--ease-settle); }
.advanced-toggle[aria-expanded='true'] svg { transform: rotate(90deg); }
.advanced-panel { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 260ms var(--ease-exit); }
.advanced-panel.expanded { grid-template-rows: 1fr; transition-duration: 440ms; transition-timing-function: var(--ease-settle); }
.advanced-clip { min-height: 0; overflow: hidden; }
.advanced-panel.expanded.settled > .advanced-clip { overflow: visible; }
.advanced-fields { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px 24px; padding: 12px 0 20px; }
.advanced-search :is(button, input, select):focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.advanced-note { color: var(--muted); font-size: 13px; }
@media (max-width: 767.98px) { .advanced-fields { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px 12px; } }
@media (max-width: 380px) { .advanced-fields { grid-template-columns: minmax(0, 1fr); } }
@media (prefers-reduced-motion: reduce) { .advanced-panel, .advanced-toggle svg { transition-duration: .01ms; } }
</style>
