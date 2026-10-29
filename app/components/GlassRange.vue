<script setup lang="ts">
import { vExperimentalGlass } from '~/utils/glass-surfaces'

withDefaults(defineProps<{ active?: boolean }>(), { active: true })

// The slotted native input remains the sole input/focus/ARIA owner. The lens is
// pointer-transparent, and appears only once its filter is decoded successfully.
const host = ref<HTMLElement | null>(null)
// Vue can write .value without changing an attribute. Notify the lazily attached
// control owner after slot updates; native input events cover dragging/keyboard.
onUpdated(() => host.value?.dispatchEvent(new Event('inkroam:range-update')))
</script>

<template>
  <span ref="host" class="glass-range">
    <slot />
    <span v-experimental-glass="active" data-glass-module="thumb" class="glass-range__thumb" aria-hidden="true" />
  </span>
</template>

<style scoped>
.glass-range { position: relative; display: block; min-width: 0; flex: 1; line-height: 0; }
.glass-range__thumb { position: absolute; width: 24px; height: 18px; border-radius: 999px; transform: translate(-50%, -50%); pointer-events: none; visibility: hidden; }
.glass-range__thumb[data-liquid-glass-active] { visibility: visible; }
.glass-range__thumb[data-disabled='true'] { opacity: .4; }
</style>
