<script setup lang="ts">
import { resolveActiveHeading } from '~/utils/toc-active'
import { onPageScroll, pageMaxScroll, pageScrollTop } from '~/utils/page-scroll'
const route = useRoute()
type TocLink = { id: string; text: string; depth: number; children?: TocLink[] }
const props = defineProps<{ links: TocLink[] }>()
const entries = computed(() => props.links.flatMap(link => [link, ...(link.children || [])]))
const activeId = ref('')
const expanded = ref(false)
let frame = 0
let resizeObserver: ResizeObserver | undefined
let stopScrollListener: (() => void) | undefined
function updateActive() {
  frame = 0
  const offset = document.documentElement.dataset.visual === 'modern' ? 100 : 24
  const headings = entries.value.flatMap(entry => {
    const heading = document.getElementById(entry.id)
    return heading ? [{ id: entry.id, top: heading.getBoundingClientRect().top, margin: parseFloat(getComputedStyle(heading).scrollMarginTop) || 0 }] : []
  })
  const maxScroll = pageMaxScroll()
  activeId.value = resolveActiveHeading(headings, route.hash, pageScrollTop(), maxScroll, offset)
}
function scheduleUpdate() {
  if (!frame) frame = requestAnimationFrame(updateActive)
}
onMounted(() => {
  expanded.value = window.matchMedia('(min-width: 768px)').matches
  updateActive()
  /* 滚动位置问 app/utils/page-scroll.ts：桌面在 .page-scroll 里滚、手机上仍滚文档，
     捕获阶段才能在 window 上收到容器内部的滚动。 */
  stopScrollListener = onPageScroll(scheduleUpdate)
  window.addEventListener('resize', scheduleUpdate, { passive: true })
  resizeObserver = new ResizeObserver(scheduleUpdate)
  resizeObserver.observe(document.documentElement)
  const content = document.querySelector('.article-content')
  if (content) resizeObserver.observe(content)
})
onBeforeUnmount(() => {
  cancelAnimationFrame(frame)
  resizeObserver?.disconnect()
  stopScrollListener?.()
  window.removeEventListener('resize', scheduleUpdate)
})
watch(() => props.links, () => { expanded.value = false; nextTick(scheduleUpdate) })
watch(() => route.hash, () => nextTick(scheduleUpdate))
</script>

<template>
  <nav v-if="entries.length" class="article-toc" aria-label="文章目录">
    <button class="article-toc__toggle" :aria-expanded="expanded" aria-controls="article-toc-links" @click="expanded = !expanded">
      文章目录 <span aria-hidden="true">{{ expanded ? '−' : '+' }}</span>
    </button>
    <div id="article-toc-links" class="article-toc__body" :class="{ 'is-expanded': expanded }" :inert="!expanded" :aria-hidden="!expanded">
    <div class="article-toc__clip">
    <ol>
      <li v-for="entry in entries" :key="entry.id" :class="{ 'is-child': entry.depth > 2 }">
        <NuxtLink :to="{ hash: `#${entry.id}` }" :aria-current="activeId === entry.id ? 'location' : undefined">{{ entry.text }}</NuxtLink>
      </li>
    </ol>
    </div>
    </div>
  </nav>
</template>

<style scoped>
.article-toc { margin-top: 30px; color: var(--muted); }
.article-toc__toggle { display: flex; width: 100%; justify-content: space-between; padding: 12px 0; border: 0; border-block: 1px solid var(--line); background: transparent; color: var(--ink); font: inherit; font-size: 13px; cursor: pointer; }
.article-toc__body { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 260ms var(--ease-exit, cubic-bezier(.4, 0, .85, .25)); }
.article-toc__body.is-expanded { grid-template-rows: 1fr; transition-duration: 440ms; transition-timing-function: var(--ease-settle, cubic-bezier(.2, .82, .22, 1)); }
.article-toc__clip { min-height: 0; overflow: hidden; }
ol { list-style: none; margin: 14px 0 0; padding: 0; max-height: 55vh; overflow-y: auto; overscroll-behavior: contain; }
li { margin: 0; border-left: 1px solid var(--line); }
li.is-child a { padding-left: 22px; font-size: 12px; }
a { display: block; padding: 7px 10px; font-size: 13px; line-height: 1.65; overflow-wrap: anywhere; border-left: 2px solid transparent; margin-left: -1px; }
a:hover, a[aria-current] { color: var(--ink); }
a[aria-current] { border-left-color: var(--accent); background: color-mix(in srgb, var(--accent) 8%, transparent); }
@media (max-width: 767.98px) {
  .article-toc { margin-top: 22px; }
  ol { max-height: none; }
}
</style>
