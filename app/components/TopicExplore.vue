<script setup lang="ts">
import { collectTopics, isSubjectTag } from '~/utils/topics'
import { getTagSlug } from '~/utils/tags'
const { data } = await useAsyncData('home-topic-explore', () =>
  queryCollection('posts').where('draft', '=', false).select('path', 'tags').all(),
)
const topics = computed(() => collectTopics(data.value || []).filter(topic => isSubjectTag(topic.name)).slice(0, 6))
</script>

<template>
  <section class="latest-section topic-explore" aria-labelledby="explore-heading">
    <div class="section-heading">
      <div><p class="eyebrow">FOLLOW YOUR CURIOSITY</p><h2 id="explore-heading">按话题探索</h2></div>
      <NuxtLink class="text-link" to="/tags">全部话题 ↗</NuxtLink>
    </div>
    <ul class="topic-explore__links">
      <li v-for="topic in topics" :key="topic.name"><NuxtLink :to="`/tags/${getTagSlug(topic.name)}`">{{ topic.name }} <span>{{ topic.count }} 篇 ↗</span></NuxtLink></li>
    </ul>
    <p v-if="!topics.length" class="section-empty">还没有可探索的主题，看看全部话题吧。</p>
  </section>
</template>

<style scoped>
.topic-explore__links { display: flex; flex-wrap: wrap; gap: 10px 24px; list-style: none; padding: 0; margin: 0; }
.topic-explore__links a { display: inline-flex; align-items: center; gap: 12px; min-height: 44px; text-decoration: underline; text-underline-offset: 5px; }
.topic-explore__links span { font-size: 12px; color: var(--muted); }
a:focus-visible { outline: 2px solid var(--accent); outline-offset: 4px; }
:root[data-visual='modern'] .topic-explore__links span { color: var(--modern-muted); }
</style>
