<script setup lang="ts">
import { courses } from '~/utils/courses'
const route = useRoute()
const course = courses.find(item => item.slug === route.params.course)
if (!course) throw createError({ statusCode: 404, statusMessage: '课程未找到' })
useSeoMeta({ title: `${course.name} · 学习笔记`, description: `${course.name}课程的全部学习笔记，按时间排列。` })
const { data: notes } = await useAsyncData(`course-notes-${course.slug}`, () =>
  queryCollection('posts').where('draft', '=', false).where('path', 'LIKE', `/notes/${course.slug}/%`).order('date', 'DESC').all(),
)
</script>

<template>
  <main class="standard-page">
    <header class="page-intro">
      <NuxtLink class="back-link" to="/notes">← 全部课程</NuxtLink>
      <p class="eyebrow">{{ course.english }}</p>
      <h1>{{ course.name }}</h1>
      <p>{{ notes?.length || 0 }} 篇笔记，按时间记录学习的过程。</p>
    </header>
    <TimelineArchive :posts="notes || []" empty-text="这门课程还没有公开笔记。" />
  </main>
</template>
