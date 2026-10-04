<script setup lang="ts">
type DisplayMode = 'off' | 'fullscreen' | 'focus'
const mode = ref<DisplayMode>('off')
const supported = ref(false)
const pending = ref(false)
const message = ref('')
const choices = [
  { value: 'off', label: '关闭' },
  { value: 'fullscreen', label: '全屏' },
  { value: 'focus', label: '专注' },
] as const
const segmentStyle = computed(() => {
  const index = choices.findIndex(choice => choice.value === mode.value)
  return { '--segment-transform': `translate3d(calc(${index * 100}% + ${index * 5}px), 0, 0)` }
})

function syncFullscreen() {
  if (document.fullscreenElement !== document.documentElement) mode.value = 'off'
  else if (mode.value === 'off') mode.value = 'fullscreen'
  document.documentElement.dataset.displayMode = mode.value
}

async function selectMode(next: DisplayMode) {
  if (pending.value) return
  message.value = ''
  pending.value = true
  try {
    if (next === 'off') {
      if (document.fullscreenElement === document.documentElement) await document.exitFullscreen()
      mode.value = 'off'
    } else {
      // Invoke directly from the click: fullscreen requires user activation.
      if (document.fullscreenElement !== document.documentElement) {
        await document.documentElement.requestFullscreen()
      }
      if (document.fullscreenElement === document.documentElement) mode.value = next
    }
  } catch {
    message.value = '浏览器未能切换显示模式，请重试或使用浏览器的全屏功能。'
  } finally {
    syncFullscreen()
    pending.value = false
  }
}

onMounted(() => {
  supported.value = Boolean(document.fullscreenEnabled && document.documentElement.requestFullscreen)
  syncFullscreen()
  document.addEventListener('fullscreenchange', syncFullscreen)
})
onUnmounted(() => {
  document.removeEventListener('fullscreenchange', syncFullscreen)
  delete document.documentElement.dataset.displayMode
})
</script>

<template>
  <fieldset class="setting-group">
    <legend class="setting-label">显示模式</legend>
    <div class="segmented-control" :style="segmentStyle" :aria-busy="pending">
      <button
        v-for="choice in choices"
        :key="choice.value"
        type="button"
        :class="{ active: mode === choice.value }"
        :aria-pressed="mode === choice.value"
        :disabled="pending || (choice.value !== 'off' && !supported)"
        @click="selectMode(choice.value)"
      >{{ choice.label }}</button>
    </div>
    <p v-if="!supported" class="setting-hint">当前浏览器不支持网页全屏。</p>
    <p v-if="message" class="setting-hint" role="status">{{ message }}</p>
  </fieldset>
</template>

<style scoped>
/* Only focus mode changes site chrome; reading width, TOC and settings stay intact. */
:global(:root[data-display-mode='focus'] .site-header),
:global(:root[data-display-mode='focus'] .site-footer) {
  display: none;
}
</style>
