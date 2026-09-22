<script setup lang="ts">
import { collectTopics, filterTopics } from '~/utils/topics'
import { getTagSlug } from '~/utils/tags'

useSeoMeta({ title: '话题目录', description: '按话题探索纸上漫游的文章与学习笔记。' })
const { data: posts } = await useAsyncData('topic-directory', () =>
  queryCollection('posts').where('draft', '=', false).select('path', 'tags').all(),
)
const route = useRoute()
const router = useRouter()
const query = computed({
  get: () => typeof route.query.q === 'string' ? route.query.q : '',
  set: (value: string) => { void router.replace({ query: { ...route.query, q: value || undefined }, hash: route.hash }) },
})
const topics = computed(() => collectTopics(posts.value || []))
const visibleTopics = computed(() => filterTopics(topics.value, query.value))
</script>

<template>
  <main class="standard-page">
    <header class="page-intro compact-intro">
      <NuxtLink class="back-link" to="/archive">← 全部归档</NuxtLink>
      <p class="eyebrow">EXPLORE BY TOPIC</p>
      <h1>话题目录</h1>
      <p>点击话题，阅读相关的文章与笔记。按内容篇数排列，同一篇内容可以属于多个话题。</p>
    </header>
    <div class="topic-filter">
      <label for="topic-filter">查找话题</label>
      <div class="topic-filter__controls">
        <input id="topic-filter" v-model="query" type="search" placeholder="输入话题名称" autocomplete="off">
        <button v-if="query" type="button" @click="query = ''">清除</button>
      </div>
    </div>
    <p class="topic-summary" role="status">{{ visibleTopics.length }} / {{ topics.length }} 个话题</p>
    <ul v-if="visibleTopics.length" class="topic-directory">
      <li v-for="topic in visibleTopics" :key="topic.name">
        <NuxtLink :to="{ path: `/tags/${getTagSlug(topic.name)}`, query: { q: query || undefined } }" class="topic-link">
          <span class="topic-name">{{ topic.name }}</span>
          <span class="topic-count">{{ topic.count }} 篇</span>
          <span aria-hidden="true">↗</span>
        </NuxtLink>
      </li>
    </ul>
    <p v-else class="section-empty">{{ topics.length ? '没有匹配的话题，试试其他名称或清除筛选。' : '还没有公开的话题。' }}</p>
  </main>
</template>

<style scoped>
.topic-filter { max-width: 560px; margin-top: 28px; }
.topic-filter label { display: block; font-size: 13px; margin-bottom: 10px; }
.topic-filter__controls { display: flex; align-items: center; gap: 12px; }
.topic-filter input { min-width: 0; width: 100%; min-height: 44px; padding: 10px 12px; color: inherit; background: transparent; border: 1px solid var(--line); border-radius: 6px; font: inherit; }
.topic-filter button { min-height: 44px; padding: 8px 12px; white-space: nowrap; color: inherit; background: transparent; border: 1px solid var(--line); border-radius: 6px; cursor: pointer; }
.topic-summary { margin-block: 20px; color: var(--muted); font-size: 12px; }
.topic-directory { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--line); }
.topic-link { display: grid; grid-template-columns: minmax(0, 1fr) auto 18px; align-items: center; gap: 18px; padding: 18px 8px; min-height: 60px; border-bottom: 1px solid var(--line); transition: background-color 220ms var(--ease-fluid); }
.topic-name { overflow-wrap: anywhere; }
.topic-count { white-space: nowrap; font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; }
.topic-link:hover { background: color-mix(in srgb, var(--accent) 7%, transparent); }
.topic-link:focus-visible, .topic-filter input:focus-visible, .topic-filter button:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
:root[data-visual='modern'] .topic-directory,
:root[data-visual='modern'] .topic-link,
:root[data-visual='modern'] .topic-filter input,
:root[data-visual='modern'] .topic-filter button { border-color: var(--modern-line); }
:root[data-visual='modern'] .topic-summary,
:root[data-visual='modern'] .topic-count { color: var(--modern-muted); }
@media (prefers-reduced-motion: reduce) { .topic-link { transition: none; } }
</style>
