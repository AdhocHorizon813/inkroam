<script setup lang="ts">
defineProps<{ count: number }>()
const expanded = ref(false)
const panelId = useId()
</script>

<template>
  <div class="more-matches">
    <button type="button" class="more-matches__toggle" :aria-expanded="expanded" :aria-controls="panelId" @click="expanded = !expanded">
      <span class="more-matches__chevron" :class="{ 'is-expanded': expanded }" aria-hidden="true">›</span>
      {{ expanded ? '收起其余' : '展开其余' }} {{ count }} 处匹配
    </button>
    <div :id="panelId" class="more-matches__body" :class="{ 'is-expanded': expanded }" :inert="!expanded" :aria-hidden="!expanded">
      <div class="more-matches__clip"><slot /></div>
    </div>
  </div>
</template>

<style scoped>
.more-matches__toggle { display: inline-flex; align-items: center; gap: 5px; margin-top: 16px; padding: 6px 0; border: 0; background: transparent; color: var(--muted); font: inherit; font-size: 12px; cursor: pointer; }
.more-matches__toggle:hover { color: var(--ink); }
.more-matches__chevron { display: inline-block; font-size: 16px; line-height: 1; transition: transform 260ms var(--ease-settle, cubic-bezier(.2, .82, .22, 1)); }
.more-matches__chevron.is-expanded { transform: rotate(90deg); }
.more-matches__body { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 260ms var(--ease-exit, cubic-bezier(.4, 0, .85, .25)); }
.more-matches__body.is-expanded { grid-template-rows: 1fr; transition-duration: 440ms; transition-timing-function: var(--ease-settle, cubic-bezier(.2, .82, .22, 1)); }
.more-matches__clip { min-height: 0; overflow: hidden; }
@media (prefers-reduced-motion: reduce) {
  .more-matches__body, .more-matches__chevron { transition-duration: .01ms; }
}
</style>
