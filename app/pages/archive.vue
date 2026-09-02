<script setup lang="ts">
useSeoMeta({ title: '文章归档', description: '纸上漫游的全部文章，按时间排列。' })

const { data: posts } = await useAsyncData('archive-posts', () =>
  queryCollection('posts').where('draft', '=', false).order('date', 'DESC').all(),
)

const groups = computed(() => {
  const result: Record<string, NonNullable<typeof posts.value>> = {}
  for (const post of posts.value || []) {
    const year = post.date.slice(0, 4)
    ;(result[year] ||= []).push(post)
  }
  return result
})

const shortDate = (date: string) => date.slice(5).replace('-', ' / ')
</script>

<template>
  <main class="standard-page">
    <header class="page-intro">
      <p class="eyebrow">THE ARCHIVE</p>
      <h1>文章归档</h1>
      <p>按时间回望所有公开的文字。观点会变化，诚实的记录会留下来。</p>
    </header>

    <section v-for="(yearPosts, year) in groups" :key="year" class="archive-year">
      <h2>{{ year }}</h2>
      <div class="archive-list">
        <NuxtLink v-for="post in yearPosts" :key="post.path" :to="post.path" class="archive-item">
          <time :datetime="post.date">{{ shortDate(post.date) }}</time>
          <span class="archive-title">
            <span>{{ post.title }}</span>
            <FeaturedBadge v-if="post.featured" />
            <AiGeneratedBadge v-if="post.aiGenerated" />
            <AiAssistedBadge v-if="post.aiAssisted" />
          </span>
          <span class="archive-tag">{{ post.tags?.[0] || '随笔' }}</span>
          <span aria-hidden="true">↗</span>
        </NuxtLink>
      </div>
    </section>
  </main>
</template>
