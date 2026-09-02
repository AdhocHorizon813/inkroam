<script setup lang="ts">
import { getTagSlug } from '~/utils/tags'

const route = useRoute()

const { data: post } = await useAsyncData(`post-${route.path}`, () =>
  queryCollection('posts').path(route.path).first(),
)

if (!post.value || post.value.draft) {
  throw createError({ statusCode: 404, statusMessage: '文章未找到' })
}

useSeoMeta({
  title: post.value.title,
  description: post.value.description,
  ogTitle: post.value.title,
  ogDescription: post.value.description,
  ogType: 'article',
  ogImage: '',
  twitterCard: 'summary_large_image',
  twitterTitle: post.value.title,
  twitterDescription: post.value.description,
  twitterImage: '',
})

const formatDate = (date: string) =>
  new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(date))
</script>

<template>
  <main v-if="post" class="article-page">
    <header class="article-header">
      <NuxtLink class="back-link" to="/">← 返回文章</NuxtLink>
      <div class="article-kicker">
        <span>{{ post.tags?.[0] || '随笔' }}</span>
        <time :datetime="post.date">{{ formatDate(post.date) }}</time>
        <span>阅读约 {{ post.readingTime }}</span>
        <AiGeneratedBadge v-if="post.aiGenerated" />
      </div>
      <h1>{{ post.title }}</h1>
      <p class="article-deck">{{ post.description }}</p>
    </header>

    <div class="article-grid">
      <aside class="article-aside">
        <span>主题</span>
        <div class="tag-list">
          <NuxtLink v-for="tag in (post.tags || [])" :key="tag" :to="`/tags/${getTagSlug(tag)}`">{{ tag }}</NuxtLink>
        </div>
      </aside>
      <article class="article-content">
        <ContentRenderer :value="post" />
      </article>
    </div>

    <footer class="article-end">
      <span>完</span>
      <p>如果这篇文章与你产生了共鸣，欢迎继续阅读归档中的其他文字。</p>
      <NuxtLink class="text-link" to="/archive">查看全部归档 <span>↗</span></NuxtLink>
    </footer>
  </main>
</template>
