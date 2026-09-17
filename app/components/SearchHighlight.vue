<script setup lang="ts">
const props = defineProps<{ text: string; terms: string[] }>()
// Render text nodes, never HTML: queries and excerpts cannot inject markup.
const parts = computed(() => {
  const terms = props.terms.filter(Boolean).sort((a, b) => b.length - a.length)
  if (!terms.length) return [{ text: props.text, match: false }]
  const escaped = terms.map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const pattern = new RegExp(`(${escaped.join('|')})`, 'gi')
  return props.text.split(pattern).map((text, index) => ({ text, match: index % 2 === 1 }))
})
</script>

<template>
  <template v-for="(part, index) in parts" :key="index"><mark v-if="part.match">{{ part.text }}</mark><template v-else>{{ part.text }}</template></template>
</template>

<style scoped>
mark { color: var(--ink); background: color-mix(in srgb, var(--accent) 22%, transparent); border-radius: 2px; }
</style>
