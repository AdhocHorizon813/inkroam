<script setup lang="ts">
import { entrySummaryFields } from '~/utils/entry-summary'
useSeoMeta({
  title: '首页',
  description: '关于技术、生活与长期思考的个人博客。',
})

const { data: posts } = await useAsyncData('home-posts', () =>
  queryCollection('posts').select(...entrySummaryFields)
    .where('draft', '=', false)
    .where('path', 'LIKE', '/posts/%')
    .order('pinned', 'DESC')
    .order('date', 'DESC')
    .all(),
)

const { data: featuredPosts } = await useAsyncData('home-featured-posts', () =>
  queryCollection('posts').select(...entrySummaryFields)
    .where('draft', '=', false)
    .where('path', 'LIKE', '/posts/%')
    .where('featured', '=', true)
    .order('date', 'DESC')
    .all(),
)

const { data: notes } = await useAsyncData('home-notes', () =>
  queryCollection('posts').select(...entrySummaryFields).where('draft', '=', false).where('path', 'LIKE', '/notes/%').order('date', 'DESC').all(),
)

type LatestPostCount = 5 | 10 | 'all'
const latestPostCount = useState<LatestPostCount>('latest-post-count', () => 10)
const latestNoteCount = useState<LatestPostCount>('latest-note-count', () => 10)
const visiblePosts = computed(() => {
  const allPosts = posts.value || []
  return latestPostCount.value === 'all'
    ? allPosts
    : allPosts.slice(0, latestPostCount.value)
})

const visibleNotes = computed(() => latestNoteCount.value === 'all'
  ? notes.value || []
  : (notes.value || []).slice(0, latestNoteCount.value))

const formatDate = (date: string) => date.replaceAll('-', '.')
</script>

<template>
  <main>
    <section class="hero">
      <p class="eyebrow">A PERSONAL JOURNAL · 2026</p>
      <h1>写下那些<br><em>不该被遗忘</em>的想法。</h1>
      <div class="hero-aside">
        <p class="hero-copy">
          你好。这里是我的个人博客。<br>
          技术、生活，以及一些我觉得值得记下来的东西。
        </p>
        <a class="text-link" href="#latest">开始阅读 <span>↘</span></a>
      </div>
    </section>

    <RecentEntries
      id="latest" title="最近写下" eyebrow="LATEST ARTICLES"
      :posts="visiblePosts" more-to="/archive" more-label="查看所有文章"
      empty-text="还没有公开文章。"
    />
    <RecentEntries
      id="latest-notes" title="最近笔记" eyebrow="LATEST STUDY NOTES"
      :posts="visibleNotes" more-to="/notes" more-label="查看所有笔记"
      empty-text="还没有公开的学习笔记，先去课程目录看看。"
    />

    <section class="latest-section featured-section" aria-labelledby="featured-heading">
      <div class="section-heading">
        <div>
          <p class="eyebrow">SELECTED NOTES</p>
          <h2 id="featured-heading">精选文章</h2>
        </div>
        <span class="issue-number">{{ featuredPosts?.length || 0 }} 篇</span>
      </div>

      <NuxtLink
        v-for="(post, index) in featuredPosts"
        :key="post.path"
        :to="post.path"
        class="story-row"
      >
        <span class="story-index">{{ String(index + 1).padStart(2, '0') }}</span>
        <div class="story-body">
          <div class="story-meta">
            <span>{{ post.tags?.[0] || '随笔' }}</span>
            <time :datetime="post.date">{{ formatDate(post.date) }}</time>
            <span>{{ post.readingTime }}</span>
            <AiGeneratedBadge v-if="post.aiGenerated" />
            <AiAssistedBadge v-if="post.aiAssisted" />
          </div>
          <h3>{{ post.title }}</h3>
          <p>{{ post.description }}</p>
        </div>
        <span class="story-arrow" aria-hidden="true">↗</span>
      </NuxtLink>

      <p v-if="!featuredPosts?.length" class="section-empty">尚未选出精选文章。</p>
    </section>

    <TopicExplore />

    <section class="manifesto">
      <p>“有些东西，不能只让它停在脑海里。”</p>
      <NuxtLink to="/about">— 关于这个博客</NuxtLink>
    </section>
  </main>
</template>
