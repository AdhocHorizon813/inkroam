<script setup lang="ts">
import AppearanceMenuRow from './AppearanceMenuRow.vue'
import GlassRange from './GlassRange.vue'
import { vExperimentalGlass } from '~/utils/glass-surfaces'
import { GLASS_GROUPS, type GlassGroup, type GlassPreferences, type GlassPreference, type GlassGlobalOverride } from '~/utils/glass-settings'
import { createDefaultGlassGlobal, createDefaultGlassPreferences } from '~/utils/glass-defaults'

const props = defineProps<{
  modelValue: GlassPreferences
  global: GlassGlobalOverride
  enabled: boolean
  visual: string
  materials: Record<string, string>
}>()
const emit = defineEmits<{ 'update:modelValue': [value: GlassPreferences]; 'update:global': [value: GlassGlobalOverride]; 'update:enabled': [value: boolean] }>()
type Entry = GlassGroup | 'global'
const groups = [{ id: 'global' as const, label: '全局参数', material: '', owner: '覆盖单项设置' }, ...GLASS_GROUPS]
const preference = (id: Entry) => id === 'global' ? props.global.settings : props.modelValue[id]
const expanded = ref<Entry | null>(null)
const defaultsDialog = ref<HTMLDialogElement | null>(null)
const defaultsOpen = ref(false)
const defaultsGlobal = ref(false)
const choices = [
  { key: 'resolution', label: '折射贴图精度', hint: '较低的精度可减少开销，折射边缘可能更粗糙。', options: [{ value: 0, label: '自动' }, { value: .5, label: '0.5×' }, { value: .75, label: '0.75×' }, { value: 1, label: '1×' }, { value: 1.5, label: '1.5×' }, { value: 2, label: '2×' }] },
  { key: 'pixelBudget', label: '单层贴图预算', hint: '限制最终贴图精度，不代表背景分辨率。', options: [{ value: .5, label: '50 万' }, { value: 1.5, label: '150 万' }, { value: 3, label: '300 万' }] },
  { key: 'maxSide', label: '贴图边长上限', hint: '限制贴图最长边，较低的值可减少生成开销。', options: [{ value: 1024, label: '1024' }, { value: 2048, label: '2048' }, { value: 4096, label: '4096' }] },
  { key: 'maxFps', label: '滤镜更新频率', hint: '仅限制滤镜更新，不限制页面操作。', options: [{ value: 0, label: '不限' }, { value: 15, label: '15 Hz' }, { value: 30, label: '30 Hz' }, { value: 60, label: '60 Hz' }] },
  { key: 'settleDelay', label: '尺寸稳定后更新贴图', hint: '延后生成可减少重复计算，期间会暂时拉伸上一张贴图。', options: [{ value: 0, label: '实时' }, { value: 80, label: '80 ms' }, { value: 160, label: '160 ms' }] },
] as const
const available = (id: Entry) => {
  if (id !== 'global' && props.global.enabled) return false
  if (id === 'global' && !props.global.enabled) return false
  const group = groups.find(g => g.id === id)!
  return props.enabled && props.visual === 'modern' && (group.material
    ? props.materials[group.material] === 'liquid'
    : ['navMaterial', 'musicMaterial', ...(id === 'dock' ? [] : ['dropdownMaterial', 'material'])].some(k => props.materials[k] === 'liquid'))
}
function update<K extends keyof GlassPreference>(id: Entry, key: K, value: GlassPreference[K]) {
  if (id === 'global') emit('update:global', { ...props.global, settings: { ...props.global.settings, [key]: value } })
  else emit('update:modelValue', { ...props.modelValue, [id]: { ...props.modelValue[id], [key]: value } })
}
function toggleGlobal(enabled: boolean) {
  emit('update:global', { ...props.global, enabled })
  if (enabled) expanded.value = 'global'
}
function requestDefaults() {
  defaultsGlobal.value = props.global.enabled
  defaultsOpen.value = true
  defaultsDialog.value?.showModal()
}
function closeDefaults() {
  defaultsOpen.value = false
  defaultsDialog.value?.close()
}
function confirmDefaults() {
  if (!defaultsOpen.value) return
  closeDefaults()
  if (defaultsGlobal.value) emit('update:global', { ...props.global, settings: createDefaultGlassGlobal().settings })
  else emit('update:modelValue', createDefaultGlassPreferences())
}
onBeforeUnmount(() => defaultsDialog.value?.close())
const segments = (index: number, count: number) => ({ '--segment-transform': `translateX(calc(${index} * (100% + 5px)))`, '--segment-width': `calc((100% - ${8 + (count - 1) * 5}px) / ${count})`, gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` })
</script>

<template>
  <div class="glass-settings">
        <fieldset class="setting-group" :disabled="visual === 'classic'">
          <legend class="setting-label">实验性液态玻璃</legend>
          <div class="segmented-control segmented-control--two" :style="segments(enabled ? 1 : 0, 2)">
            <span v-experimental-glass="true" data-glass-module="indicator" class="glass-segment-indicator" aria-hidden="true" />
            <button type="button" :aria-pressed="!enabled" :class="{ active: !enabled }" @click="emit('update:enabled', false)">关闭</button>
            <button type="button" :aria-pressed="enabled" :class="{ active: enabled }" @click="emit('update:enabled', true)">开启</button>
          </div>
        </fieldset>
        <fieldset class="setting-group">
          <legend class="setting-label">全局覆盖</legend>
          <div class="segmented-control segmented-control--two" :style="segments(global.enabled ? 1 : 0, 2)">
            <span v-experimental-glass="true" data-glass-module="indicator" class="glass-segment-indicator" aria-hidden="true" />
            <button type="button" :class="{ active: !global.enabled }" :aria-pressed="!global.enabled" @click="toggleGlobal(false)">关闭</button>
            <button type="button" :class="{ active: global.enabled }" :aria-pressed="global.enabled" @click="toggleGlobal(true)">开启</button>
          </div>
        </fieldset>
        <AppearanceMenuRow :arrow="false" @click="requestDefaults">采用默认设置</AppearanceMenuRow>
        <div v-for="group in groups" :key="group.id" class="glass-settings__component">
          <AppearanceMenuRow :expanded="expanded === group.id" :aria-expanded="expanded === group.id" :aria-controls="`glass-settings-${group.id}`" @click="expanded = expanded === group.id ? null : group.id">{{ group.label }}</AppearanceMenuRow>
          <div :id="`glass-settings-${group.id}`" class="glass-settings__reveal" :class="{ expanded: expanded === group.id }" :inert="expanded !== group.id" :aria-hidden="expanded !== group.id" :data-glass-page-hidden="expanded !== group.id ? 'true' : undefined">
            <div class="glass-settings__clip"><div class="glass-settings__body">
              <p v-if="group.id === 'global'" class="setting-hint">覆盖单项设置</p>
              <fieldset class="setting-group" :disabled="!available(group.id)">
                <legend class="setting-label">液态玻璃</legend>
                <div class="segmented-control segmented-control--two" :style="segments(preference(group.id).enabled ? 1 : 0, 2)">
                  <span v-experimental-glass="expanded === group.id" data-glass-module="indicator" class="glass-segment-indicator" aria-hidden="true" />
                  <button v-for="(label, index) in ['关闭', '开启']" :key="label" type="button" :class="{ active: preference(group.id).enabled === !!index }" :aria-pressed="preference(group.id).enabled === !!index" @click="update(group.id, 'enabled', !!index)">{{ label }}</button>
                </div>
              </fieldset>
              <fieldset class="glass-settings__parameters" :disabled="!available(group.id) || !preference(group.id).enabled">
                <div class="setting-group">
                  <div class="range-heading"><label class="setting-label" :for="`clarity-${group.id}`">通透度</label><output :for="`clarity-${group.id}`">{{ preference(group.id).clarity }}%</output></div>
                  <GlassRange :active="expanded === group.id">
                    <input :id="`clarity-${group.id}`" :aria-describedby="`clarity-hint-${group.id}`" type="range" min="0" max="100" step="1" :value="preference(group.id).clarity" :style="{ '--range-progress': `${preference(group.id).clarity}%` }" @input="update(group.id, 'clarity', Number(($event.target as HTMLInputElement).value))">
                  </GlassRange>
                  <p :id="`clarity-hint-${group.id}`" class="setting-hint glass-settings__option-hint">较低的通透度会增加磨砂效果。</p>
                </div>
                <fieldset class="setting-group">
                  <legend class="setting-label">玻璃抗锯齿</legend>
                  <div class="segmented-control segmented-control--two" :style="segments(preference(group.id).antialias ? 1 : 0, 2)">
                    <span v-experimental-glass="expanded === group.id" data-glass-module="indicator" class="glass-segment-indicator" aria-hidden="true" />
                    <button v-for="(label, index) in ['关闭', '开启']" :key="label" type="button" :class="{ active: preference(group.id).antialias === !!index }" :aria-pressed="preference(group.id).antialias === !!index" @click="update(group.id, 'antialias', !!index)">{{ label }}</button>
                  </div>
                </fieldset>
                <fieldset class="setting-group" :disabled="!preference(group.id).antialias" :aria-describedby="`aa-hint-${group.id}`">
                  <legend class="setting-label">抗锯齿采样倍数</legend>
                  <div class="segmented-control" :style="segments([1, 1.5, 2].indexOf(preference(group.id).aaScale), 3)">
                    <span v-experimental-glass="expanded === group.id" data-glass-module="indicator" class="glass-segment-indicator" aria-hidden="true" />
                    <button v-for="scale in [1, 1.5, 2]" :key="scale" type="button" :class="{ active: preference(group.id).aaScale === scale }" :aria-pressed="preference(group.id).aaScale === scale" @click="update(group.id, 'aaScale', scale)">{{ scale }}×</button>
                  </div>
                  <p :id="`aa-hint-${group.id}`" class="setting-hint glass-settings__option-hint">倍数作用于每条边，2× 最多生成四倍像素。</p>
                </fieldset>
                <fieldset v-for="choice in choices" :key="choice.key" class="setting-group" :aria-describedby="`${choice.key}-hint-${group.id}`">
                  <legend class="setting-label">{{ choice.label }}</legend>
                  <div class="segmented-control glass-settings__choices" :style="segments(choice.options.findIndex(option => option.value === preference(group.id)[choice.key]), choice.options.length)">
                    <span v-experimental-glass="expanded === group.id" data-glass-module="indicator" class="glass-segment-indicator" aria-hidden="true" />
                    <button v-for="option in choice.options" :key="option.value" type="button" :class="{ active: preference(group.id)[choice.key] === option.value }" :aria-pressed="preference(group.id)[choice.key] === option.value" @click="update(group.id, choice.key, option.value)">{{ option.label }}</button>
                  </div>
                  <p :id="`${choice.key}-hint-${group.id}`" class="setting-hint glass-settings__option-hint">{{ choice.hint }}</p>
                </fieldset>
                <fieldset v-if="['global', 'indicator', 'thumb'].includes(group.id)" class="setting-group" :aria-describedby="`deform-hint-${group.id}`">
                  <legend class="setting-label">控件弹性形变</legend>
                  <div class="segmented-control segmented-control--two" :style="segments(preference(group.id).deform ? 1 : 0, 2)">
                    <span v-experimental-glass="expanded === group.id" data-glass-module="indicator" class="glass-segment-indicator" aria-hidden="true" />
                    <button v-for="(label, index) in ['关闭', '开启']" :key="label" type="button" :class="{ active: preference(group.id).deform === !!index }" :aria-pressed="preference(group.id).deform === !!index" @click="update(group.id, 'deform', !!index)">{{ label }}</button>
                  </div>
                  <p :id="`deform-hint-${group.id}`" class="setting-hint glass-settings__option-hint">关闭弹性形变仍保留滑动与选择。</p>
                </fieldset>
              </fieldset>
            </div></div>
          </div>
        </div>
  </div>
  <dialog ref="defaultsDialog" v-experimental-glass="defaultsOpen" data-glass-module="confirm" class="appearance-confirm"
    aria-labelledby="glass-defaults-title" aria-describedby="glass-defaults-description glass-defaults-scope" @close="defaultsOpen = false">
    <div class="appearance-confirm__symbol" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none"><path d="M5 4v16M12 4v16M19 4v16" /><path d="M3 8h4M10 16h4M17 10h4" class="appearance-confirm__knobs" /></svg>
    </div>
    <h2 id="glass-defaults-title">采用默认设置？</h2>
    <p id="glass-defaults-description" class="appearance-confirm__description">将恢复默认的液态玻璃参数。</p>
    <p id="glass-defaults-scope" class="appearance-confirm__hint">{{ defaultsGlobal ? '将替换全局参数，保留单项设置。' : '将分别调整各组件的参数与开关，保留全局设置。' }}</p>
    <div class="appearance-confirm__actions">
      <button type="button" class="appearance-confirm__cancel" autofocus @click="closeDefaults">取消</button>
      <button type="button" class="appearance-confirm__accept" @click="confirmDefaults">采用默认设置</button>
    </div>
  </dialog>
</template>

<style scoped>
.glass-settings__reveal { display: grid; grid-template-rows: 0fr; opacity: 0; transition: grid-template-rows 380ms cubic-bezier(.16, 1, .3, 1), opacity 220ms ease; }
.glass-settings__reveal.expanded { grid-template-rows: 1fr; opacity: 1; }
.glass-settings__clip { min-height: 0; overflow: hidden; }
.glass-settings__body { padding: 4px 2px 14px; }
.glass-settings__parameters { margin: 0; padding: 0; border: 0; min-width: 0; }
/* The native range thumb is 16px, but the experimental glass thumb can grow
   to 52px while pressed/moving. On the accordion's clipped edges, reserve
   enough horizontal runway for the whole lens and its shadow at 0% and 100%.
   Input hit targets, native centre alignment and reveal clipping stay intact. */
.glass-settings__parameters :deep(.glass-range) { padding-inline: 24px; }
.glass-settings__option-hint { margin: 8px 0 0; }
/* Match the first page's optics, registering only the expanded group's lenses.
   Keep native controls and their original paint as the experiment-off fallback. */
.glass-settings__choices::before { width: var(--segment-width); }
.glass-settings__choices button { padding-inline: 2px; }
@media (prefers-reduced-motion: reduce) { .glass-settings__reveal { transition: none; } }
</style>
