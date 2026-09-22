<script setup lang="ts">
import type { EntrySummary } from '~/utils/entry-summary'
import { courseForPath } from '~/utils/courses'
const props = withDefaults(defineProps<{ posts: EntrySummary[]; emptyText?: string }>(), { emptyText: '暂无公开内容。' })
const groups = computed(() => {
  const result = new Map<string, EntrySummary[]>()
  for (const post of [...props.posts].sort((a, b) => b.date.localeCompare(a.date) || a.path.localeCompare(b.path))) {
    const year = post.date.slice(0, 4)
    if (!result.has(year)) result.set(year, [])
    result.get(year)!.push(post)
  }
  return [...result].map(([year, posts]) => ({ year, posts }))
})
const shortDate = (date: string) => date.slice(5).replace('-', ' / ')
</script>

<template>
  <section v-for="group in groups" :key="group.year" class="archive-year">
    <h2>{{ group.year }}</h2>
    <div class="archive-list">
      <NuxtLink v-for="post in group.posts" :key="post.path" :to="post.path" class="archive-item">
        <time :datetime="post.date">{{ shortDate(post.date) }}</time>
        <span class="archive-title">
          <span>{{ post.title }}</span>
          <FeaturedBadge v-if="post.featured" />
          <AiGeneratedBadge v-if="post.aiGenerated" />
          <AiAssistedBadge v-if="post.aiAssisted" />
        </span>
        <span class="archive-tag">{{ courseForPath(post.path)?.name || post.tags?.[0] || '随笔' }}</span>
        <span aria-hidden="true">↗</span>
      </NuxtLink>
    </div>
  </section>
  <p v-if="!posts.length" class="section-empty">{{ emptyText }}</p>
</template>
