<script setup lang="ts">
import { getTagSlug } from '~/utils/tags'
import { courseForPath } from '~/utils/courses'
import PdfViewer from '~/components/content/PdfViewer.vue'
import ArticleCode from '~/components/content/ArticleCode.vue'
import ArticleTable from '~/components/content/ArticleTable.vue'
import TreeWalk from '~/components/content/TreeWalk.vue'
import AlgebraExplorer from '~/components/content/AlgebraExplorer.vue'
import '~/assets/css/article-technical.css'

const route = useRoute()
const course = courseForPath(route.path)
const sidebarCollapsed = useState('article-sidebar-collapsed', () => false)
const wideLayout = ref(false)
const sidebarHidden = computed(() => wideLayout.value && sidebarCollapsed.value)
const sidebar = ref<HTMLElement | null>(null)
const sidebarMotionReady = ref(false)
const sidebarMotionStyle = ref<Record<string, string>>({})
let layoutQuery: MediaQueryList | undefined
let contentMotion: Animation | undefined
function updateLayout() {
  contentMotion?.cancel()
  sidebarMotionReady.value = false
  wideLayout.value = layoutQuery?.matches ?? false
}

async function toggleSidebar() {
  const aside = sidebar.value
  const grid = aside?.parentElement
  if (aside && grid) {
    const rect = aside.getBoundingClientRect()
    const parentRect = grid.getBoundingClientRect()
    const style = getComputedStyle(aside)
    const translation = style.transform === 'none' ? null : new DOMMatrixReadOnly(style.transform)
    // Freeze the outgoing sidebar at its current (possibly sticky) position.
    // Its exit must not occupy a second grid row after the column is removed.
    sidebarMotionStyle.value = {
      '--sidebar-left': `${rect.left - parentRect.left - grid.clientLeft - (translation?.m41 ?? 0)}px`,
      '--sidebar-top': `${rect.top - parentRect.top - grid.clientTop - (translation?.m42 ?? 0)}px`,
      '--sidebar-width': `${rect.width}px`,
      '--sidebar-from-opacity': style.display === 'none' ? '0' : style.opacity,
      '--sidebar-from-transform': style.display === 'none' ? 'translateX(-6px)' : style.transform,
    }
  }
  sidebarMotionReady.value = true
  const before = articleContent.value?.getBoundingClientRect()
  contentMotion?.cancel()
  sidebarCollapsed.value = !sidebarCollapsed.value
  await nextTick()
  const content = articleContent.value
  if (!content || !before || !wideLayout.value || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const offset = before.left - content.getBoundingClientRect().left
  // Move only the reading column; do not animate layout or glass sampling width.
  contentMotion = content.animate([
    { transform: `translateX(${offset}px)` },
    { transform: 'translateX(0)' },
  ], { duration: 360, easing: 'cubic-bezier(.2, .82, .22, 1)' })
}

onMounted(() => {
  layoutQuery = window.matchMedia('(min-width: 768px)')
  updateLayout()
  layoutQuery.addEventListener('change', updateLayout)
})
onBeforeUnmount(() => {
  layoutQuery?.removeEventListener('change', updateLayout)
  contentMotion?.cancel()
})

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
    .filter(image => !image.closest('a, button'))
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
  // Linked images retain native navigation, including opening a new tab.
  if (event.defaultPrevented || event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey
    || event.target.closest('a, button')) return
  event.preventDefault()
  openLightbox(event.target)
}

function onContentKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter' && event.key !== ' ') return
  if (!(event.target instanceof HTMLImageElement)) return
  if (event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey
    || event.target.closest('a, button')) return
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
      <NuxtLink class="back-link" :to="course ? `/notes/${course.slug}` : '/'">← {{ course ? course.name : '返回文章' }}</NuxtLink>
      <div class="article-kicker">
        <span>{{ course?.name || post.tags?.[0] || '随笔' }}</span>
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

    <ArticleTools :key="post.path" :content="articleContent" :title="post.title">
      <template #actions>
        <button class="article-copy-action article-sidebar-toggle" :class="{ 'is-collapsed': sidebarHidden }" type="button" :aria-label="sidebarHidden ? '展开侧栏' : '收起侧栏'" :aria-expanded="!sidebarHidden" aria-controls="article-sidebar" @click="toggleSidebar">
          <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /><path class="article-sidebar-toggle__arrow" d="m16 9-3 3 3 3" /></svg>
          <span class="article-sidebar-toggle__labels" aria-hidden="true">
            <span class="article-sidebar-toggle__collapse">收起侧栏</span>
            <span class="article-sidebar-toggle__expand">展开侧栏</span>
          </span>
        </button>
      </template>
    </ArticleTools>

    <div class="article-grid" :class="{ 'is-sidebar-collapsed': sidebarHidden }">
      <Transition name="article-sidebar" :css="wideLayout && sidebarMotionReady">
      <aside v-show="!sidebarHidden" id="article-sidebar" ref="sidebar" class="article-aside" :style="sidebarMotionStyle" :inert="sidebarHidden" :aria-hidden="sidebarHidden || undefined">
        <span>相关话题</span>
        <div class="tag-list">
          <NuxtLink v-for="tag in (post.tags || [])" :key="tag" :to="`/tags/${getTagSlug(tag)}`">{{ tag }}</NuxtLink>
        </div>
        <NuxtLink class="topic-directory-link" to="/tags">浏览全部话题 ↗</NuxtLink>
        <ArticleToc :links="post.body?.toc?.links || []" />
      </aside>
      </Transition>
      <article
        ref="articleContent"
        class="article-content"
        :data-article-path="post.path"
        @click="onContentClick"
        @keydown="onContentKeydown"
      >
        <ContentRenderer :value="post" :components="{ 'pdf-viewer': PdfViewer, PdfViewer, 'tree-walk': TreeWalk, TreeWalk, 'algebra-explorer': AlgebraExplorer, AlgebraExplorer, pre: ArticleCode, table: ArticleTable }" />
      </article>
    </div>

    <CourseNavigation v-if="course" :key="post.path" :path="post.path" :reading-links="post.readingLinks" />
    <RelatedEntries :current="post" />

    <footer class="article-end">
      <span>完</span>
      <p>如果这篇文章与你产生了共鸣，欢迎继续阅读归档中的其他文字。</p>
      <NuxtLink class="text-link" to="/archive">查看全部归档 <span>↗</span></NuxtLink>
      <CopyArticleLink />
    </footer>

    <ImageLightbox
      v-model:open="lightboxOpen"
      v-model:index="lightboxIndex"
      :images="lightboxImages"
    />
  </main>
</template>

<style scoped>
.article-grid { position: relative; }
.article-sidebar-enter-active { transition: opacity 260ms var(--ease-settle, cubic-bezier(.2, .82, .22, 1)), transform 260ms var(--ease-settle, cubic-bezier(.2, .82, .22, 1)); }
.article-page .article-grid > .article-sidebar-leave-active {
  position: absolute;
  left: var(--sidebar-left);
  top: var(--sidebar-top);
  width: var(--sidebar-width);
  pointer-events: none;
  transition: opacity 160ms var(--ease-exit, ease-out), transform 160ms var(--ease-exit, ease-out);
}
.article-sidebar-enter-from, .article-sidebar-leave-from { opacity: var(--sidebar-from-opacity, 0); transform: var(--sidebar-from-transform, translateX(-6px)); }
.article-sidebar-enter-to { opacity: 1; transform: translateX(0); }
.article-sidebar-leave-to { opacity: 0; transform: translateX(-6px); }
.article-sidebar-toggle { cursor: pointer; }
.article-sidebar-toggle:active { transform: translateY(1px); }
/* This is a layout action, not an open tool panel: reuse the neutral action
   recipe while retaining aria-expanded solely for accessibility. */
.article-sidebar-toggle__arrow { transform-box: fill-box; transform-origin: center; transition: transform 360ms var(--ease-settle, cubic-bezier(.2, .82, .22, 1)); }
.article-sidebar-toggle.is-collapsed .article-sidebar-toggle__arrow { transform: rotate(180deg); }
.article-sidebar-toggle__labels { display: grid; }
.article-sidebar-toggle__labels > span { grid-area: 1 / 1; transition: opacity 220ms var(--ease-fluid, ease), transform 360ms var(--ease-settle, cubic-bezier(.2, .82, .22, 1)); }
.article-sidebar-toggle__expand { opacity: 0; transform: translateY(5px); }
.article-sidebar-toggle.is-collapsed .article-sidebar-toggle__collapse { opacity: 0; transform: translateY(-5px); }
.article-sidebar-toggle.is-collapsed .article-sidebar-toggle__expand { opacity: 1; transform: translateY(0); }
.article-sidebar-toggle:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
@media (prefers-reduced-motion: reduce) {
  .article-sidebar-toggle__arrow, .article-sidebar-toggle__labels > span { transition: none; }
  .article-sidebar-enter-active, .article-page .article-grid > .article-sidebar-leave-active { transition: none; }
}
@media (min-width: 768px) {
  .article-page > .article-grid.is-sidebar-collapsed { grid-template-columns: minmax(0, var(--article-column-width)); gap: 0; }
}
@media (max-width: 767.98px) {
  .article-tools__actions .article-sidebar-toggle { display: none; }
}
.article-aside .tag-list a { display: inline-flex; align-items: center; min-height: 32px; padding: 4px 6px; font-size: 12px; text-decoration: underline; text-underline-offset: 4px; text-decoration-thickness: 1px; overflow-wrap: anywhere; }
.article-aside .tag-list a:hover { text-decoration-thickness: 2px; }
.article-aside .tag-list a:focus-visible,
.topic-directory-link:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
.topic-directory-link { display: inline-flex; align-items: center; min-height: 44px; margin-top: 8px; font-size: 12px; text-decoration: underline; text-underline-offset: 4px; }
@media (max-width: 767.98px) {
  .article-aside .tag-list a { min-height: 44px; }
}
</style>
