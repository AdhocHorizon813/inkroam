import { defineCollection, defineContentConfig, z } from '@nuxt/content'

export default defineContentConfig({
  collections: {
    posts: defineCollection({
      type: 'page',
      source: [
        { include: 'posts/*.md', prefix: '/posts' },
        { include: 'notes/*/*.md', prefix: '/notes' },
      ],
      schema: z.object({
        title: z.string(),
        description: z.string(),
        date: z.string(),
        order: z.number().int().nonnegative().optional(),
        readingLinks: z.array(z.object({
          path: z.string().regex(/^\/notes\/[a-z0-9-]+\/[a-z0-9-]+$/),
          kind: z.enum(['review', 'next']),
          reason: z.string().trim().min(1).max(160),
        })).max(3).optional(),
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
