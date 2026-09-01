<script setup lang="ts">
useSeoMeta({
  title: '首页',
  description: '关于技术、生活与长期思考的个人博客。',
})

const { data: posts } = await useAsyncData('home-posts', () =>
  queryCollection('posts').where('draft', '=', false).order('date', 'DESC').all(),
)

const formatDate = (date: string) => date.replaceAll('-', '.')
</script>

<template>
  <main>
    <section class="hero">
      <p class="eyebrow">A PERSONAL JOURNAL · 2026</p>
      <h1>写下那些<br><em>不该被遗忘</em>的想法。</h1>
      <div class="hero-aside">
        <p class="hero-copy">
          你好，我是纸上漫游者。这里记录技术之外的判断、阅读之后的回声，
          以及对更好生活方式的持续探索。
        </p>
        <a class="text-link" href="#latest">开始阅读 <span>↘</span></a>
      </div>
    </section>

    <section id="latest" class="latest-section">
      <div class="section-heading">
        <div>
          <p class="eyebrow">LATEST NOTES</p>
          <h2>最近写下</h2>
        </div>
        <span class="issue-number">VOL. 01 · {{ posts?.length || 0 }} 篇</span>
      </div>

      <NuxtLink
        v-for="(post, index) in posts"
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
          </div>
          <h3>{{ post.title }}</h3>
          <p>{{ post.description }}</p>
        </div>
        <span class="story-arrow" aria-hidden="true">↗</span>
      </NuxtLink>
    </section>

    <section class="manifesto">
      <p>“真正重要的内容，值得一个安静、耐看的容器。”</p>
      <NuxtLink to="/about">— 关于这个博客</NuxtLink>
    </section>
  </main>
</template>
