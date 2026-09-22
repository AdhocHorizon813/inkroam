<script setup lang="ts">
import { courseForPath } from '~/utils/courses'
import { courseNeighbours } from '~/utils/course-sequence'
const props = defineProps<{ path: string }>()
const course = courseForPath(props.path)
const { data } = await useAsyncData(`course-sequence-${course?.slug}`, () =>
  queryCollection('posts').where('draft', '=', false).where('path', 'LIKE', `/notes/${course?.slug}/%`).select('path', 'title', 'date', 'order').all(),
)
const neighbours = computed(() => courseNeighbours(props.path, data.value || []))
</script>

<template>
  <nav v-if="course" class="course-navigation" aria-label="课程阅读导航">
    <NuxtLink class="course-navigation__index" :to="`/notes/${course.slug}`">{{ course.name }} · 全部笔记 ↗</NuxtLink>
    <div v-if="neighbours.previous || neighbours.next" class="course-navigation__links">
      <NuxtLink v-if="neighbours.previous" :to="neighbours.previous.path"><small>← 上一篇</small><span>{{ neighbours.previous.title }}</span></NuxtLink>
      <NuxtLink v-if="neighbours.next" :to="neighbours.next.path" class="course-navigation__next"><small>下一篇 →</small><span>{{ neighbours.next.title }}</span></NuxtLink>
    </div>
  </nav>
</template>

<style scoped>
.course-navigation { margin-top: 40px; padding-top: 24px; border-top: 1px solid var(--line); }
.course-navigation__index { display: inline-flex; min-height: 44px; align-items: center; font-size: 13px; text-decoration: underline; text-underline-offset: 4px; }
.course-navigation__links { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-top: 12px; }
.course-navigation__links a { display: grid; gap: 8px; padding: 16px; border: 1px solid var(--line); border-radius: 6px; overflow-wrap: anywhere; }
.course-navigation__links small { color: var(--muted); }
.course-navigation__next { grid-column: 2; }
a:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
:root[data-visual='modern'] .course-navigation, :root[data-visual='modern'] .course-navigation__links a { border-color: var(--modern-line); }
:root[data-visual='modern'] .course-navigation__links small { color: var(--modern-muted); }
@media (max-width: 540px) { .course-navigation__links { grid-template-columns: minmax(0, 1fr); } .course-navigation__next { grid-column: auto; } }
</style>
