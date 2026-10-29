<script setup lang="ts">
import AppearanceMenuRow from './AppearanceMenuRow.vue'
import { GLASS_GROUPS, recommendGlassPreferences, type GlassGroup, type GlassPreferences, type GlassPreference, type GlassGlobalOverride } from '~/utils/glass-settings'

const props = defineProps<{
  modelValue: GlassPreferences
  global: GlassGlobalOverride
  enabled: boolean
  visual: string
  materials: Record<string, string>
}>()
const emit = defineEmits<{ 'update:modelValue': [value: GlassPreferences]; 'update:global': [value: GlassGlobalOverride]; 'update:enabled': [value: boolean] }>()
type Entry = GlassGroup | 'global'
const groups = [{ id: 'global' as const, label: '全局参数', material: '', owner: '覆盖下方所有分项，不覆盖原材质选择' }, ...GLASS_GROUPS]
const preference = (id: Entry) => id === 'global' ? props.global.settings : props.modelValue[id]
const expanded = ref<Entry | null>(null)
const recommendation = ref('')
const choices = [
  { key: 'resolution', label: '折射贴图精度', options: [{ value: 0, label: '自动' }, { value: 1, label: '1×' }, { value: 1.5, label: '1.5×' }, { value: 2, label: '2×' }] },
  { key: 'pixelBudget', label: '单层贴图预算', options: [{ value: .5, label: '50 万' }, { value: 1.5, label: '150 万' }, { value: 3, label: '300 万' }] },
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
function recommend() {
  const result = recommendGlassPreferences({ cores: navigator.hardwareConcurrency || undefined,
    memory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
    pixels: window.innerWidth * window.innerHeight * window.devicePixelRatio ** 2,
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
  }, props.modelValue)
  if (props.global.enabled) emit('update:global', { ...props.global, settings: { ...result.preferences.navbar, clarity: props.global.settings.clarity } })
  else emit('update:modelValue', result.preferences)
  recommendation.value = `已应用${result.label}设置。基于设备可用信息估算，未进行 GPU 性能测试；可继续手动调整。`
}
const segments = (index: number, count: number) => ({ '--segment-transform': `translateX(calc(${index} * (100% + 5px)))`, gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` })
</script>

<template>
  <div class="glass-settings">
        <fieldset class="setting-group" :disabled="visual === 'classic'">
          <legend class="setting-label">实验性液态玻璃</legend>
          <div class="segmented-control segmented-control--two" :style="segments(enabled ? 1 : 0, 2)">
            <button type="button" :aria-pressed="!enabled" :class="{ active: !enabled }" @click="emit('update:enabled', false)">关闭</button>
            <button type="button" :aria-pressed="enabled" :class="{ active: enabled }" @click="emit('update:enabled', true)">开启</button>
          </div>
        </fieldset>
        <p class="setting-hint">仅在实验开关开启、组件材质为液态玻璃时生效。关闭真液态玻璃会恢复原材质。</p>
        <fieldset class="setting-group">
          <legend class="setting-label">全局覆盖</legend>
          <div class="segmented-control segmented-control--two" :style="segments(global.enabled ? 1 : 0, 2)">
            <button type="button" :class="{ active: !global.enabled }" :aria-pressed="!global.enabled" @click="toggleGlobal(false)">关闭</button>
            <button type="button" :class="{ active: global.enabled }" :aria-pressed="global.enabled" @click="toggleGlobal(true)">开启</button>
          </div>
        </fieldset>
        <p v-if="global.enabled" class="setting-hint">正在使用全局参数。分项设置已保留，关闭全局覆盖后恢复。</p>
        <AppearanceMenuRow :arrow="false" @click="recommend">应用设备推荐设置</AppearanceMenuRow>
        <p v-if="recommendation" class="setting-hint" role="status">{{ recommendation }}</p>
        <div v-for="group in groups" :key="group.id" class="glass-settings__component">
          <AppearanceMenuRow :expanded="expanded === group.id" :aria-expanded="expanded === group.id" :aria-controls="`glass-settings-${group.id}`" @click="expanded = expanded === group.id ? null : group.id">{{ group.label }}</AppearanceMenuRow>
          <div :id="`glass-settings-${group.id}`" class="glass-settings__reveal" :class="{ expanded: expanded === group.id }" :inert="expanded !== group.id" :aria-hidden="expanded !== group.id">
            <div class="glass-settings__clip"><div class="glass-settings__body">
              <p class="setting-hint">{{ group.owner }}{{ group.id !== 'global' && global.enabled ? ' · 已被全局覆盖' : available(group.id) ? ' · 可用' : ' · 当前未生效' }}</p>
              <fieldset class="setting-group" :disabled="!available(group.id)">
                <legend class="setting-label">真液态玻璃</legend>
                <div class="segmented-control segmented-control--two" :style="segments(preference(group.id).enabled ? 1 : 0, 2)">
                  <button v-for="(label, index) in ['关闭', '开启']" :key="label" type="button" :class="{ active: preference(group.id).enabled === !!index }" :aria-pressed="preference(group.id).enabled === !!index" @click="update(group.id, 'enabled', !!index)">{{ label }}</button>
                </div>
              </fieldset>
              <fieldset class="glass-settings__parameters" :disabled="!available(group.id) || !preference(group.id).enabled">
                <div class="setting-group">
                  <div class="range-heading"><label class="setting-label" :for="`clarity-${group.id}`">通透度</label><output :for="`clarity-${group.id}`">{{ preference(group.id).clarity }}%</output></div>
                  <input :id="`clarity-${group.id}`" type="range" min="0" max="100" step="1" :value="preference(group.id).clarity" :style="{ '--range-progress': `${preference(group.id).clarity}%` }" @input="update(group.id, 'clarity', Number(($event.target as HTMLInputElement).value))">
                </div>
                <fieldset class="setting-group">
                  <legend class="setting-label">玻璃抗锯齿</legend>
                  <div class="segmented-control segmented-control--two" :style="segments(preference(group.id).antialias ? 1 : 0, 2)">
                    <button v-for="(label, index) in ['关闭', '开启']" :key="label" type="button" :class="{ active: preference(group.id).antialias === !!index }" :aria-pressed="preference(group.id).antialias === !!index" @click="update(group.id, 'antialias', !!index)">{{ label }}</button>
                  </div>
                </fieldset>
                <fieldset class="setting-group" :disabled="!preference(group.id).antialias">
                  <legend class="setting-label">抗锯齿采样倍数</legend>
                  <div class="segmented-control" :style="segments([1, 1.5, 2].indexOf(preference(group.id).aaScale), 3)">
                    <button v-for="scale in [1, 1.5, 2]" :key="scale" type="button" :class="{ active: preference(group.id).aaScale === scale }" :aria-pressed="preference(group.id).aaScale === scale" @click="update(group.id, 'aaScale', scale)">{{ scale }}×</button>
                  </div>
                </fieldset>
                <fieldset v-for="choice in choices" :key="choice.key" class="setting-group">
                  <legend class="setting-label">{{ choice.label }}</legend>
                  <div class="segmented-control glass-settings__choices" :style="segments(choice.options.findIndex(option => option.value === preference(group.id)[choice.key]), choice.options.length)">
                    <button v-for="option in choice.options" :key="option.value" type="button" :class="{ active: preference(group.id)[choice.key] === option.value }" :aria-pressed="preference(group.id)[choice.key] === option.value" @click="update(group.id, choice.key, option.value)">{{ option.label }}</button>
                  </div>
                </fieldset>
                <p class="setting-hint">低通透度增加磨砂。采样倍数作用于每条边，2× 最高增加四倍像素；预算限制最终精度，不代表背景分辨率。</p>
              </fieldset>
            </div></div>
          </div>
        </div>
  </div>
</template>

<style scoped>
.glass-settings__reveal { display: grid; grid-template-rows: 0fr; opacity: 0; transition: grid-template-rows 380ms cubic-bezier(.16, 1, .3, 1), opacity 220ms ease; }
.glass-settings__reveal.expanded { grid-template-rows: 1fr; opacity: 1; }
.glass-settings__clip { min-height: 0; overflow: hidden; }
.glass-settings__body { padding: 4px 2px 14px; }
.glass-settings__parameters { margin: 0; padding: 0; border: 0; min-width: 0; }
/* These diagnostic settings deliberately reuse native controls: opening their
   accordion must not allocate dozens of new experimental backdrop filters. */
.glass-settings__choices::before { width: calc((100% - 18px) / 3); }
.glass-settings__choices:has(> button:nth-child(4))::before { width: calc((100% - 23px) / 4); }
@media (prefers-reduced-motion: reduce) { .glass-settings__reveal { transition: none; } }
</style>
