<script setup lang="ts">
import { getTagName } from '~/utils/tags'

const route = useRoute()
const tag = computed(() => getTagName(String(route.params.tag)))

const { data: allPosts } = await useAsyncData(`tag-posts-${tag.value}`, () =>
  queryCollection('posts').where('draft', '=', false).order('date', 'DESC').all(),
)
const posts = computed(() => allPosts.value?.filter(post => post.tags?.includes(tag.value)) || [])

useSeoMeta({
  title: () => `标签：${tag.value}`,
  description: () => `纸上漫游中与“${tag.value}”有关的文章。`,
})
</script>

<template>
  <main class="standard-page">
    <header class="page-intro compact-intro">
      <p class="eyebrow">TOPIC</p>
      <h1>“{{ tag }}”</h1>
      <p>共 {{ posts.length }} 篇相关文章</p>
    </header>
    <section class="latest-section tag-results">
      <NuxtLink v-for="(post, index) in posts" :key="post.path" :to="post.path" class="story-row">
        <span class="story-index">{{ String(index + 1).padStart(2, '0') }}</span>
        <div class="story-body">
          <div class="story-meta"><time>{{ post.date }}</time><span>{{ post.readingTime }}</span></div>
          <h3>{{ post.title }}</h3>
          <p>{{ post.description }}</p>
        </div>
        <span class="story-arrow" aria-hidden="true">↗</span>
      </NuxtLink>
    </section>
  </main>
</template>
