<script setup lang="ts">
import { entrySummaryFields } from '~/utils/entry-summary'
import type { EntrySummary } from '~/utils/entry-summary'
import { relatedEntries } from '~/utils/topics'
const props = defineProps<{ current: EntrySummary }>()
const { data } = await useAsyncData('related-public-entries', () =>
  queryCollection('posts').select(...entrySummaryFields).where('draft', '=', false).order('date', 'DESC').all(),
)
const related = computed(() => relatedEntries(props.current, data.value || []))
</script>

<template>
  <section v-if="related.length" class="related-entries" aria-labelledby="related-heading">
    <h2 id="related-heading">继续阅读</h2>
    <p>沿着相同话题，看看其他文章与笔记。</p>
    <TimelineArchive :posts="related" />
    <NuxtLink class="text-link" to="/tags">探索全部话题 ↗</NuxtLink>
  </section>
</template>

<style scoped>
.related-entries { margin-top: 56px; padding-top: 32px; border-top: 1px solid var(--line); }
.related-entries h2 { font-size: 24px; }
.related-entries > p { margin-block: 12px 24px; color: var(--muted); font-size: 14px; }
:root[data-visual='modern'] .related-entries { border-color: var(--modern-line); }
:root[data-visual='modern'] .related-entries > p { color: var(--modern-muted); }
</style>
