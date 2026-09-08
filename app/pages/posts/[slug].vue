<script setup lang="ts">
import { getTagSlug } from '~/utils/tags'

const route = useRoute()

const { data: post } = await useAsyncData(`post-${route.path}`, () =>
  queryCollection('posts').path(route.path).first(),
)

if (!post.value || post.value.draft) {
  throw createError({ statusCode: 404, statusMessage: '文章未找到' })
}

/* 文章页不再清空 og 图：继承 app.vue 的全局 og.png，
   否则社交平台抓到的是一张空图。 */
useSeoMeta({
  title: post.value.title,
  description: post.value.description,
  ogTitle: post.value.title,
  ogDescription: post.value.description,
  ogType: 'article',
  twitterCard: 'summary_large_image',
  twitterTitle: post.value.title,
  twitterDescription: post.value.description,
})

const formatDate = (date: string) =>
  new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(date))

/* In-article image zoom. Markdown images are plain <img> elements rendered by
   @nuxtjs/mdc, so clicks are delegated from the article container instead of
   overriding the prose component. */
const articleContent = ref<HTMLElement | null>(null)
const lightboxOpen = ref(false)
const lightboxIndex = ref(0)
const lightboxImages = ref<{ src: string, alt: string }[]>([])

function collectImages() {
  if (!articleContent.value) return []
  return Array.from(articleContent.value.querySelectorAll<HTMLImageElement>('img'))
}

function openLightbox(target: HTMLImageElement) {
  const images = collectImages()
  if (!images.length) return
  lightboxImages.value = images.map(image => ({
    src: image.currentSrc || image.src,
    alt: image.alt || '',
  }))
  lightboxIndex.value = Math.max(0, images.indexOf(target))
  lightboxOpen.value = true
}

function onContentClick(event: MouseEvent) {
  if (!(event.target instanceof HTMLImageElement)) return
  event.preventDefault()
  openLightbox(event.target)
}

function onContentKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter' && event.key !== ' ') return
  if (!(event.target instanceof HTMLImageElement)) return
  event.preventDefault()
  openLightbox(event.target)
}

/* Keyboard users need the images to be reachable and labelled as zoomable. */
function enhanceContentImages() {
  collectImages().forEach((image) => {
    image.setAttribute('tabindex', '0')
    image.setAttribute('role', 'button')
    image.setAttribute('aria-label', image.alt ? `放大图片：${image.alt}` : '放大图片')
  })
}

onMounted(enhanceContentImages)
watch(() => route.fullPath, async () => {
  lightboxOpen.value = false
  await nextTick()
  enhanceContentImages()
})
</script>

<template>
  <main v-if="post" class="article-page">
    <header class="article-header">
      <NuxtLink class="back-link" to="/">← 返回文章</NuxtLink>
      <div class="article-kicker">
        <span>{{ post.tags?.[0] || '随笔' }}</span>
        <time :datetime="post.date">{{ formatDate(post.date) }}</time>
        <span>阅读约 {{ post.readingTime }}</span>
        <PinnedBadge v-if="post.pinned" />
        <FeaturedBadge v-if="post.featured" />
        <AiGeneratedBadge v-if="post.aiGenerated" />
        <AiAssistedBadge v-if="post.aiAssisted" />
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
      <article
        ref="articleContent"
        class="article-content"
        @click="onContentClick"
        @keydown="onContentKeydown"
      >
        <ContentRenderer :value="post" />
      </article>
    </div>

    <footer class="article-end">
      <span>完</span>
      <p>如果这篇文章与你产生了共鸣，欢迎继续阅读归档中的其他文字。</p>
      <NuxtLink class="text-link" to="/archive">查看全部归档 <span>↗</span></NuxtLink>
    </footer>

    <ImageLightbox
      v-model:open="lightboxOpen"
      v-model:index="lightboxIndex"
      :images="lightboxImages"
    />
  </main>
</template>
