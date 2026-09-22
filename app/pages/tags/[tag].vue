<script setup lang="ts">
import { entrySummaryFields } from '~/utils/entry-summary'
import { getTagName } from '~/utils/tags'

const route = useRoute()
const router = useRouter()
const tag = computed(() => getTagName(String(route.params.tag)))

const { data: allPosts } = await useAsyncData(`tag-posts-${tag.value}`, () =>
  queryCollection('posts').select(...entrySummaryFields).where('draft', '=', false).order('date', 'DESC').all(),
)
const posts = computed(() => allPosts.value?.filter(post => post.tags?.includes(tag.value)) || [])
const kind = computed<'all' | 'posts' | 'notes'>({
  get: () => route.query.type === 'posts' || route.query.type === 'notes' ? route.query.type : 'all',
  set: value => { void router.replace({ query: { ...route.query, type: value === 'all' ? undefined : value }, hash: route.hash }) },
})
const directoryQuery = computed(() => typeof route.query.q === 'string' ? route.query.q : undefined)
const filters = [{ value: 'all', label: '全部' }, { value: 'posts', label: '文章' }, { value: 'notes', label: '笔记' }] as const
const countFor = (value: string) => posts.value.filter(post => value === 'all' || post.path.startsWith(`/${value}/`)).length
const visiblePosts = computed(() => posts.value.filter(post => kind.value === 'all' || post.path.startsWith(`/${kind.value}/`)))

useSeoMeta({
  title: () => `标签：${tag.value}`,
  description: () => `纸上漫游中与“${tag.value}”有关的文章与学习笔记。`,
})
</script>

<template>
  <main class="standard-page">
    <header class="page-intro compact-intro">
      <NuxtLink class="back-link" :to="{ path: '/tags', query: { q: directoryQuery } }">← 全部话题</NuxtLink>
      <p class="eyebrow">TOPIC</p>
      <h1>“{{ tag }}”</h1>
      <p>共 {{ posts.length }} 篇内容 · 文章与笔记</p>
    </header>
    <div class="topic-kind" role="group" aria-label="内容类型">
      <button v-for="filter in filters" :key="filter.value" type="button" :aria-pressed="kind === filter.value" @click="kind = filter.value">{{ filter.label }} · {{ countFor(filter.value) }}</button>
    </div>
    <p class="topic-kind-count" role="status">当前显示 {{ visiblePosts.length }} 篇内容</p>
    <TimelineArchive :posts="visiblePosts" empty-text="当前类型下没有公开内容，可切换类型或返回全部话题。" />
  </main>
</template>

<style scoped>
.topic-kind { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 24px; }
.topic-kind button { min-height: 44px; padding: 8px 16px; border: 1px solid var(--line); border-radius: 6px; background: transparent; color: inherit; font: inherit; cursor: pointer; }
.topic-kind button[aria-pressed='true'] { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 12%, transparent); }
.topic-kind button:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
.topic-kind-count { margin-block: 16px 24px; font-size: 12px; color: var(--muted); }
:root[data-visual='modern'] .topic-kind button { border-color: var(--modern-line); }
:root[data-visual='modern'] .topic-kind button[aria-pressed='true'] { border-color: var(--accent-strong); }
:root[data-visual='modern'] .topic-kind-count { color: var(--modern-muted); }
</style>
