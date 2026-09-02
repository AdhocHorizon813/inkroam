import { defineCollection, defineContentConfig, z } from '@nuxt/content'

export default defineContentConfig({
  collections: {
    posts: defineCollection({
      type: 'page',
      source: 'posts/*.md',
      schema: z.object({
        title: z.string(),
        description: z.string(),
        date: z.string(),
        tags: z.array(z.string()).default([]),
        readingTime: z.string().default('5 分钟'),
        aiGenerated: z.boolean().default(false),
        aiAssisted: z.boolean().default(false),
        pinned: z.boolean().default(false),
        featured: z.boolean().default(false),
        draft: z.boolean().default(false),
      }),
    }),
  },
})
