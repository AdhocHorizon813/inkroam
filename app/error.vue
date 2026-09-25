<script setup lang="ts">
import type { NuxtError } from '#app'
import { usePageScrollable } from '~/composables/usePageScrollable'

const props = defineProps<{ error: NuxtError }>()
const baseURL = useRuntimeConfig().app.baseURL
const missing = computed(() => props.error.statusCode === 404)
const pageScroll = ref<HTMLElement | null>(null)
usePageScrollable(pageScroll)

useSeoMeta({
  title: () => missing.value ? '页面未找到' : '暂时无法打开页面',
  robots: 'noindex, nofollow',
})

// A full navigation also recovers from failed client chunks or app startup.
// Do not expose error.message, request URLs or stack traces on this page.
</script>

<template>
  <div class="ambient-backdrop" aria-hidden="true">
    <div class="ambient-source">
      <div class="ambient-image" />
      <div class="ambient-aurora" />
    </div>
    <div class="ambient-vignette" />
  </div>
  <div ref="pageScroll" class="page-scroll">
    <div class="site-shell">
      <header class="site-header">
        <a class="brand" :href="baseURL" aria-label="纸上漫游首页">
          <span class="brand-mark">纸</span>
          <span>纸上漫游</span>
        </a>
      </header>
      <main class="standard-page error-page" aria-labelledby="error-title">
        <header class="page-intro">
          <p class="eyebrow">{{ missing ? '404 / PAGE NOT FOUND' : 'SOMETHING WENT WRONG' }}</p>
          <h1 id="error-title">{{ missing ? '这一页不在这里。' : '这一页暂时打不开。' }}</h1>
          <p class="error-description">{{ missing ? '链接可能已经失效，也可能只是地址写错了。你可以回到首页，或从归档和搜索中找找。' : '可以稍后再试，或先回到首页继续阅读。' }}</p>
        </header>
        <nav class="error-links" aria-label="继续浏览">
          <a class="text-link" :href="baseURL">返回首页 <span aria-hidden="true">↗</span></a>
          <a class="text-link" :href="`${baseURL}archive/`">浏览归档 <span aria-hidden="true">↗</span></a>
          <a class="text-link" :href="`${baseURL}search/`">搜索文章与笔记 <span aria-hidden="true">↗</span></a>
        </nav>
      </main>
    </div>
  </div>
  <AppearancePanel />
</template>

<style scoped>
.error-page .page-intro { max-width: none; margin-bottom: 40px; }
.error-page .page-intro > .error-description { max-width: none; text-wrap: pretty; }
.error-links { display: flex; flex-wrap: wrap; gap: 24px 36px; }
@media (max-width: 767.98px) {
  .error-links { align-items: flex-start; flex-direction: column; gap: 24px; }
}
</style>
