<script setup lang="ts">
import { courseForPath } from '~/utils/courses'
import { courseNeighbours } from '~/utils/course-sequence'
import { resolveReadingLinks, type ReadingLink } from '~/utils/reading-links'
const props = defineProps<{ path: string; readingLinks?: ReadingLink[] | null }>()
const course = courseForPath(props.path)
const { data } = await useAsyncData(`course-sequence-${course?.slug}`, () =>
  queryCollection('posts').where('draft', '=', false).where('path', 'LIKE', `/notes/${course?.slug}/%`).select('path', 'title', 'date', 'order').all(),
)
const neighbours = computed(() => courseNeighbours(props.path, data.value || []))
const reading = computed(() => resolveReadingLinks(props.path, props.readingLinks, data.value || []))
const extraReading = computed(() => reading.value.filter(link => link.path !== neighbours.value.previous?.path && link.path !== neighbours.value.next?.path))
const relationLabel = (kind: ReadingLink['kind']) => kind === 'review' ? '需要时回顾' : '接着探索'
const reasonFor = (path: string) => {
  const link = reading.value.find(link => link.path === path)
  return link ? `${relationLabel(link.kind)}：${link.reason}` : ''
}
</script>

<template>
  <nav v-if="course" class="course-navigation" aria-label="课程阅读导航">
    <NuxtLink class="course-navigation__index" :to="`/notes/${course.slug}`">{{ course.name }} · 全部笔记 ↗</NuxtLink>
    <div v-if="neighbours.previous || neighbours.next" class="course-navigation__links">
      <NuxtLink v-if="neighbours.previous" :to="neighbours.previous.path"><small>← 上一篇</small><span>{{ neighbours.previous.title }}</span><small v-if="reasonFor(neighbours.previous.path)">{{ reasonFor(neighbours.previous.path) }}</small></NuxtLink>
      <NuxtLink v-if="neighbours.next" :to="neighbours.next.path" class="course-navigation__next"><small>下一篇 →</small><span>{{ neighbours.next.title }}</span><small v-if="reasonFor(neighbours.next.path)">{{ reasonFor(neighbours.next.path) }}</small></NuxtLink>
    </div>
    <ul v-if="extraReading.length" class="course-navigation__reading" aria-label="阅读线索">
      <li v-for="link in extraReading" :key="link.path">
        <small>{{ relationLabel(link.kind) }}</small>
        <NuxtLink :to="link.path">{{ link.title }}</NuxtLink>
        <p>{{ link.reason }}</p>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
.course-navigation { margin-top: 40px; padding-top: 24px; border-top: 1px solid var(--line); }
.course-navigation__index { display: inline-flex; min-height: 44px; align-items: center; font-size: 13px; text-decoration: underline; text-underline-offset: 4px; }
.course-navigation__links { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-top: 12px; }
.course-navigation__links a { display: grid; gap: 8px; padding: 16px; border: 1px solid var(--line); border-radius: 6px; overflow-wrap: anywhere; }
.course-navigation__links small { color: var(--muted); }
.course-navigation__next { grid-column: 2; }
.course-navigation__reading { list-style: none; padding: 0; margin: 24px 0 0; display: grid; gap: 20px; }
.course-navigation__reading small { display: block; color: var(--muted); font-size: 12px; }
.course-navigation__reading a { display: inline-block; padding-block: 10px; text-decoration: underline; text-underline-offset: 4px; overflow-wrap: anywhere; }
.course-navigation__reading p { margin: 0; color: var(--muted); font-size: 14px; line-height: 1.8; overflow-wrap: anywhere; }
a:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
:root[data-visual='modern'] .course-navigation, :root[data-visual='modern'] .course-navigation__links a { border-color: var(--modern-line); }
:root[data-visual='modern'] .course-navigation__links small { color: var(--modern-muted); }
@media (max-width: 540px) { .course-navigation__links { grid-template-columns: minmax(0, 1fr); } .course-navigation__next { grid-column: auto; } }
</style>
