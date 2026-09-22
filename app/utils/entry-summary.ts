import type { PostsCollectionItem } from '@nuxt/content'

export const entrySummaryFields = ['path', 'title', 'description', 'date', 'tags', 'readingTime', 'pinned', 'featured', 'aiGenerated', 'aiAssisted', 'order'] as const
export type EntrySummary = Pick<PostsCollectionItem, typeof entrySummaryFields[number]>
