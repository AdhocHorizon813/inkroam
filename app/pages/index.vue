<script setup lang="ts">
useSeoMeta({
  title: '首页',
  description: '关于技术、生活与长期思考的个人博客。',
})

const { data: posts } = await useAsyncData('home-posts', () =>
  queryCollection('posts')
    .where('draft', '=', false)
    .order('pinned', 'DESC')
    .order('date', 'DESC')
    .all(),
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
          你好。这里是我的个人博客。<br>
          技术、生活，以及一些我觉得值得记下来的东西。
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
            <PinnedBadge v-if="post.pinned" />
            <FeaturedBadge v-if="post.featured" />
            <AiGeneratedBadge v-if="post.aiGenerated" />
          </div>
          <h3>{{ post.title }}</h3>
          <p>{{ post.description }}</p>
        </div>
        <span class="story-arrow" aria-hidden="true">↗</span>
      </NuxtLink>
    </section>

    <section class="manifesto">
      <p>“有些东西，不能只让它停在脑子里。”</p>
      <NuxtLink to="/about">— 关于这个博客</NuxtLink>
    </section>
  </main>
</template>
