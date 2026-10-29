<script setup lang="ts">
withDefaults(defineProps<{ expanded?: boolean; arrow?: boolean }>(), { expanded: false, arrow: true })
</script>

<template>
  <button type="button" class="appearance-menu-row setting-group setting-label">
    <span><slot /></span>
    <svg v-if="arrow" :class="{ rotated: expanded }" viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5" /></svg>
  </button>
</template>

<style scoped>
/* Keep the panel's typography, colour and separator. A menu row is not a label
   above an input: discard only its label margin, with symmetric row padding. */
.appearance-menu-row.setting-label { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; min-height: 48px; margin: 0; padding: 16px 0; background: none; font-family: inherit; text-align: left; cursor: pointer; }
.appearance-menu-row svg { flex: 0 0 14px; width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 1.5; transition: transform 320ms cubic-bezier(.16, 1, .3, 1); }
.appearance-menu-row svg.rotated { transform: rotate(90deg); }
@media (max-width: 767px) { .appearance-menu-row.setting-label { min-height: 44px; padding-block: 11px; } }
@media (prefers-reduced-motion: reduce) { .appearance-menu-row svg { transition: none; } }
</style>
