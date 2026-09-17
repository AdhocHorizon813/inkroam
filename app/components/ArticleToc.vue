<script setup lang="ts">
type TocLink = { id: string; text: string; depth: number; children?: TocLink[] }
const props = defineProps<{ links: TocLink[] }>()
const entries = computed(() => props.links.flatMap(link => [link, ...(link.children || [])]))
const activeId = ref('')
const expanded = ref(false)
let frame = 0
function updateActive() {
  frame = 0
  const offset = document.documentElement.dataset.visual === 'modern' ? 100 : 24
  let current = entries.value[0]?.id || ''
  for (const entry of entries.value) {
    const heading = document.getElementById(entry.id)
    if (heading && heading.getBoundingClientRect().top <= offset) current = entry.id
  }
  activeId.value = current
}
function scheduleUpdate() {
  if (!frame) frame = requestAnimationFrame(updateActive)
}
onMounted(() => {
  expanded.value = window.matchMedia('(min-width: 768px)').matches
  updateActive()
  window.addEventListener('scroll', scheduleUpdate, { passive: true })
  window.addEventListener('resize', scheduleUpdate, { passive: true })
})
onBeforeUnmount(() => {
  cancelAnimationFrame(frame)
  window.removeEventListener('scroll', scheduleUpdate)
  window.removeEventListener('resize', scheduleUpdate)
})
watch(() => props.links, () => { expanded.value = false; nextTick(scheduleUpdate) })
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
