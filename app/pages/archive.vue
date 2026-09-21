<script setup lang="ts">
useSeoMeta({ title: '文章归档', description: '纸上漫游的全部文章与学习笔记，按时间排列。' })
const { data: posts } = await useAsyncData('archive-posts', () =>
  queryCollection('posts').where('draft', '=', false).order('date', 'DESC').all(),
)
</script>

<template>
  <main class="standard-page">
    <header class="page-intro">
      <p class="eyebrow">THE ARCHIVE</p>
      <h1>文章归档</h1>
      <p>按时间回望文章与学习笔记。观点会变化，诚实的记录会留下来。</p>
      <NuxtLink class="text-link" to="/tags">按话题浏览 <span aria-hidden="true">↗</span></NuxtLink>
    </header>
    <TimelineArchive :posts="posts || []" />
  </main>
</template>
