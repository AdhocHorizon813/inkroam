<script setup lang="ts">
import katex from 'katex'
import type { ExcerptPart } from '~/utils/search-excerpt'
const props = defineProps<{ parts: ExcerptPart[]; terms: string[] }>()
const rendered = computed(() => props.parts.map(part => {
  if (part.kind !== 'math') return { ...part, html: '' }
  try {
    return { ...part, html: katex.renderToString(part.text, { displayMode: false, throwOnError: true, trust: false, strict: 'ignore', maxExpand: 1000, maxSize: 20 }) }
  } catch {
    return { kind: 'text' as const, text: '〔公式请见正文〕', html: '' }
  }
}))
</script>

<template>
  <template v-for="(part, index) in rendered" :key="index">
    <!-- Only trusted KaTeX output is inserted; query and prose stay text nodes. -->
    <span v-if="part.kind === 'math'" class="search-formula" v-html="part.html" />
    <SearchHighlight v-else :text="part.text" :terms="terms" />
  </template>
</template>

<style scoped>
.search-formula { display: inline-block; max-width: 100%; overflow-x: auto; overflow-y: hidden; scrollbar-width: none; vertical-align: middle; padding: .25em .12em; color: var(--ink); }
/* Inline math can overflow by a fraction of a pixel. Do not expose native
   scrollbar arrows beneath tiny formulas; long formulas remain scrollable. */
.search-formula::-webkit-scrollbar { display: none; width: 0; height: 0; }
.search-formula::-webkit-scrollbar-button { display: none; width: 0; height: 0; }
.search-formula :deep(.katex) { font-size: 1.05em; }
</style>
