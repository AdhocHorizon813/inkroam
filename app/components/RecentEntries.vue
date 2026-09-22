<script setup lang="ts">
import type { EntrySummary } from '~/utils/entry-summary'
import { courseForPath } from '~/utils/courses'
defineProps<{ id: string; title: string; eyebrow: string; posts: EntrySummary[]; moreTo: string; moreLabel: string; emptyText: string }>()
const formatDate = (date: string) => date.replaceAll('-', '.')
</script>

<template>
  <section :id="id" class="latest-section" :aria-labelledby="`${id}-heading`">
    <div class="section-heading">
      <div>
        <p class="eyebrow">{{ eyebrow }}</p>
        <h2 :id="`${id}-heading`">{{ title }}</h2>
      </div>
      <span class="issue-number">{{ posts.length }} 篇</span>
    </div>
    <NuxtLink v-for="(post, index) in posts" :key="post.path" :to="post.path" class="story-row">
      <span class="story-index">{{ String(index + 1).padStart(2, '0') }}</span>
      <div class="story-body">
        <div class="story-meta">
          <span>{{ courseForPath(post.path)?.name || post.tags?.[0] || '随笔' }}</span>
          <time :datetime="post.date">{{ formatDate(post.date) }}</time>
          <span>{{ post.readingTime }}</span>
          <PinnedBadge v-if="post.pinned" />
          <FeaturedBadge v-if="post.featured" />
          <AiGeneratedBadge v-if="post.aiGenerated" />
          <AiAssistedBadge v-if="post.aiAssisted" />
        </div>
        <h3>{{ post.title }}</h3>
        <p>{{ post.description }}</p>
      </div>
      <span class="story-arrow" aria-hidden="true">↗</span>
    </NuxtLink>
    <p v-if="!posts.length" class="section-empty">{{ emptyText }}</p>
    <div class="section-footer">
      <NuxtLink class="archive-link" :to="moreTo">{{ moreLabel }} <span aria-hidden="true">→</span></NuxtLink>
    </div>
  </section>
</template>
