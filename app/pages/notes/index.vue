<script setup lang="ts">
import { courses } from '~/utils/courses'
useSeoMeta({ title: '学习笔记', description: '按课程整理、按时间记录的学习笔记。' })
const { data: notes } = await useAsyncData('all-notes', () =>
  queryCollection('posts').where('draft', '=', false).where('path', 'LIKE', '/notes/%').order('date', 'DESC').all(),
)
</script>

<template>
  <main class="standard-page">
    <header class="page-intro">
      <p class="eyebrow">STUDY NOTES</p>
      <h1>学习笔记</h1>
      <p>按课程整理思路，在一次次推导与练习中留下理解的过程。</p>
    </header>
    <nav class="course-directory" aria-label="课程目录">
      <NuxtLink v-for="course in courses" :key="course.slug" :to="`/notes/${course.slug}`" class="course-link">
        <span class="course-name">
          <span class="course-title">{{ course.name }}</span>
          <small lang="en">{{ course.english }}</small>
        </span>
        <span class="course-count">{{ (notes || []).filter(note => note.path.startsWith(`/notes/${course.slug}/`)).length }} 篇</span>
        <span class="course-arrow" aria-hidden="true">↗</span>
      </NuxtLink>
    </nav>
    <h2 class="notes-timeline-heading">全部笔记</h2>
    <TimelineArchive :posts="notes || []" empty-text="还没有公开的学习笔记，课程目录已准备好。" />
  </main>
</template>
