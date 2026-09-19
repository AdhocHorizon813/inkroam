<script setup lang="ts">
import { courses } from '~/utils/courses'
const route = useRoute()
if (!courses.some(course => course.slug === route.params.course)) {
  throw createError({ statusCode: 404, statusMessage: '课程未找到' })
}
</script>

<template>
  <ArticleReader :key="$route.path" />
</template>
